import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';

import type { ProductPhotoId } from '@/shared/domain';
import {
  CameraIcon,
  ConfirmDialog,
  Icon,
  ImageIcon,
  InlineNotice,
  SecondaryButton,
  WarningCircleIcon,
  announce,
  type ButtonHandle,
  useAnnounceWhen,
} from '@/shared/ui';

import { makeCover, movePhoto, remainingPhotoSlots } from '../domain';
import { describePhotoImportFailures } from './error-messages';
import type { PhotoImports } from '../hooks/use-photo-imports';
import {
  PHOTO_MESSAGES,
  type ViewHandle,
  photoCounter,
  photoCounterLabel,
  photoMoved,
  photoRemoved,
  photoThumbnailLabel,
  photosPreparing,
  selectionTrimmed,
} from '../messages/photo-messages';
import { PhotoSheet } from './photo-sheet';
import type { PhotoFormValue } from './product-form-schema';
import { ProductPhoto } from './product-photo';

/** Props of {@link PhotoStrip}. */
export interface PhotoStripProps {
  readonly photos: readonly PhotoFormValue[];
  readonly productName: string;
  readonly imports: PhotoImports;
  /** New order after "Usar como portada" or "Mover". */
  readonly onChange: (photos: readonly PhotoFormValue[]) => void;
  /** The person confirmed removing this photo. */
  readonly onRemove: (photo: PhotoFormValue) => void;
}

function moveById(
  photos: readonly PhotoFormValue[],
  apply: (
    items: readonly { readonly id: ProductPhotoId }[],
  ) => readonly { readonly id: ProductPhotoId }[],
): readonly PhotoFormValue[] {
  const byId = new Map(photos.map((photo) => [photo.photoId, photo]));
  return apply(photos.map((photo) => ({ id: photo.photoId }))).flatMap((item) => {
    const photo = byId.get(item.id);
    return photo === undefined ? [] : [photo];
  });
}

/** The "Fotos" section of the form (design 3.1 to 3.4): grid, counter, add buttons and the photo sheet. */
export function PhotoStrip({ photos, productName, imports, onChange, onRemove }: PhotoStripProps) {
  const [selectedId, setSelectedId] = useState<ProductPhotoId | null>(null);
  const [removing, setRemoving] = useState<PhotoFormValue | null>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [unavailable, setUnavailable] = useState<ReadonlySet<ProductPhotoId>>(new Set());
  const firstThumbnail = useRef<ViewHandle>(null);
  const galleryButton = useRef<ButtonHandle>(null);
  const total = photos.length;
  const used = total + imports.pendingCount;
  const isFull = remainingPhotoSlots(used) === 0;
  const selectedIndex = photos.findIndex((photo) => photo.photoId === selectedId);
  const selected = photos[selectedIndex];
  const failureMessage = describePhotoImportFailures(imports.failureCodes);
  const trimmedMessage = imports.trimmedTo === null ? null : selectionTrimmed(imports.trimmedTo);
  useAnnounceWhen(failureMessage ?? undefined);
  useAnnounceWhen(trimmedMessage ?? undefined);

  useEffect(() => {
    if (removing === null) return undefined;
    const frame = requestAnimationFrame(() => {
      setIsRemoveDialogOpen(true);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [removing]);

  const closeRemoveDialog = () => {
    setIsRemoveDialogOpen(false);
    setRemoving(null);
  };

  const focusAfterRemoval = () => {
    requestAnimationFrame(() => {
      const target = firstThumbnail.current ?? galleryButton.current;
      if (target !== null) {
        AccessibilityInfo.sendAccessibilityEvent(target, 'focus');
      }
    });
  };

  const move = (toIndex: number) => {
    if (selected === undefined) return;
    const next = moveById(photos, (items) => movePhoto(items, selected.photoId, toIndex));
    onChange(next);
    announce(
      photoMoved(
        next.findIndex((photo) => photo.photoId === selected.photoId),
        total,
      ),
    );
  };

  const confirmRemoval = () => {
    if (removing === null) return;
    onRemove(removing);
    closeRemoveDialog();
    setSelectedId(null);
    announce(photoRemoved(total - 1));
    focusAfterRemoval();
  };

  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap items-baseline justify-between">
        <Text className="font-medium text-sm text-foreground">{PHOTO_MESSAGES.sectionTitle}</Text>
        <Text accessibilityLabel={photoCounterLabel(used)} className="text-sm text-muted">
          {photoCounter(used)}
        </Text>
      </View>
      <Text className="text-sm text-muted">
        {total === 0 ? PHOTO_MESSAGES.helpWithoutPhotos : PHOTO_MESSAGES.helpWithPhotos}
      </Text>
      {total > 0 || imports.pendingCount > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {photos.map((photo, index) => (
            <Pressable
              key={photo.photoId}
              ref={index === 0 ? firstThumbnail : undefined}
              accessibilityRole="button"
              accessibilityLabel={photoThumbnailLabel(index, total, {
                isUnavailable: unavailable.has(photo.photoId),
              })}
              accessibilityHint="Abre la foto para verla, moverla o quitarla"
              onPress={() => {
                setSelectedId(photo.photoId);
              }}
              className="min-w-20 gap-1"
            >
              <ProductPhoto
                photoId={photo.photoId}
                label={photoThumbnailLabel(index, total, { isUnavailable: false })}
                isDecorative
                testID={`photo-${photo.photoId}`}
                placeholderIconSize="lg"
                className="size-20 rounded-xl border-2 border-border"
                onMissing={() => {
                  setUnavailable((current) => new Set(current).add(photo.photoId));
                }}
              />
              {index === 0 ? (
                <Text className="font-medium text-xs text-foreground">
                  {PHOTO_MESSAGES.coverLabel}
                </Text>
              ) : null}
            </Pressable>
          ))}
          {imports.pendingCount > 0 ? (
            <View
              accessible
              accessibilityLabel={photosPreparing(imports.pendingCount)}
              className="flex-row flex-wrap gap-2"
            >
              {Array.from({ length: imports.pendingCount }, (_, index) => (
                <View key={index} className="size-20 rounded-xl bg-surface" />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {isFull ? (
        <InlineNotice message={PHOTO_MESSAGES.full} />
      ) : (
        <View className="flex-row flex-wrap gap-2">
          <View className="min-w-36 flex-1">
            <SecondaryButton
              ref={galleryButton}
              label="Galería"
              icon={ImageIcon}
              accessibilityHint="Agrega fotos de la galería"
              onPress={() => {
                void imports.addFromLibrary();
              }}
            />
          </View>
          <View className="min-w-36 flex-1">
            <SecondaryButton
              label="Cámara"
              icon={CameraIcon}
              accessibilityHint="Toma una foto con la cámara"
              onPress={() => {
                void imports.addFromCamera();
              }}
            />
          </View>
        </View>
      )}
      {trimmedMessage === null ? null : <InlineNotice message={trimmedMessage} />}
      {failureMessage === null ? null : (
        <View className="flex-row items-start gap-1">
          <View className="pt-0.5">
            <Icon icon={WarningCircleIcon} size="sm" color="danger" />
          </View>
          <Text className="flex-1 text-sm text-danger">{failureMessage}</Text>
        </View>
      )}
      {selected === undefined || removing !== null ? null : (
        <PhotoSheet
          mode="edit"
          isOpen
          photoId={selected.photoId}
          index={selectedIndex}
          total={total}
          productName={productName}
          onClose={() => {
            setSelectedId(null);
          }}
          onMakeCover={() => {
            onChange(moveById(photos, (items) => makeCover(items, selected.photoId)));
            announce(PHOTO_MESSAGES.coverNow);
          }}
          onMoveBefore={() => {
            move(selectedIndex - 1);
          }}
          onMoveAfter={() => {
            move(selectedIndex + 1);
          }}
          onRemove={() => {
            setRemoving(selected);
          }}
        />
      )}
      <ConfirmDialog
        isOpen={isRemoveDialogOpen}
        title={PHOTO_MESSAGES.removeDialogTitle}
        description={
          removing?.isNew === true ? PHOTO_MESSAGES.removeNew : PHOTO_MESSAGES.removeSaved
        }
        confirmLabel={PHOTO_MESSAGES.removeConfirm}
        isDestructive
        onConfirm={confirmRemoval}
        onCancel={closeRemoveDialog}
      />
      <ConfirmDialog
        isOpen={imports.isCameraDeniedOpen}
        title={PHOTO_MESSAGES.cameraDeniedTitle}
        description={PHOTO_MESSAGES.cameraDeniedDescription}
        confirmLabel={PHOTO_MESSAGES.cameraDeniedConfirm}
        cancelLabel={PHOTO_MESSAGES.cameraDeniedCancel}
        onConfirm={imports.openSettings}
        onCancel={imports.closeCameraDenied}
      />
    </View>
  );
}
