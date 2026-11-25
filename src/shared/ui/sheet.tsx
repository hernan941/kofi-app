import { XIcon } from 'phosphor-react-native/src/icons/X';
import { useEffect, useRef, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { IconButton } from './icon-button';
import { StyledSafeAreaView } from './styled-safe-area-view';
import { useIsKeyboardVisible } from './use-is-keyboard-visible';

const EDGES_WITH_KEYBOARD_CLOSED = ['bottom'] as const;
const EDGES_WITH_KEYBOARD_OPEN = [] as const;

/** Props of {@link Sheet}. */
export interface SheetProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly onClose: () => void;
  /**
   * Identifies the step shown. When it changes, the screen reader focus moves to the title
   * so a change of step is heard ("¿Qué versión de…?").
   */
  readonly focusKey?: string;
  /** Set to `false` when the content scrolls by itself (a virtualized list); defaults to `true`. */
  readonly isScrollable?: boolean;
  readonly children: ReactNode;
}

/**
 * Bottom sheet for short choices within reach of the thumb: card fill, sticker border and
 * shadow, rounded top corners, a `text-heading` title and a close button. The backdrop,
 * the close button and the Android back button call `onClose`. It slides in unless the
 * system asks to reduce motion. It is built on the React Native `Modal` because the HeroUI
 * `BottomSheet` needs `@gorhom/bottom-sheet`, which the project does not include. Its height
 * stops at 90% of the screen: the header (title and close button) stays fixed and the content
 * scrolls inside the sheet, so with the largest system font nothing is pushed off the top.
 * When `focusKey` changes the screen reader focus goes to the title. The sheet rises with the
 * keyboard (`KeyboardAvoidingView` with `padding`) and, while the keyboard is open, stops
 * reserving the bottom safe area.
 */
export function Sheet({
  isOpen,
  title,
  onClose,
  focusKey,
  isScrollable = true,
  children,
}: SheetProps) {
  const isReducedMotion = useReducedMotion();
  const isKeyboardVisible = useIsKeyboardVisible();
  const titleRef = useRef<ComponentRef<typeof Text>>(null);
  const shownKey = useRef(focusKey);
  useEffect(() => {
    if (shownKey.current === focusKey) return;
    shownKey.current = focusKey;
    if (titleRef.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
    }
  }, [focusKey]);
  return (
    <Modal
      testID="sheet-modal"
      visible={isOpen}
      transparent
      animationType={isReducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        testID="sheet-keyboard"
        behavior="padding"
        className="flex-1 justify-end"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={onClose}
          className="absolute inset-0 bg-backdrop"
        />
        <View
          testID="sheet-card"
          className="max-h-[90%] rounded-t-3xl border-2 border-b-0 border-border bg-overlay shadow-sticker"
        >
          <StyledSafeAreaView
            edges={isKeyboardVisible ? EDGES_WITH_KEYBOARD_OPEN : EDGES_WITH_KEYBOARD_CLOSED}
            className="shrink gap-4 px-4 pt-2 pb-4"
          >
            <View className="flex-row items-center gap-2">
              <Text
                ref={titleRef}
                accessibilityRole="header"
                className="flex-1 font-semibold text-heading text-foreground"
              >
                {title}
              </Text>
              <IconButton icon={XIcon} accessibilityLabel="Cerrar" onPress={onClose} />
            </View>
            {isScrollable ? (
              <ScrollView
                testID="sheet-scroll"
                keyboardShouldPersistTaps="handled"
                className="grow-0"
                contentContainerClassName="gap-4"
              >
                {children}
              </ScrollView>
            ) : (
              children
            )}
          </StyledSafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
