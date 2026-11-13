import '../global.css';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useThemeColor } from 'heroui-native';

import { createAppDependencies } from '@/core/dependencies/create-app-dependencies';
import { AppProviders } from '@/core/providers/app-providers';

void SplashScreen.preventAutoHideAsync();

const composition = createAppDependencies();

/** Navegador raíz; el fondo sale del tema para que no aparezca blanco en modo oscuro. */
function RootNavigator() {
  const background = useThemeColor('background');
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }}
      />
    </>
  );
}

/**
 * Root layout: keeps the splash visible, composes the real dependencies once and mounts the
 * providers (`MigrationGate` included) around the navigation stack.
 */
export default function RootLayout() {
  return (
    <AppProviders composition={composition}>
      <RootNavigator />
    </AppProviders>
  );
}
