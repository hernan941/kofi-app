import { useRef, useState, type Ref } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';

import type { ProductPhotoId } from '@/shared/domain';
import {
  CaretLeftIcon,
  CaretRightIcon,
  DeleteButton,
  InlineNotice,
  SecondaryButton,
  Sheet,
  StarIcon,
} from '@/shared/ui';

import { PHOTO_MESSAGES, type ViewHandle } from '../messages/photo-messages';
import { ProductPhoto } from './product-photo';

/** Props shared by both modes of {@link PhotoSheet}. */
interface PhotoSheetBaseProps {
  readonly isOpen: boolean;
  readonly photoId: ProductPhotoId;
  /** Position of the photo, starting at 0. */
  readonly index: number;
  readonly total: number;
  readonly productName: string;
  readonly onClose: () => void;
}

/** The sheet of the form: cover, move and remove. */
export interface PhotoSheetEditProps extends PhotoSheetBaseProps {
  readonly mode: 'edit';
  readonly onMakeCover: () => void;
  readonly onMoveBefore: () => void;
  readonly onMoveAfter: () => void;
  readonly onRemove: () => void;
}

/** The read only sheet of the detail: previous and next. */
export interface PhotoSheetViewProps extends PhotoSheetBaseProps {
  readonly mode: 'view';
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}

/** Props of {@link PhotoSheet}. */
export type PhotoSheetProps = PhotoSheetEditProps | PhotoSheetViewProps;

/** Photo in large size with the explanation that appears if its file is missing. */
function LargePhoto({
  photoId,
  label,
  missingText,
  focusRef,
}: {
  readonly photoId: ProductPhotoId;
  readonly label: string;
  readonly missingText: string;
  readonly focusRef: Ref<ViewHandle>;
}) {
  const [isMissing, setIsMissing] = useState(false);
  return (
    <View className="gap-2">
      <View
        ref={focusRef}
        accessible
        accessibilityRole="image"
        accessibilityLabel={isMissing ? `${label}${PHOTO_MESSAGES.unavailableSuffix}` : label}
      >
        <ProductPhoto
          photoId={photoId}
          label={label}
          isDecorative
          contentFit="contain"
          placeholderIconSize="xl"
          className="aspect-4/3 w-full rounded-xl bg-background"
          onMissing={() => {
            setIsMissing(true);
          }}
        />
      </View>
      {isMissing ? <Text className="text-sm text-muted">{missingText}</Text> : null}
    </View>
  );
}

/**
 * Sheet with one photo in large size (design 3.2 and 3.6), without zoom or gestures. In
 * `edit` mode it offers "Usar como portada", "Mover antes/después" and "Quitar foto"; in
 * `view` mode only "Anterior" and "Siguiente".
 */
export function PhotoSheet(props: PhotoSheetProps) {
  const { isOpen, photoId, index, total, productName, onClose } = props;
  const position = `Foto ${String(index + 1)} de ${String(total)}`;
  const name = productName === '' ? position : `${position} de ${productName}`;
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const photoRef = useRef<ViewHandle>(null);

  const focusPhoto = () => {
    requestAnimationFrame(() => {
      if (photoRef.current !== null) {
        AccessibilityInfo.sendAccessibilityEvent(photoRef.current, 'focus');
      }
    });
  };

  return (
    <Sheet isOpen={isOpen} title={position} onClose={onClose}>
      <LargePhoto
        key={photoId}
        photoId={photoId}
        label={name}
        focusRef={photoRef}
        missingText={
          props.mode === 'edit' ? PHOTO_MESSAGES.missingInForm : PHOTO_MESSAGES.missingInDetail
        }
      />
      {props.mode === 'edit' ? (
        <>
          {isFirst ? (
            <InlineNotice
              icon={StarIcon}
              message="Es la portada: se ve en tu lista y al registrar ventas."
            />
          ) : (
            <SecondaryButton
              label="Usar como portada"
              icon={StarIcon}
              onPress={() => {
                props.onMakeCover();
                focusPhoto();
              }}
            />
          )}
          {total > 1 ? (
            <View className="flex-row flex-wrap gap-2">
              <View className="min-w-36 flex-1">
                <SecondaryButton
                  label="Mover antes"
                  icon={CaretLeftIcon}
                  isDisabled={isFirst}
                  onPress={props.onMoveBefore}
                />
              </View>
              <View className="min-w-36 flex-1">
                <SecondaryButton
                  label="Mover después"
                  icon={CaretRightIcon}
                  isDisabled={isLast}
                  onPress={props.onMoveAfter}
                />
              </View>
            </View>
          ) : null}
          <View className="items-start pt-4">
            <DeleteButton label="Quitar foto" onPress={props.onRemove} />
          </View>
        </>
      ) : total > 1 ? (
        <View className="flex-row flex-wrap gap-2">
          <View className="min-w-36 flex-1">
            <SecondaryButton
              label="Anterior"
              icon={CaretLeftIcon}
              isDisabled={isFirst}
              onPress={props.onPrevious}
            />
          </View>
          <View className="min-w-36 flex-1">
            <SecondaryButton
              label="Siguiente"
              icon={CaretRightIcon}
              isDisabled={isLast}
              onPress={props.onNext}
            />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}
