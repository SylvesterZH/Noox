/**
 * Bottom Navigation Bar
 * Based on Stitch's design: minimal, icon-only labels below, border-top on active
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useTheme, fontSizes } from '../lib/design';

const TAB_CONFIG = [
  {
    name: 'index',
    icon: 'view-list' as const,
    label: 'Feed',
  },
  {
    name: 'search',
    icon: 'search' as const,
    label: 'Search',
  },
  {
    name: 'settings',
    icon: 'settings' as const,
    label: 'Settings',
  },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors, isDark } = useTheme();

  const isActive = (tabName: string) => {
    if (tabName === 'index') {
      return pathname === '/' || pathname === '/(tabs)';
    }
    return pathname.includes(tabName);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.surface : colors.surface,
          borderTopColor: colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.inner}>
        {TAB_CONFIG.map((tab) => {
          const active = isActive(tab.name);
          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.tabItem, active && styles.activeTab]}
              onPress={() => router.push(tab.name === 'index' ? '/' : `/${tab.name}`)}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={tab.icon}
                size={24}
                color={
                  active
                    ? colors.primary
                    : isDark
                    ? 'rgba(252,249,242,0.4)'
                    : 'rgba(28,28,24,0.4)'
                }
              />
              <Text
                style={[
                  styles.label,
                  {
                    color: active
                      ? colors.primary
                      : isDark
                      ? 'rgba(252,249,242,0.4)'
                      : 'rgba(28,28,24,0.4)',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(216,194,187,0.15)',
    zIndex: 50,
  },
  inner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: -9,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingHorizontal: 16,
    minWidth: 72,
  },
  activeTab: {},
  label: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
  },
});
