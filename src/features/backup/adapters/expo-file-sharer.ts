import { isAvailableAsync, shareAsync } from 'expo-sharing';

import type { FileSharer } from '../domain/ports';

/** `FileSharer` sobre `expo-sharing` (ADR-005). */
export function createExpoFileSharer(): FileSharer {
  return {
    isAvailable: () => isAvailableAsync(),
    share: (fileUri, { mimeType, uti }) =>
      shareAsync(fileUri, uti === undefined ? { mimeType } : { mimeType, UTI: uti }),
  };
}
