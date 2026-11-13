import { ButtonBase, type ButtonBaseProps } from './button-base';

/** Props of {@link SecondaryButton}. */
export interface SecondaryButtonProps extends ButtonBaseProps {
  readonly isDisabled?: boolean;
}

/**
 * Alternative next to the main action ("Esta semana no vendí", "Reintentar"): card fill,
 * sticker border, no shadow, at least 48 tall.
 */
export function SecondaryButton(props: SecondaryButtonProps) {
  return <ButtonBase {...props} tone="secondary" />;
}
