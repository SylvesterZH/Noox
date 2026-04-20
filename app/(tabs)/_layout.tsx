/**
 * Tabs Layout with Bottom Navigation
 * Using new design system
 */

import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav from '../../components/BottomNav';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' },
          }}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="search" />
          <Tabs.Screen name="settings" />
        </Tabs>
      </View>
      <View style={[styles.navWrapper, { paddingBottom: Platform.OS === 'ios' ? insets.bottom : 0, backgroundColor: '#fcf9f2' }]}>
        <BottomNav />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  navWrapper: {
    backgroundColor: '#fcf9f2',
  },
});