import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { orderedPhotos, type ProductPhoto as ProductPhotoRow } from '../domain';
import { PhotoSheet } from './photo-sheet';
import { ProductPhoto } from './product-photo';

/** Props of {@link PhotoGallery}. */
export interface PhotoGalleryProps {
  readonly photos: readonly ProductPhotoRow[];
  readonly productName: string;
}

/**
 * Photos of the detail (design 3.5), read only: the cover in large size and, with two or
 * more photos, a row of thumbnails. Tapping one opens the sheet. Without photos it draws
 * nothing.
 */
export function PhotoGallery({ photos, productName }: PhotoGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const ordered = orderedPhotos(photos);
  const [cover] = ordered;
  const total = ordered.length;
  const opened = openIndex === null ? undefined : ordered[openIndex];
  if (cover === undefined) {
    return null;
  }

  return (
    <View className="gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Foto 1 de ${String(total)} de ${productName}, portada`}
        accessibilityHint="Abre la foto en grande"
        onPress={() => {
          setOpenIndex(0);
        }}
      >
        <ProductPhoto
          photoId={cover.id}
          label={`Foto 1 de ${String(total)}`}
          contentFit="contain"
          placeholderIconSize="xl"
          className="aspect-4/3 w-full rounded-3xl border-2 border-border bg-surface"
        />
      </Pressable>
      {total > 1 ? (
        <View className="flex-row flex-wrap gap-2 pt-2">
          {ordered.map((photo, index) => (
            <Pressable
              key={photo.id}
              accessibilityRole="button"
              accessibilityLabel={`Foto ${String(index + 1)} de ${String(total)}`}
              onPress={() => {
                setOpenIndex(index);
              }}
            >
              <ProductPhoto
                photoId={photo.id}
                label={`Foto ${String(index + 1)} de ${String(total)}`}
                className="size-16 rounded-xl border-2 border-border"
              />
            </Pressable>
          ))}
        </View>
      ) : null}
      {opened === undefined || openIndex === null ? null : (
        <PhotoSheet
          mode="view"
          isOpen
          photoId={opened.id}
          index={openIndex}
          total={total}
          productName={productName}
          onClose={() => {
            setOpenIndex(null);
          }}
          onPrevious={() => {
            setOpenIndex(Math.max(0, openIndex - 1));
          }}
          onNext={() => {
            setOpenIndex(Math.min(total - 1, openIndex + 1));
          }}
        />
      )}
    </View>
  );
}
