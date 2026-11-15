import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';

import { ButtonBase } from './button-base';

/** Props of {@link DeleteButton}. */
export interface DeleteButtonProps {
  readonly onPress: () => void;
  readonly label?: string;
  readonly isFilled?: boolean;
  readonly isDisabled?: boolean;
  readonly accessibilityHint?: string;
  readonly accessibilityLabel?: string;
}

/**
 * Destructive action, always followed by a confirmation. It carries the `Trash` icon and
 * the word "Borrar" (or "Eliminar"), so it never depends on color alone. The filled
 * version is the final button of the confirmation dialog.
 */
export function DeleteButton({ label = 'Borrar', isFilled = false, ...props }: DeleteButtonProps) {
  return (
    <ButtonBase
      {...props}
      label={label}
      icon={TrashIcon}
      tone={isFilled ? 'danger-filled' : 'danger'}
    />
  );
}
