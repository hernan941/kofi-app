import { productPhotoIdSchema } from '@/shared/domain';

import { PhotoImportError, type PhotoStorage } from './photo-storage';

/** What the contract needs from an implementation under test. */
export interface PhotoStorageHarness {
  readonly storage: PhotoStorage;
  /** Creates a picker temporary and returns its URI. */
  readonly newSource: () => string;
  /** Whether that temporary is still there. */
  readonly sourceExists: (uri: string) => boolean;
}

const VALID_ID = productPhotoIdSchema.parse('0190aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee');
const INVALID_IDS = ['', '../evil', 'not-a-uuid', '0190AAAA-BBBB-7CCC-8DDD-EEEEEEEEEEEE'];

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof PhotoImportError ? error.code : 'other';
  }
  return 'none';
}

/**
 * Behavior every `PhotoStorage` must share (the Expo adapter and the in-memory double):
 * ids are validated as UUID on every entry, and the picker temporary is consumed whether the
 * import works or not.
 */
export function describePhotoStorageContract(
  name: string,
  create: () => PhotoStorageHarness,
): void {
  describe(`${name} PhotoStorage contract`, () => {
    it.each(INVALID_IDS)(
      'rejects the id %j with invalid_id and consumes the temporary',
      async (id) => {
        const { storage, newSource, sourceExists } = create();
        const source = newSource();

        const code = await codeOf(storage.importFromPicker(source, id));

        expect(code).toBe('invalid_id');
        expect(sourceExists(source)).toBe(false);
        await expect(storage.listFiles()).resolves.toEqual([]);
      },
    );

    it('consumes the temporary after a successful import and lists the new file', async () => {
      const { storage, newSource, sourceExists } = create();
      const source = newSource();

      const photo = await storage.importFromPicker(source, VALID_ID);

      expect(photo.id).toBe(VALID_ID);
      expect(photo.sha256).toMatch(/^[0-9a-f]{64}$|^[0-9a-f]+$/);
      expect(sourceExists(source)).toBe(false);
      const listed = await storage.listFiles();
      expect(listed.map((file) => file.id)).toEqual([VALID_ID]);
    });

    it('resolves the URI of a photo under photos/<id>.jpg', () => {
      const { storage } = create();

      expect(storage.uriFor(VALID_ID)).toMatch(new RegExp(`/photos/${VALID_ID}\\.jpg$`));
    });

    it('removes an imported file and tolerates a missing one', async () => {
      const { storage, newSource } = create();
      await storage.importFromPicker(newSource(), VALID_ID);

      await storage.remove(VALID_ID);
      await expect(storage.remove(VALID_ID)).resolves.toBeUndefined();

      await expect(storage.listFiles()).resolves.toEqual([]);
    });

    it.each(INVALID_IDS.filter((id) => id !== ''))(
      'rejects the id %j in uriFor, remove and removePartial',
      async (id) => {
        const { storage } = create();
        const invalid = id as never;

        expect(() => storage.uriFor(invalid)).toThrow(PhotoImportError);
        expect(await codeOf(storage.remove(invalid))).toBe('invalid_id');
        expect(await codeOf(storage.removePartial(invalid))).toBe('invalid_id');
      },
    );
  });
}
