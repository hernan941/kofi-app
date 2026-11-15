import { Switch, useThemeColor } from 'heroui-native';
import { Pressable, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/** Props of {@link SwitchRow}. */
export interface SwitchRowProps {
  readonly title: string;
  readonly description?: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
  readonly isDisabled?: boolean;
}

/**
 * Setting that is turned on or off ("Recordatorio semanal"): title, optional description and
 * the HeroUI `Switch` on the right. The whole row (at least 56 tall) toggles the value, and
 * for the screen reader it is a single `switch` named by the title, with the description as
 * hint. On: accent track and `accent-foreground` thumb. Off: `background` track with a 2 px
 * `field-border` outline and a `muted` thumb, so the state is also read from the thumb side.
 * The thumb jumps without animation when the system asks to reduce motion.
 */
export function SwitchRow({
  title,
  description,
  value,
  onChange,
  isDisabled = false,
}: SwitchRowProps) {
  const [background, muted, accent, accentForeground] = useThemeColor([
    'background',
    'muted',
    'accent',
    'accent-foreground',
  ]);
  const isReducedMotion = useReducedMotion();
  const toggle = () => {
    onChange(!value);
  };

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={toggle}
      className="min-h-14 flex-row items-center gap-3 px-4 py-3"
    >
      <View className="flex-1 gap-0.5">
        <Text className="font-medium text-base text-foreground">{title}</Text>
        {description === undefined ? null : (
          <Text className="text-sm text-muted">{description}</Text>
        )}
      </View>
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Switch
          testID="switch-row-control"
          isSelected={value}
          onSelectedChange={onChange}
          isDisabled={isDisabled}
          animation={{
            backgroundColor: { value: [background, accent] },
            state: isReducedMotion ? 'disable-all' : true,
          }}
          className={`border-2 shadow-none ${value ? 'border-transparent' : 'border-field-border'}`}
        >
          <Switch.Thumb
            animation={{ backgroundColor: { value: [muted, accentForeground] } }}
            className="shadow-none"
          />
        </Switch>
      </View>
    </Pressable>
  );
}
