import { useRef, type ComponentRef } from 'react';
import { AccessibilityInfo, Modal, Pressable, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { DeleteButton } from './delete-button';
import { PrimaryButton } from './primary-button';
import { SecondaryButton } from './secondary-button';
import { spokenPesos } from './spoken-pesos';

/** Props of {@link ConfirmDialog}. */
export interface ConfirmDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly description?: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly isDestructive?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * Confirmation before an important or destructive action, on the React Native `Modal` like
 * `Sheet`: it is its own native window, so the screen reader stays inside it and the screen
 * behind cannot be reached. When it shows, the focus goes to the question (a header). The
 * question is the title; the confirm button goes first, filled with `danger` and the `Trash`
 * icon when the action deletes something. Cancel, the backdrop and the Android back button
 * all call `onCancel`; the parent closes the dialog by changing `isOpen`. Amounts written
 * with `$` in the description are read as pesos. Never open it while a `Sheet` is still
 * visible: two modal windows at once leave the focus in the one that is closing.
 */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isReducedMotion = useReducedMotion();
  const question = useRef<ComponentRef<typeof Text>>(null);
  const focusQuestion = () => {
    if (question.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(question.current, 'focus');
    }
  };
  return (
    <Modal
      testID="confirm-dialog-modal"
      visible={isOpen}
      transparent
      animationType={isReducedMotion ? 'none' : 'fade'}
      onRequestClose={onCancel}
      onShow={focusQuestion}
      statusBarTranslucent
    >
      <View accessibilityViewIsModal className="flex-1 items-center justify-center px-4">
        <Pressable
          testID="confirm-dialog-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={onCancel}
          className="absolute inset-0 bg-backdrop"
        />
        <View className="w-full gap-6 rounded-3xl border-2 border-border bg-overlay p-4 shadow-sticker">
          <View className="gap-2">
            <Text
              ref={question}
              accessibilityRole="header"
              className="font-semibold text-heading text-foreground"
            >
              {title}
            </Text>
            {description === undefined ? null : (
              <Text accessibilityLabel={spokenPesos(description)} className="text-base text-muted">
                {description}
              </Text>
            )}
          </View>
          <View className="gap-3">
            {isDestructive ? (
              <DeleteButton label={confirmLabel} isFilled onPress={onConfirm} />
            ) : (
              <PrimaryButton label={confirmLabel} onPress={onConfirm} />
            )}
            <SecondaryButton label={cancelLabel} onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
