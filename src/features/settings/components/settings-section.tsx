import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/** Props of {@link SettingsSection}. */
export interface SettingsSectionProps {
  readonly heading: string;
  readonly children: ReactNode;
}

/** Section of Ajustes: a heading (role `header`) and its content below, which may or may not be a card. */
export function SettingsSection({ heading, children }: SettingsSectionProps) {
  return (
    <View className="gap-3">
      <Text accessibilityRole="header" className="font-semibold text-heading text-foreground">
        {heading}
      </Text>
      {children}
    </View>
  );
}
