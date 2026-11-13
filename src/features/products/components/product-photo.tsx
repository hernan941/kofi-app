import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';
import { withUniwind } from 'uniwind';

import type { ProductPhotoId } from '@/shared/domain';
import { Icon, ImageIcon, type IconSize } from '@/shared/ui';

import { usePhotoDisplay } from '../hooks/use-photo-display';
import { PHOTO_MESSAGES } from '../messages/photo-messages';

const StyledImage = withUniwind(Image);

/** Props of {@link ProductPhoto}. */
export interface ProductPhotoProps {
  readonly photoId: ProductPhotoId;
  /** Accessible label; the placeholder adds ", no se puede mostrar". Ignored when decorative. */
  readonly label: string;
  /** Size, radius and border classes; the same ones frame the placeholder. */
  readonly className: string;
  readonly contentFit?: 'cover' | 'contain';
  readonly placeholderIconSize?: IconSize;
  /** Identifies the image in tests when it is decorative and has no label to query by. */
  readonly testID?: string;
  /** Hides the image from the screen reader when a parent already describes it (a button, for example). */
  readonly isDecorative?: boolean;
  /** Called once when the file turns out to be missing, for example to explain it in the sheet. */
  readonly onMissing?: () => void;
}

/**
 * The only component that draws product photos (ADR-008): `expo-image` over the file of the
 * photo, with memory cache and `recyclingKey`. If the file is missing it shows a neutral
 * placeholder with the `Image` icon and logs `photo_file_missing` once per photo.
 */
export function ProductPhoto({
  photoId,
  label,
  className,
  contentFit = 'cover',
  placeholderIconSize = 'lg',
  isDecorative = false,
  testID,
  onMissing,
}: ProductPhotoProps) {
  const { uri, reportMissing } = usePhotoDisplay(photoId);
  const [hasFailed, setHasFailed] = useState(false);
  const accessibility = isDecorative
    ? ({ accessible: false, importantForAccessibility: 'no' } as const)
    : ({
        accessible: true,
        accessibilityRole: 'image',
        accessibilityLabel: hasFailed ? `${label}${PHOTO_MESSAGES.unavailableSuffix}` : label,
      } as const);

  if (hasFailed) {
    return (
      <View
        {...accessibility}
        testID={testID}
        className={`items-center justify-center bg-background ${className}`}
      >
        <Icon icon={ImageIcon} size={placeholderIconSize} color="muted" />
      </View>
    );
  }
  return (
    <StyledImage
      {...accessibility}
      testID={testID}
      source={{ uri }}
      recyclingKey={photoId}
      cachePolicy="memory"
      contentFit={contentFit}
      className={className}
      onError={() => {
        reportMissing();
        setHasFailed(true);
        onMissing?.();
      }}
    />
  );
}
