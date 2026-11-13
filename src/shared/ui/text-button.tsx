import { ButtonBase, type ButtonBaseProps } from './button-base';

/** Props of {@link TextButton}. */
export interface TextButtonProps extends ButtonBaseProps {
  readonly isDisabled?: boolean;
}

/** Minor action ("Ver todas", "Agregar costo"): accent text without fill or border, at least 48 tall. */
export function TextButton(props: TextButtonProps) {
  return <ButtonBase {...props} tone="text" />;
}
