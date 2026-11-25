import {
  FieldError,
  Input,
  InputGroup,
  TextField as HeroTextField,
  type InputRef,
} from 'heroui-native';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { useState, type Ref } from 'react';
import {
  Text,
  View,
  type NativeSyntheticEvent,
  type TargetedEvent,
  type TextInputProps,
} from 'react-native';

import { useAnnounceWhen } from './announce';
import { useFieldFocusReporting } from './form-layout';
import { Icon } from './icon';

/** Props of {@link TextField}; the remaining `TextInput` props pass through. */
export interface TextFieldProps extends Omit<
  TextInputProps,
  | 'style'
  | 'className'
  | 'editable'
  | 'value'
  | 'onChangeText'
  | 'accessibilityHint'
  | 'placeholderTextColor'
> {
  readonly label: string;
  /** Name read by the screen reader when it must say more than the visible `label`, for example "Precio de cada uno de Lámina Colibrí". */
  readonly accessibilityLabel?: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly error?: string;
  readonly helper?: string;
  readonly isOptional?: boolean;
  /**
   * Asked when an error appears: return `false` when a form summary already announces it.
   * Defaults to always announcing.
   */
  readonly canAnnounceError?: () => boolean;
  readonly isDisabled?: boolean;
  readonly prefix?: string;
  readonly ref?: Ref<InputRef>;
}

const INPUT_BASE =
  'min-h-12 rounded-field border-2 bg-field-background px-3 py-3 text-base font-normal text-field-foreground android:border-2 android:[elevation:0] ios:shadow-none ios:outline-transparent ios:focus:outline-transparent';

/**
 * Border classes for each state. HeroUI 1.0.11 gives the Android `Input` a transparent
 * border without focus, so the `android:` classes force the Bruma border back.
 */
function borderClasses(isInvalid: boolean, isFocused: boolean): string {
  if (isInvalid) {
    return 'border-danger android:border-danger android:focus:border-danger';
  }
  if (isFocused) {
    return 'border-accent android:border-accent android:focus:border-accent';
  }
  return 'border-field-border android:border-field-border android:focus:border-accent';
}

/**
 * Text field of the design system (6.3) on top of the HeroUI `TextField` and `Input`. The
 * label is always visible above the field; optional fields say "(opcional)". The border is
 * `field-border`, turns `accent` with focus and `danger` with an error. The error shows
 * the `WarningCircle` icon with the message, is announced when it appears and is tied to
 * the field as its accessibility hint; the help text takes that place while there is no
 * error. With `prefix`, a fixed text (like `$`) sits at the start of the field.
 */
export function TextField({
  label,
  accessibilityLabel,
  value,
  onChangeText,
  error,
  helper,
  isOptional = false,
  canAnnounceError,
  isDisabled = false,
  prefix,
  ref,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const { ref: fieldRef, notifyFocus, notifyBlur } = useFieldFocusReporting();
  const isInvalid = Boolean(error);
  const fullLabel = isOptional ? `${label} (opcional)` : label;
  useAnnounceWhen(error, canAnnounceError);

  const handleFocus = (event: NativeSyntheticEvent<TargetedEvent>) => {
    setIsFocused(true);
    notifyFocus();
    onFocus?.(event);
  };
  const handleBlur = (event: NativeSyntheticEvent<TargetedEvent>) => {
    setIsFocused(false);
    notifyBlur();
    onBlur?.(event);
  };

  const sharedInputProps = {
    ...inputProps,
    ref,
    value,
    onChangeText,
    onFocus: handleFocus,
    onBlur: handleBlur,
    variant: 'primary',
    isInvalid,
    isDisabled,
    accessibilityLabel: accessibilityLabel ?? fullLabel,
    accessibilityHint: error ?? helper,
    className: `${INPUT_BASE} ${borderClasses(isInvalid, isFocused)}`,
  } as const;

  return (
    <View ref={fieldRef} collapsable={false}>
      <HeroTextField isInvalid={isInvalid} isDisabled={isDisabled} className="gap-2">
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="font-medium text-sm text-foreground"
        >
          {fullLabel}
        </Text>
        {prefix === undefined ? (
          <Input {...sharedInputProps} />
        ) : (
          <InputGroup>
            <InputGroup.Prefix isDecorative>
              <Text className="font-medium text-base text-muted">{prefix}</Text>
            </InputGroup.Prefix>
            <InputGroup.Input {...sharedInputProps} />
          </InputGroup>
        )}
        <FieldError>
          <View className="flex-row items-start gap-1">
            <View className="pt-0.5">
              <Icon icon={WarningCircleIcon} size="sm" color="danger" />
            </View>
            <Text className="flex-1 text-sm text-danger">{error}</Text>
          </View>
        </FieldError>
        {helper !== undefined && !isInvalid ? (
          <Text className="text-sm text-muted">{helper}</Text>
        ) : null}
      </HeroTextField>
    </View>
  );
}
