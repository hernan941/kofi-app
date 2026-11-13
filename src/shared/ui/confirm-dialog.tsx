import { Dialog } from 'heroui-native';
import { View } from 'react-native';

import { DeleteButton } from './delete-button';
import { PrimaryButton } from './primary-button';
import { SecondaryButton } from './secondary-button';

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
 * Confirmation before an important or destructive action, on top of the HeroUI `Dialog`.
 * The question is the title; the confirm button goes first, filled with `danger` and the
 * `Trash` icon when the action deletes something. Cancel, the backdrop and the Android
 * back button all call `onCancel`; the parent closes the dialog by changing `isOpen`.
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
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <Dialog.Portal className="px-4">
        <Dialog.Overlay />
        <Dialog.Content
          isSwipeable={false}
          className="gap-6 rounded-3xl border-2 border-border bg-overlay p-4 shadow-sticker"
        >
          <View className="gap-2">
            <Dialog.Title className="font-semibold text-heading text-foreground">
              {title}
            </Dialog.Title>
            {description === undefined ? null : (
              <Dialog.Description className="text-base text-muted">
                {description}
              </Dialog.Description>
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
