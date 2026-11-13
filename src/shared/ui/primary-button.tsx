import { ButtonBase, type ButtonBaseProps } from './button-base';

/** Props of {@link PrimaryButton}: there is no disabled state on purpose. */
export type PrimaryButtonProps = ButtonBaseProps;

/**
 * The single main action of a screen ("Registrar venta", "Guardar"): accent fill, sticker
 * border and shadow, full width and at least 52 tall. It is **never disabled**: when data
 * is missing, pressing it shows the errors (see `createSubmitHandler`).
 */
export function PrimaryButton({
  label,
  onPress,
  icon,
  accessibilityHint,
  ref,
}: PrimaryButtonProps) {
  return (
    <ButtonBase
      label={label}
      onPress={onPress}
      icon={icon}
      accessibilityHint={accessibilityHint}
      tone="primary"
      ref={ref}
    />
  );
}
