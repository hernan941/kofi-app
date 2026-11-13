import { Text, View } from 'react-native';

import { Chip } from './chip';

/** One option of a {@link ChipGroup}. */
export interface ChipOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

/** Props shared by both modes of {@link ChipGroup}. */
interface ChipGroupBaseProps<T extends string> {
  readonly label: string;
  readonly options: readonly ChipOption<T>[];
  readonly value: T | null;
}

/** Required choice: one option is always the answer once picked, like a radio group. */
interface RequiredChoiceProps<T extends string> extends ChipGroupBaseProps<T> {
  readonly allowDeselect?: false;
  readonly onChange: (value: T) => void;
}

/** Optional choice: pressing the chosen chip again clears it (`onChange(null)`). */
interface OptionalChoiceProps<T extends string> extends ChipGroupBaseProps<T> {
  readonly allowDeselect: true;
  readonly onChange: (value: T | null) => void;
}

/** Props of {@link ChipGroup}. */
export type ChipGroupProps<T extends string> = RequiredChoiceProps<T> | OptionalChoiceProps<T>;

/**
 * Single choice between a few options shown as chips ("Dónde vendiste", the version of a
 * product). By default it is read as a radio group named by its visible label. With
 * `allowDeselect` (optional answers) a radio cannot be unchecked, so the group is a labelled
 * set of toggle buttons with the `selected` state and pressing the chosen one clears it. The
 * chips wrap onto new lines when they do not fit.
 */
export function ChipGroup<T extends string>(props: ChipGroupProps<T>) {
  const { label, options, value } = props;
  const select = (option: ChipOption<T>) => {
    if (props.allowDeselect === true) {
      props.onChange(option.value === value ? null : option.value);
      return;
    }
    props.onChange(option.value);
  };
  const isDeselectable = props.allowDeselect === true;

  return (
    <View className="gap-2">
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="font-medium text-sm text-foreground"
      >
        {label}
      </Text>
      <View
        accessibilityRole={isDeselectable ? undefined : 'radiogroup'}
        accessibilityLabel={label}
        className="flex-row flex-wrap gap-2"
      >
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            role={isDeselectable ? 'toggle' : 'radio'}
            isSelected={option.value === value}
            onPress={() => {
              select(option);
            }}
          />
        ))}
      </View>
    </View>
  );
}
