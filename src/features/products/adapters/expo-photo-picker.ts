import * as ImagePicker from 'expo-image-picker';

import type { Logger } from '@/shared/lib/logger';

import { fitSelection } from '../domain/photos';
import { deleteCacheFile } from './cache-files';
import type { CameraResult, LibraryPick, PhotoPicker } from './photo-storage';

const EMPTY_PICK: LibraryPick = { uris: [], droppedCount: 0 };

function firstUri(result: ImagePicker.ImagePickerResult): string | null {
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

/**
 * Crea el selector de imágenes sobre `expo-image-picker` (ADR-008). La galería usa el selector
 * del sistema, sin permisos; la cámara pide el permiso solo al abrirse. Las opciones nunca
 * piden EXIF y las URIs devueltas son temporales en caché.
 */
export function createExpoPhotoPicker(logger: Logger): PhotoPicker {
  async function ensureCameraPermission(): Promise<ImagePicker.CameraPermissionResponse> {
    const current = await ImagePicker.getCameraPermissionsAsync();
    return !current.granted && current.canAskAgain
      ? ImagePicker.requestCameraPermissionsAsync()
      : current;
  }

  return {
    pickFromLibrary: async (maxCount) => {
      if (maxCount <= 0) {
        return EMPTY_PICK;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: maxCount > 1,
        selectionLimit: maxCount,
        exif: false,
        quality: 1,
        allowsEditing: false,
      });
      if (result.canceled) {
        return EMPTY_PICK;
      }
      const { kept, dropped } = fitSelection(
        result.assets.map((asset) => asset.uri),
        maxCount,
      );
      dropped.forEach((uri) => {
        deleteCacheFile(uri, logger);
      });
      return { uris: kept, droppedCount: dropped.length };
    },
    takePhoto: async (): Promise<CameraResult> => {
      const permission = await ensureCameraPermission();
      if (!permission.granted) {
        return { kind: 'permission_denied', canAskAgain: permission.canAskAgain };
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        exif: false,
        quality: 1,
        allowsEditing: false,
        cameraType: ImagePicker.CameraType.back,
      });
      const uri = firstUri(result);
      return uri === null ? { kind: 'cancelled' } : { kind: 'taken', uri };
    },
  };
}
