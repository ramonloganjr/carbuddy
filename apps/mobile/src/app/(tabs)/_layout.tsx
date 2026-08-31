import React, { useState } from 'react';
import { View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import {
  FAB,
  FABMenu,
  Pressable,
  Text,
  springConfig,
  useTheme,
  type FABMenuAction,
} from '../../design-system';

/**
 * Material 3 navigation bar.
 *
 * Built rather than themed because the M3 active indicator — the pill that
 * slides behind the selected icon — is not something the default tab bar can
 * express, and it is the clearest signal of which section you are in.
 *
 * Five destinations, matching the product's five nouns: your dashboard, your
 * fuel, your servicing, your paperwork, your cars.
 */
const TAB_ICONS: Record<
  string,
  { active: keyof typeof MaterialIcons.glyphMap; inactive: keyof typeof MaterialIcons.glyphMap }
> = {
  index: { active: 'dashboard', inactive: 'dashboard' },
  fuel: { active: 'local-gas-station', inactive: 'local-gas-station' },
  maintenance: { active: 'build', inactive: 'build' },
  documents: { active: 'folder', inactive: 'folder-open' },
  garage: { active: 'directions-car', inactive: 'directions-car' },
};

const TAB_LABELS: Record<string, string> = {
  index: 'Home',
  fuel: 'Fuel',
  maintenance: 'Service',
  documents: 'Documents',
  garage: 'Garage',
};

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <NavigationBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="fuel" options={{ title: 'Fuel' }} />
      <Tabs.Screen name="maintenance" options={{ title: 'Service' }} />
      <Tabs.Screen name="documents" options={{ title: 'Documents' }} />
      <Tabs.Screen name="garage" options={{ title: 'Garage' }} />
    </Tabs>
  );
}

function NavigationBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  /**
   * One action button, six destinations.
   *
   * The alternative — a separate "add" button on each tab — means the user has
   * to be on the right screen before they can log anything. Logging a fill-up
   * happens standing at a pump, so it has to be reachable from wherever the app
   * happened to be.
   */
  const actions: FABMenuAction[] = [
    { icon: 'local-gas-station', label: 'Fuel', onPress: () => router.push('/fuel/new') },
    { icon: 'build', label: 'Service', onPress: () => router.push('/maintenance/new') },
    { icon: 'receipt-long', label: 'Expense', onPress: () => router.push('/expenses/new') },
    { icon: 'description', label: 'Document', onPress: () => router.push('/documents/new') },
    { icon: 'speed', label: 'Odometer', onPress: () => router.push('/odometer/new') },
    {
      icon: 'notifications-active',
      label: 'Reminder',
      onPress: () => router.push('/reminders/new'),
    },
  ];

  return (
    <>
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          right: 16,
          bottom: insets.bottom + 92,
          alignItems: 'flex-end',
        }}
      >
        <FABMenu open={menuOpen} actions={actions} onDismiss={() => setMenuOpen(false)} />
        <FAB
          icon={menuOpen ? 'close' : 'add'}
          label={menuOpen ? undefined : 'Add'}
          accessibilityLabel={menuOpen ? 'Close add menu' : 'Add a record'}
          onPress={() => setMenuOpen((open) => !open)}
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          paddingBottom: insets.bottom,
          paddingTop: 12,
          backgroundColor: theme.colors.surfaceContainer,
        }}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const icons = TAB_ICONS[route.name];
          const label = TAB_LABELS[route.name] ?? route.name;
          if (!icons) return null;

          return (
            <TabItem
              key={route.key}
              label={label}
              icon={focused ? icons.active : icons.inactive}
              focused={focused}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
            />
          );
        })}
      </View>
    </>
  );
}

function TabItem({
  label,
  icon,
  focused,
  onPress,
}: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  focused: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const indicator = useSharedValue(focused ? 1 : 0);

  indicator.value = focused ? 1 : 0;

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: withSpring(indicator.value, springConfig('fastEffects', theme.reduceMotion)),
    transform: [
      {
        scaleX: theme.reduceMotion
          ? 1
          : withSpring(
              0.6 + indicator.value * 0.4,
              springConfig('defaultSpatial', theme.reduceMotion),
            ),
      },
    ],
  }));

  return (
    <Pressable
      onPress={onPress}
      haptic="selection"
      shape="none"
      ensureTouchTarget={false}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      style={{ flex: 1, alignItems: 'center', gap: 4, paddingBottom: 12, minHeight: 56 }}
    >
      <View style={{ width: 64, height: 32, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: 64,
              height: 32,
              borderRadius: 16,
              backgroundColor: theme.colors.secondaryContainer,
            },
            indicatorStyle,
          ]}
        />
        <MaterialIcons
          name={icon}
          size={24}
          color={focused ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant}
        />
      </View>
      <Text
        variant="labelMedium"
        style={{ color: focused ? theme.colors.onSurface : theme.colors.onSurfaceVariant }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
