/**
 * Settings Screen
 * Based on Stitch's new design
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fontSizes, spacing } from '../../lib/design';
import { getCategories } from '../../lib/api';
import { Category } from '../../types';
import { useAuth } from '../../context/AuthContext';

const CATEGORY_COLORS: Record<string, string> = {
  Tech: '#3B82F6',
  Product: '#8B5CF6',
  Startup: '#10B981',
  Life: '#F59E0B',
};

export default function SettingsScreen() {
  const { colors, isDark } = useTheme();
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<Category[]>([]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user]);

  useEffect(() => {
    getCategories()
      .then((res) => setCategories(res.categories))
      .catch(console.error);
  }, []);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/login');
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.md,
            backgroundColor: isDark ? 'rgba(28,27,31,0.85)' : 'rgba(252,249,242,0.85)',
            borderBottomColor: colors.surfaceContainerLow,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.onSurface }]}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Categories Section */}
        <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>
          Categories
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surfaceContainerLow },
          ]}
        >
          {categories.map((cat, idx) => (
            <View
              key={cat.id}
              style={[
                styles.row,
                idx < categories.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.outlineVariant,
                },
              ]}
            >
              <View
                style={[
                  styles.colorDot,
                  { backgroundColor: CATEGORY_COLORS[cat.name] || cat.color },
                ]}
              />
              <Text style={[styles.categoryName, { color: colors.onSurface }]}>
                {cat.name}
              </Text>
              {cat.is_preset && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: colors.surfaceContainerHighest },
                  ]}
                >
                  <Text
                    style={[styles.badgeText, { color: colors.onSurfaceVariant }]}
                  >
                    Preset
                  </Text>
                </View>
              )}
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={colors.onSurfaceVariant}
              />
            </View>
          ))}
          {categories.length === 0 && (
            <View style={styles.emptyRow}>
              <Text style={{ color: colors.onSurfaceVariant }}>
                No categories yet
              </Text>
            </View>
          )}
        </View>

        {/* Account Section */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.onSurfaceVariant, marginTop: spacing.xl },
          ]}
        >
          Account
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surfaceContainerLow },
          ]}
        >
          <TouchableOpacity style={styles.row} onPress={handleSignOut}>
            <MaterialIcons name="logout" size={20} color={colors.error} />
            <Text style={[styles.label, { color: colors.error, flex: 1 }]}>
              Sign Out
            </Text>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.onSurfaceVariant, marginTop: spacing.xl },
          ]}
        >
          About
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surfaceContainerLow },
          ]}
        >
          <View
            style={[
              styles.row,
              { borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
            ]}
          >
            <MaterialIcons
              name="info-outline"
              size={20}
              color={colors.onSurfaceVariant}
            />
            <Text style={[styles.label, { color: colors.onSurface }]}>
              Version
            </Text>
            <Text style={[styles.value, { color: colors.onSurfaceVariant }]}>
              1.0.0
            </Text>
          </View>
          <View style={styles.row}>
            <MaterialIcons
              name="cloud-done"
              size={20}
              color={colors.onSurfaceVariant}
            />
            <Text style={[styles.label, { color: colors.onSurface }]}>
              API Status
            </Text>
            <View style={styles.statusBadge}>
              <View
                style={[styles.statusDot, { backgroundColor: '#10B981' }]}
              />
              <Text style={[styles.statusText, { color: '#10B981' }]}>
                Connected
              </Text>
            </View>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={[styles.appName, { color: colors.primary }]}>NOOX</Text>
          <Text style={[styles.appTagline, { color: colors.onSurfaceVariant }]}>
            Your second brain, indexed.
          </Text>
        </View>

        {/* Bottom padding for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    letterSpacing: 2,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyRow: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  categoryName: {
    flex: 1,
    fontSize: fontSizes.md,
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  label: {
    flex: 1,
    fontSize: fontSizes.md,
  },
  value: {
    fontSize: fontSizes.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  appInfo: {
    alignItems: 'center',
    marginTop: spacing['3xl'],
    gap: spacing.xs,
  },
  appName: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    letterSpacing: 2,
  },
  appTagline: {
    fontSize: fontSizes.sm,
  },
});