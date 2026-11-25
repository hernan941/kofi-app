import { Tabs } from 'expo-router';

import { perfMark } from '@/shared/lib/perf-marks';
import {
  CalendarBlankIcon,
  GearIcon,
  HouseIcon,
  LightbulbIcon,
  PackageIcon,
  TabBarIcon,
  TabBarLabel,
  useTabBarStyle,
} from '@/shared/ui';

/** Tab bar layout (design system 6.9): five tabs with always-visible labels. */
export default function TabsLayout() {
  const tabBarStyle = useTabBarStyle();
  return (
    <Tabs
      screenListeners={({ route }) => ({
        tabPress: () => {
          if (process.env.EXPO_PUBLIC_E2E === '1') {
            perfMark('tab:press', route.name);
          }
        },
      })}
      screenOptions={{
        headerShown: false,
        tabBarStyle,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarLabel: ({ focused }) => <TabBarLabel label="Inicio" focused={focused} />,
          tabBarIcon: ({ focused }) => <TabBarIcon icon={HouseIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendario',
          tabBarLabel: ({ focused }) => <TabBarLabel label="Calendario" focused={focused} />,
          tabBarIcon: ({ focused }) => <TabBarIcon icon={CalendarBlankIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Productos',
          tabBarLabel: ({ focused }) => <TabBarLabel label="Productos" focused={focused} />,
          tabBarIcon: ({ focused }) => <TabBarIcon icon={PackageIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tips"
        options={{
          title: 'Consejos',
          tabBarLabel: ({ focused }) => <TabBarLabel label="Consejos" focused={focused} />,
          tabBarIcon: ({ focused }) => <TabBarIcon icon={LightbulbIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarLabel: ({ focused }) => <TabBarLabel label="Ajustes" focused={focused} />,
          tabBarIcon: ({ focused }) => <TabBarIcon icon={GearIcon} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
