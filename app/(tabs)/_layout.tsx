/**
 * Home Layout - Single screen, no tab bar
 * Search is now accessed via floating button (modal)
 * Settings are in the Side Drawer
 */

import { Stack } from 'expo-router';

export default function HomeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
