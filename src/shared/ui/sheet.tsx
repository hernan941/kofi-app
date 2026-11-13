import { XIcon } from 'phosphor-react-native/src/icons/X';
import type { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from './icon-button';

/** Props of {@link Sheet}. */
export interface SheetProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/**
 * Bottom sheet for short choices within reach of the thumb: card fill, sticker border and
 * shadow, rounded top corners, a `text-heading` title and a close button. The backdrop,
 * the close button and the Android back button call `onClose`. It slides in unless the
 * system asks to reduce motion. It is built on the React Native `Modal` because the HeroUI
 * `BottomSheet` needs `@gorhom/bottom-sheet`, which the project does not include.
 */
export function Sheet({ isOpen, title, onClose, children }: SheetProps) {
  const isReducedMotion = useReducedMotion();
  return (
    <Modal
      testID="sheet-modal"
      visible={isOpen}
      transparent
      animationType={isReducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={onClose}
          className="absolute inset-0 bg-backdrop"
        />
        <View className="rounded-t-3xl border-2 border-b-0 border-border bg-overlay shadow-sticker">
          <SafeAreaView edges={['bottom']} className="gap-4 px-4 pt-2 pb-4">
            <View className="flex-row items-center gap-2">
              <Text
                accessibilityRole="header"
                className="flex-1 font-semibold text-heading text-foreground"
              >
                {title}
              </Text>
              <IconButton icon={XIcon} accessibilityLabel="Cerrar" onPress={onClose} />
            </View>
            {children}
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}
