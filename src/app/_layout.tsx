import '../global.css';

import { useCallback } from 'react';
import { Stack, useRootNavigationState, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useThemeColor } from 'heroui-native';

import { createAppDependencies } from '@/core/dependencies/create-app-dependencies';
import { AppProviders } from '@/core/providers/app-providers';
import {
  NotificationsHost,
  openNotificationTarget,
  type NotificationTarget,
} from '@/features/notifications';

void SplashScreen.preventAutoHideAsync();

const composition = createAppDependencies();

/** Navegador raíz; el fondo sale del tema para que no aparezca blanco en modo oscuro. */
function RootNavigator() {
  const background = useThemeColor('background');
  const router = useRouter();
  const navigationReady = Boolean(useRootNavigationState().key);
  const openTarget = useCallback(
    (target: NotificationTarget | null) => {
      openNotificationTarget(router, target);
    },
    [router],
  );
  return (
    <>
      <NotificationsHost navigationReady={navigationReady} onOpen={openTarget} />
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }}>
        <Stack.Screen name="notifications/intro" options={{ presentation: 'modal' }} />
      </Stack>
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
