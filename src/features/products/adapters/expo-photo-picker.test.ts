import * as ImagePicker from 'expo-image-picker';

import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { createExpoPhotoPicker } from './expo-photo-picker';

const mockDeleted: string[] = [];

jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///data/cache/' } },
  File: class {
    uri: string;
    exists = true;
    constructor(uri: string) {
      this.uri = uri;
    }
    delete() {
      mockDeleted.push(this.uri);
    }
  },
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  getCameraPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  CameraType: { back: 'back', front: 'front' },
}));

const picker = jest.mocked(ImagePicker);
const CACHE = 'file:///data/cache/ImagePicker';

function permission(granted: boolean, canAskAgain: boolean) {
  return {
    granted,
    canAskAgain,
    status: granted ? 'granted' : 'denied',
    expires: 'never',
  } as never;
}

function assets(...uris: string[]) {
  return { canceled: false as const, assets: uris.map((uri) => ({ uri })) } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleted.length = 0;
});

describe('createExpoPhotoPicker', () => {
  describe('pickFromLibrary', () => {
    it('opens the library with the fixed options', async () => {
      picker.launchImageLibraryAsync.mockResolvedValue(assets('a', 'b'));

      const uris = await createExpoPhotoPicker(new RecordingLogger()).pickFromLibrary(3);

      expect(uris).toEqual({ uris: ['a', 'b'], droppedCount: 0 });
      expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 3,
        exif: false,
        quality: 1,
        allowsEditing: false,
      });
    });

    it('does not allow multiple selection for a single slot', async () => {
      picker.launchImageLibraryAsync.mockResolvedValue(assets('a'));

      await createExpoPhotoPicker(new RecordingLogger()).pickFromLibrary(1);

      expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(
        expect.objectContaining({ allowsMultipleSelection: false, selectionLimit: 1 }),
      );
    });

    it('returns an empty list when cancelled', async () => {
      picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });

      await expect(
        createExpoPhotoPicker(new RecordingLogger()).pickFromLibrary(2),
      ).resolves.toEqual({ uris: [], droppedCount: 0 });
    });

    it('does not open the picker when there is no room', async () => {
      await expect(
        createExpoPhotoPicker(new RecordingLogger()).pickFromLibrary(0),
      ).resolves.toEqual({ uris: [], droppedCount: 0 });

      expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
    });

    it('trims the selection to the room and deletes the surplus temporaries', async () => {
      const [a, b, c] = ['a', 'b', 'c'].map((name) => `${CACHE}/${name}.jpg`);
      picker.launchImageLibraryAsync.mockResolvedValue(assets(a ?? '', b ?? '', c ?? ''));

      const uris = await createExpoPhotoPicker(new RecordingLogger()).pickFromLibrary(1);

      expect(uris).toEqual({ uris: [a], droppedCount: 2 });
      expect(mockDeleted).toEqual([b, c]);
    });

    it('does not delete a surplus URI that is outside the cache', async () => {
      const logger = new RecordingLogger();
      picker.launchImageLibraryAsync.mockResolvedValue(
        assets(`${CACHE}/a.jpg`, 'file:///data/doc/photos/b.jpg'),
      );

      await createExpoPhotoPicker(logger).pickFromLibrary(1);

      expect(mockDeleted).toEqual([]);
      expect(logger.entriesAt('warn').map((entry) => entry.event)).toEqual([
        'photo_temp_outside_cache',
      ]);
    });
  });

  describe('takePhoto', () => {
    const options = {
      mediaTypes: ['images'],
      exif: false,
      quality: 1,
      allowsEditing: false,
      cameraType: 'back',
    };

    it('opens the camera when the permission is granted', async () => {
      picker.getCameraPermissionsAsync.mockResolvedValue(permission(true, true));
      picker.launchCameraAsync.mockResolvedValue(assets('photo'));

      await expect(createExpoPhotoPicker(new RecordingLogger()).takePhoto()).resolves.toEqual({
        kind: 'taken',
        uri: 'photo',
      });
      expect(picker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
      expect(picker.launchCameraAsync).toHaveBeenCalledWith(options);
    });

    it('asks for the permission when it can and then opens the camera', async () => {
      picker.getCameraPermissionsAsync.mockResolvedValue(permission(false, true));
      picker.requestCameraPermissionsAsync.mockResolvedValue(permission(true, true));
      picker.launchCameraAsync.mockResolvedValue(assets('photo'));

      await createExpoPhotoPicker(new RecordingLogger()).takePhoto();

      expect(picker.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(picker.launchCameraAsync).toHaveBeenCalledTimes(1);
    });

    it('reports a denied permission without opening the camera', async () => {
      picker.getCameraPermissionsAsync.mockResolvedValue(permission(false, true));
      picker.requestCameraPermissionsAsync.mockResolvedValue(permission(false, false));

      await expect(createExpoPhotoPicker(new RecordingLogger()).takePhoto()).resolves.toEqual({
        kind: 'permission_denied',
        canAskAgain: false,
      });
      expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    });

    it('does not ask again when the system will not show the prompt', async () => {
      picker.getCameraPermissionsAsync.mockResolvedValue(permission(false, false));

      await expect(createExpoPhotoPicker(new RecordingLogger()).takePhoto()).resolves.toEqual({
        kind: 'permission_denied',
        canAskAgain: false,
      });
      expect(picker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    });

    it('reports a cancelled capture', async () => {
      picker.getCameraPermissionsAsync.mockResolvedValue(permission(true, true));
      picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });

      await expect(createExpoPhotoPicker(new RecordingLogger()).takePhoto()).resolves.toEqual({
        kind: 'cancelled',
      });
    });
  });
});
