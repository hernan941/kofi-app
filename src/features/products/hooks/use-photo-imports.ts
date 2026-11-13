import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';

import { useDependencies } from '@/core/providers/dependencies-context';
import { announce, useAppToast } from '@/shared/ui';

import { PHOTO_MESSAGES, photosAdded } from '../messages/photo-messages';
import { remainingPhotoSlots, type PhotoImportErrorCode, type StoredPhoto } from '../domain';
import { importPhotos } from '../use-cases/import-photos';

/** Options of {@link usePhotoImports}. */
export interface UsePhotoImportsOptions {
  /** Photos in the form now (saved, new and removed excluded), without the ones being prepared. */
  readonly photoCount: number;
  /** Receives the photos that were imported and returns how many the form has afterwards. */
  readonly onImported: (photos: readonly StoredPhoto[]) => number;
}

/** What the strip needs to add photos: the state of the imports and the ways to start them. */
export interface PhotoImports {
  /** Photos being prepared; they count against the room. */
  readonly pendingCount: number;
  /** How many photos were kept when the picker trimmed the selection to the room left; `null` if it did not. */
  readonly trimmedTo: number | null;
  /** Codes of the photos that could not be added in the last import; empty if all went well. */
  readonly failureCodes: readonly PhotoImportErrorCode[];
  readonly isCameraDeniedOpen: boolean;
  readonly addFromLibrary: () => Promise<void>;
  readonly addFromCamera: () => Promise<void>;
  readonly closeCameraDenied: () => void;
  readonly openSettings: () => void;
  /** Resolves when no import is running; the form waits for it before saving. */
  readonly waitForIdle: () => Promise<void>;
}

/**
 * Picks photos from the library or the camera and imports them right away (ADR-008), one
 * at a time. The strip shows the progress and the form waits for `waitForIdle` before it
 * saves. A photo that fails never blocks the others.
 */
export function usePhotoImports({ photoCount, onImported }: UsePhotoImportsOptions): PhotoImports {
  const { photoPicker, ids, photos, logger } = useDependencies();
  const toast = useAppToast();
  const [pendingCount, setPendingCount] = useState(0);
  const [failureCodes, setFailureCodes] = useState<readonly PhotoImportErrorCode[]>([]);
  const [trimmedTo, setTrimmedTo] = useState<number | null>(null);
  const [isCameraDeniedOpen, setIsCameraDeniedOpen] = useState(false);
  const running = useRef(new Set<Promise<void>>());

  const track = (work: Promise<void>): Promise<void> => {
    running.current.add(work);
    return work.finally(() => {
      running.current.delete(work);
    });
  };

  const importUris = async (uris: readonly string[]) => {
    setPendingCount((count) => count + uris.length);
    const outcomes = await importPhotos({ ids, photos, logger }, uris);
    setPendingCount((count) => count - uris.length);
    const added: StoredPhoto[] = [];
    const failures: PhotoImportErrorCode[] = [];
    for (const outcome of outcomes) {
      if (outcome.ok) {
        added.push(outcome.photo);
      } else {
        failures.push(outcome.code);
      }
    }
    setFailureCodes(failures);
    if (added.length > 0) {
      announce(photosAdded(added.length, onImported(added)));
    }
  };

  const room = () => remainingPhotoSlots(photoCount + pendingCount);

  const addFromLibrary = () =>
    track(
      (async () => {
        setFailureCodes([]);
        setTrimmedTo(null);
        try {
          const { uris, droppedCount } = await photoPicker.pickFromLibrary(room());
          if (uris.length > 0) {
            setTrimmedTo(droppedCount > 0 ? uris.length : null);
            await importUris(uris);
          }
        } catch (error) {
          logger.error('photo_library_failed', error);
          toast.showError(PHOTO_MESSAGES.libraryFailed);
        }
      })(),
    );

  const addFromCamera = () =>
    track(
      (async () => {
        setFailureCodes([]);
        setTrimmedTo(null);
        try {
          const result = await photoPicker.takePhoto();
          if (result.kind === 'permission_denied') {
            setIsCameraDeniedOpen(true);
          } else if (result.kind === 'taken') {
            await importUris([result.uri]);
          }
        } catch (error) {
          logger.error('photo_camera_failed', error);
          toast.showError(PHOTO_MESSAGES.cameraFailed);
        }
      })(),
    );

  const waitForIdle = useCallback(async () => {
    while (running.current.size > 0) {
      await Promise.allSettled([...running.current]);
    }
  }, []);

  return {
    pendingCount,
    trimmedTo,
    failureCodes,
    isCameraDeniedOpen,
    addFromLibrary,
    addFromCamera,
    closeCameraDenied: () => {
      setIsCameraDeniedOpen(false);
    },
    openSettings: () => {
      setIsCameraDeniedOpen(false);
      void Linking.openSettings();
    },
    waitForIdle,
  };
}
