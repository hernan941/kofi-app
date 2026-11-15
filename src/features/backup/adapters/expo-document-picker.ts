import { getDocumentAsync } from 'expo-document-picker';

import type { DocumentPicker } from '../domain/ports';

/**
 * `DocumentPicker` sobre `expo-document-picker` (ADR-005): un solo archivo, que el selector
 * copia a la caché (`copyToCacheDirectory`). Cancelar devuelve `null`, no un error.
 */
export function createExpoDocumentPicker(): DocumentPicker {
  return {
    pickSingle: async ({ mimeTypes }) => {
      const result = await getDocumentAsync({
        type: [...mimeTypes],
        copyToCacheDirectory: true,
        multiple: false,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      return asset === undefined
        ? null
        : { uri: asset.uri, name: asset.name, size: asset.size ?? null };
    },
  };
}
