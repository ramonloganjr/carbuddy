import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, SnackbarProvider, useTheme } from '../design-system';
import { getDatabase } from '../data/db/database';
import { configureNotificationChannels } from '../lib/notifications';
import { useSession } from '../features/auth/sessionStore';
import { usePreferences } from '../features/settings/preferencesStore';
import { startNetworkWatcher, useSync } from '../features/sync/syncStore';
import { AppLock } from '../features/auth/AppLock';
import { resolveDeepLink } from '../lib/deepLinks';

// Held until the database is open and the session restored, so the first frame
// is the real UI rather than a flash of empty state.
void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The local database is the source of truth, so a network refetch on
      // every focus would be wasted work and battery.
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const restore = useSession((state) => state.restore);
  const preferences = usePreferences((state) => state.preferences);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        // Order matters: the database must exist before anything reads it.
        await getDatabase();
        await configureNotificationChannels();
        await restore();
      } catch (error) {
        // A failure here still has to release the splash screen — a permanently
        // stuck splash is worse than an app showing an error state.
        console.warn('Startup failed', error);
      } finally {
        if (!cancelled) {
          setReady(true);
          await SplashScreen.hideAsync().catch(() => undefined);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restore]);

  useEffect(() => startNetworkWatcher(), []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider
            settings={{
              mode: preferences?.themeMode ?? 'system',
              dynamic: preferences?.dynamicColour ?? false,
            }}
          >
            <SnackbarProvider>
              <ThemedShell />
            </SnackbarProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedShell() {
  const theme = useTheme();
  const router = useRouter();
  const syncNow = useSync((state) => state.syncNow);

  /**
   * Route a notification tap to the record it is about.
   *
   * Handles both the cold-start case (app launched *by* the notification) and
   * the warm case. Missing the cold-start path is a classic bug: the user taps
   * "Insurance expires tomorrow", the app opens on the dashboard, and the
   * notification may as well not have been tappable.
   */
  const openDeepLink = useCallback(
    (url: string | undefined) => {
      const route = resolveDeepLink(url);
      if (route) router.push(route as never);
    },
    [router],
  );

  useEffect(() => {
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const data = response?.notification.request.content.data as { deepLink?: string } | undefined;
      openDeepLink(data?.deepLink);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { deepLink?: string } | undefined;
      openDeepLink(data?.deepLink);
    });

    const linkSubscription = Linking.addEventListener('url', (event) => openDeepLink(event.url));

    return () => {
      subscription.remove();
      linkSubscription.remove();
    };
  }, [openDeepLink]);

  useEffect(() => {
    void syncNow({ silent: true });
  }, [syncNow]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <AppLock>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.surface },
            // Reduced motion gets a fade instead of a slide; the transition is
            // still perceptible, it just does not travel.
            animation: theme.reduceMotion ? 'fade' : 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="vehicle/[id]/edit"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
        </Stack>
      </AppLock>
    </View>
  );
}
