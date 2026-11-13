import { Paths } from 'expo-file-system';

import { productPhotoIdSchema } from '@/shared/domain';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { createExpoPhotoStorage } from './expo-photo-storage';
import { describePhotoStorageContract } from './photo-storage.contract';
import { PhotoImportError } from './photo-storage';

interface MockEntry {
  size: number;
  lastModified: number | null;
  digest: string;
}

const mockState = {
  documentUri: 'file:///data/doc/',
  entries: new Map<string, MockEntry>(),
  directories: new Set<string>(),
  deleteFailures: new Set<string>(),
  digestError: null as Error | null,
  order: [] as string[],
};

jest.mock('expo-file-system', () => {
  function join(parts: readonly unknown[]): string {
    const segments = parts.map((part) =>
      typeof part === 'string' ? part : (part as { uri: string }).uri,
    );
    return segments.reduce((acc, segment, index) =>
      index === 0 ? segment : `${acc.replace(/\/+$/, '')}/${segment.replace(/^\/+/, '')}`,
    );
  }

  class MockFile {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return mockState.entries.has(this.uri);
    }
    get size() {
      return mockState.entries.get(this.uri)?.size ?? 0;
    }
    get lastModified() {
      return mockState.entries.get(this.uri)?.lastModified ?? null;
    }
    get name() {
      return this.uri.split('/').pop() ?? '';
    }
    delete() {
      if (mockState.deleteFailures.has(this.uri)) {
        throw new Error('delete failed');
      }
      if (!mockState.entries.delete(this.uri)) {
        throw new Error('file does not exist');
      }
    }
    digest() {
      mockState.order.push('digest');
      if (mockState.digestError !== null) {
        return Promise.reject(mockState.digestError);
      }
      return Promise.resolve(mockState.entries.get(this.uri)?.digest ?? '');
    }
    move(destination: { uri: string }, options?: { overwrite?: boolean }) {
      const entry = mockState.entries.get(this.uri);
      if (entry === undefined) {
        return Promise.reject(new Error('source does not exist'));
      }
      if (mockState.entries.has(destination.uri) && options?.overwrite !== true) {
        return Promise.reject(new Error('destination exists'));
      }
      mockState.entries.delete(this.uri);
      mockState.entries.set(destination.uri, entry);
      this.uri = destination.uri;
      return Promise.resolve();
    }
  }

  class MockDirectory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return mockState.directories.has(this.uri);
    }
    create() {
      mockState.directories.add(this.uri);
    }
    list() {
      const prefix = `${this.uri.replace(/\/+$/, '')}/`;
      return [...mockState.entries.keys()]
        .filter((uri) => uri.startsWith(prefix) && !uri.slice(prefix.length).includes('/'))
        .map((uri) => new MockFile(uri));
    }
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: {
      get document() {
        return new MockDirectory(mockState.documentUri);
      },
      get cache() {
        return new MockDirectory('file:///data/cache/');
      },
    },
  };
});

interface MockContext {
  resize: jest.Mock<MockContext>;
  renderAsync: jest.Mock;
  release: jest.Mock;
}

interface MockRef {
  width: number;
  height: number;
  saveAsync: jest.Mock;
  release: jest.Mock;
}

const mockManipulator = {
  renderError: null as Error | null,
  saveError: null as Error | null,
  refSize: { width: 1200, height: 1600 },
  outputSize: { width: 1200, height: 1600 },
  outputUri: 'file:///data/cache/ImageManipulator/out.jpg',
  contexts: [] as MockContext[],
  refs: [] as MockRef[],
};

const mockManipulate = jest.fn<unknown, unknown[]>();

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: { manipulate: (...args: unknown[]) => mockManipulate(...args) },
}));

const SOURCE = 'file:///data/cache/ImagePicker/source.jpg';
const OUTPUT = mockManipulator.outputUri;
const ID = productPhotoIdSchema.parse('0190aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee');
const FINAL = `file:///data/doc/photos/${ID}.jpg`;
const PHOTOS_DIR = 'file:///data/doc/photos';
const manipulate = mockManipulate;

function putFile(uri: string, entry: Partial<MockEntry> = {}): void {
  mockState.entries.set(uri, { size: 1, lastModified: 1000, digest: 'aa', ...entry });
}

function makeRef(size: { width: number; height: number }): MockRef {
  const ref: MockRef = {
    ...size,
    saveAsync: jest.fn(() => {
      if (mockManipulator.saveError !== null) {
        return Promise.reject(mockManipulator.saveError);
      }
      putFile(OUTPUT, { size: 234_567, digest: 'ABCDEF0123' });
      return Promise.resolve({ uri: OUTPUT, ...mockManipulator.outputSize });
    }),
    release: jest.fn(() => {
      mockState.order.push('release');
    }),
  };
  mockManipulator.refs.push(ref);
  return ref;
}

function setUpManipulator(): void {
  manipulate.mockImplementation(() => {
    const context: MockContext = {
      resize: jest.fn(() => context),
      renderAsync: jest.fn(() =>
        mockManipulator.renderError === null
          ? Promise.resolve(makeRef(mockManipulator.refSize))
          : Promise.reject(mockManipulator.renderError),
      ),
      release: jest.fn(),
    };
    mockManipulator.contexts.push(context);
    return context;
  });
}

beforeEach(() => {
  mockState.documentUri = 'file:///data/doc/';
  mockState.entries.clear();
  mockState.directories.clear();
  mockState.deleteFailures.clear();
  mockState.digestError = null;
  mockState.order = [];
  Object.assign(mockManipulator, {
    renderError: null,
    saveError: null,
    refSize: { width: 1200, height: 1600 },
    outputSize: { width: 1200, height: 1600 },
    contexts: [],
    refs: [],
  });
  setUpManipulator();
  putFile(SOURCE);
});

function makeStorage() {
  const logger = new RecordingLogger();
  return { storage: createExpoPhotoStorage(logger), logger };
}

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the promise to reject');
}

describe('importFromPicker', () => {
  test('decodes with a size cap, saves a JPEG at 0.8 and stores it under photos/<id>.jpg', async () => {
    const { storage } = makeStorage();
    await storage.importFromPicker(SOURCE, ID);
    expect(manipulate).toHaveBeenCalledWith(SOURCE, { maxWidth: 1600, maxHeight: 1600 });
    expect(mockManipulator.refs[0]?.saveAsync).toHaveBeenCalledWith({
      compress: 0.8,
      format: 'jpeg',
    });
    expect(mockState.entries.has(FINAL)).toBe(true);
    expect(mockState.directories.has(PHOTOS_DIR)).toBe(true);
  });

  test('returns the stored photo with size, dimensions and a lowercase sha256, and no file name', async () => {
    const { storage } = makeStorage();
    const photo = await storage.importFromPicker(SOURCE, ID);
    expect(photo).toEqual({
      id: ID,
      width: 1200,
      height: 1600,
      byteSize: 234_567,
      sha256: 'abcdef0123',
    });
  });

  test('does not resize an image that already fits', async () => {
    const { storage } = makeStorage();
    await storage.importFromPicker(SOURCE, ID);
    expect(manipulate).toHaveBeenCalledTimes(1);
    expect(mockManipulator.contexts[0]?.resize).not.toHaveBeenCalled();
  });

  test('resizes with fitWithin when the decoded image is larger than the limit', async () => {
    mockManipulator.refSize = { width: 3000, height: 2000 };
    const { storage } = makeStorage();
    await storage.importFromPicker(SOURCE, ID);
    expect(manipulate).toHaveBeenCalledTimes(2);
    expect(manipulate.mock.calls[1]?.[0]).toBe(mockManipulator.refs[0]);
    expect(mockManipulator.contexts[1]?.resize).toHaveBeenCalledWith({ width: 1600, height: 1067 });
  });

  test('deletes the picker temporary and leaves no manipulator output behind', async () => {
    const { storage } = makeStorage();
    await storage.importFromPicker(SOURCE, ID);
    expect(mockState.entries.has(SOURCE)).toBe(false);
    expect(mockState.entries.has(OUTPUT)).toBe(false);
    expect([...mockState.entries.keys()]).toEqual([FINAL]);
  });

  test('rejects an id that is not a UUID, deletes the picker temporary and touches nothing else', async () => {
    const { storage } = makeStorage();
    const error = await failureOf(storage.importFromPicker(SOURCE, '../evil'));
    expect(error).toBeInstanceOf(PhotoImportError);
    expect((error as PhotoImportError).code).toBe('invalid_id');
    expect(manipulate).not.toHaveBeenCalled();
    expect(mockState.directories.size).toBe(0);
    expect(mockState.entries.has(SOURCE)).toBe(false);
  });

  test('never deletes a source outside the cache', async () => {
    const outside = 'file:///data/doc/photos/keep.jpg';
    putFile(outside);
    const { storage, logger } = makeStorage();
    await storage.importFromPicker(outside, ID);
    expect(mockState.entries.has(outside)).toBe(true);
    expect(logger.entriesAt('warn').map((entry) => entry.event)).toContain(
      'photo_temp_outside_cache',
    );
  });

  test('turns a read failure into unreadable and still deletes the picker temporary', async () => {
    mockManipulator.renderError = new Error('bad image');
    const { storage } = makeStorage();
    const error = await failureOf(storage.importFromPicker(SOURCE, ID));
    expect(error).toBeInstanceOf(PhotoImportError);
    expect((error as PhotoImportError).code).toBe('unreadable');
    expect((error as PhotoImportError).cause).toBe(mockManipulator.renderError);
    expect(mockState.entries.has(SOURCE)).toBe(false);
    expect(mockState.entries.has(FINAL)).toBe(false);
  });

  test('turns a save failure into write_failed and cleans up', async () => {
    mockManipulator.saveError = new Error('disk full');
    const { storage } = makeStorage();
    const error = await failureOf(storage.importFromPicker(SOURCE, ID));
    expect((error as PhotoImportError).code).toBe('write_failed');
    expect([...mockState.entries.keys()]).toEqual([]);
  });

  test('deletes the final file when a step after the move fails', async () => {
    mockState.digestError = new Error('cannot read');
    const { storage } = makeStorage();
    const error = await failureOf(storage.importFromPicker(SOURCE, ID));
    expect((error as PhotoImportError).code).toBe('write_failed');
    expect([...mockState.entries.keys()]).toEqual([]);
  });

  test('never overwrites an existing photo and keeps it when the import fails', async () => {
    putFile(FINAL, { size: 42, digest: 'keep' });
    const { storage } = makeStorage();
    const error = await failureOf(storage.importFromPicker(SOURCE, ID));
    expect((error as PhotoImportError).code).toBe('write_failed');
    expect(mockState.entries.get(FINAL)?.digest).toBe('keep');
    expect(mockState.entries.has(OUTPUT)).toBe(false);
    expect(mockState.entries.has(SOURCE)).toBe(false);
  });

  test('keeps the original error when a cleanup deletion fails, and logs it', async () => {
    mockManipulator.saveError = new Error('disk full');
    mockState.deleteFailures.add(SOURCE);
    const { storage, logger } = makeStorage();
    const error = await failureOf(storage.importFromPicker(SOURCE, ID));
    expect((error as PhotoImportError).code).toBe('write_failed');
    expect(logger.entriesAt('warn').map((entry) => entry.event)).toContain(
      'photo_temp_cleanup_failed',
    );
  });

  test('releases the image references right after saving, before moving and hashing', async () => {
    const { storage } = makeStorage();
    await storage.importFromPicker(SOURCE, ID);
    expect(mockState.order.indexOf('release')).toBeGreaterThanOrEqual(0);
    expect(mockState.order.indexOf('release')).toBeLessThan(mockState.order.indexOf('digest'));
  });

  test('floors a fractional modification time before it becomes an epoch', async () => {
    mockState.directories.add(PHOTOS_DIR);
    putFile(FINAL, { lastModified: 5000.75 });
    const { storage } = makeStorage();
    expect(await storage.listFiles()).toEqual([{ id: ID, modifiedAt: 5000 }]);
  });

  test('releases the manipulator objects', async () => {
    const { storage } = makeStorage();
    await storage.importFromPicker(SOURCE, ID);
    expect(mockManipulator.contexts[0]?.release).toHaveBeenCalled();
    expect(mockManipulator.refs[0]?.release).toHaveBeenCalled();
  });
});

describe('uriFor', () => {
  test('resolves the URI at call time from Paths.document', () => {
    const { storage } = makeStorage();
    expect(storage.uriFor(ID)).toBe(FINAL);
    mockState.documentUri = 'file:///other/container/doc/';
    expect(storage.uriFor(ID)).toBe(`file:///other/container/doc/photos/${ID}.jpg`);
    expect(Paths.document.uri).toBe('file:///other/container/doc/');
  });

  test('rejects an id that is not a UUID', () => {
    const { storage } = makeStorage();
    expect(() => storage.uriFor('../x' as never)).toThrow(PhotoImportError);
  });
});

describe('listFiles and listPartialFiles', () => {
  const OTHER = '0190aaaa-bbbb-7ccc-8ddd-000000000001';

  function seedFolder(): void {
    mockState.directories.add(PHOTOS_DIR);
    putFile(FINAL, { lastModified: 5000 });
    putFile(`${PHOTOS_DIR}/${OTHER}.jpg.part`, { lastModified: 7000 });
    putFile(`${PHOTOS_DIR}/notas.txt`);
    putFile(`${PHOTOS_DIR}/..%2Fx.jpg`);
  }

  test('listFiles returns valid .jpg files with their modification time', async () => {
    seedFolder();
    const { storage } = makeStorage();
    expect(await storage.listFiles()).toEqual([{ id: ID, modifiedAt: 5000 }]);
  });

  test('listFiles ignores .part silently and logs any other invalid name', async () => {
    seedFolder();
    const { storage, logger } = makeStorage();
    await storage.listFiles();
    const names = logger.entriesAt('warn').map((entry) => entry.context?.name);
    expect(names).toEqual(expect.arrayContaining(['notas.txt', '..%2Fx.jpg']));
    expect(names).not.toContain(`${OTHER}.jpg.part`);
    expect(logger.entriesAt('warn')).toHaveLength(2);
  });

  test('listPartialFiles returns only valid .part files', async () => {
    seedFolder();
    const { storage } = makeStorage();
    expect(await storage.listPartialFiles()).toEqual([{ id: OTHER, modifiedAt: 7000 }]);
  });

  test('both return an empty list when the folder does not exist yet', async () => {
    const { storage } = makeStorage();
    expect(await storage.listFiles()).toEqual([]);
    expect(await storage.listPartialFiles()).toEqual([]);
  });

  test('skips and logs a file whose modification time cannot be read', async () => {
    seedFolder();
    putFile(FINAL, { lastModified: null });
    const { storage, logger } = makeStorage();
    expect(await storage.listFiles()).toEqual([]);
    expect(logger.entriesAt('warn').map((entry) => entry.event)).toContain(
      'photo_file_unreadable_time',
    );
  });
});

describe('remove and removePartial', () => {
  test('remove deletes the photo file', async () => {
    putFile(FINAL);
    const { storage } = makeStorage();
    await storage.remove(ID);
    expect(mockState.entries.has(FINAL)).toBe(false);
  });

  test('remove does not fail when the file is already gone', async () => {
    const { storage } = makeStorage();
    await expect(storage.remove(ID)).resolves.toBeUndefined();
  });

  test('remove rejects an id that is not a UUID', async () => {
    const { storage } = makeStorage();
    await expect(storage.remove('../x' as never)).rejects.toBeInstanceOf(PhotoImportError);
  });

  test('removePartial deletes only the .part file and tolerates a missing one', async () => {
    putFile(FINAL);
    putFile(`${FINAL}.part`);
    const { storage } = makeStorage();
    await storage.removePartial(ID);
    expect(mockState.entries.has(`${FINAL}.part`)).toBe(false);
    expect(mockState.entries.has(FINAL)).toBe(true);
    await expect(storage.removePartial(ID)).resolves.toBeUndefined();
  });
});

describePhotoStorageContract('Expo', () => {
  const { storage } = makeStorage();
  return {
    storage,
    newSource: () => {
      putFile(SOURCE);
      return SOURCE;
    },
    sourceExists: (uri) => mockState.entries.has(uri),
  };
});
