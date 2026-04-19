/**
 * Management Section - Top stats card
 * Shows Consumption (current/max) and Platforms (count)
 * Based on Stitch's design
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, fontSizes, spacing } from '../lib/design';

interface ManagementSectionProps {
  currentCount: number;
  maxCount: number;
  platformCount: number;
  platformIcons?: string[];
}

export default function ManagementSection({
  currentCount,
  maxCount,
  platformCount,
  platformIcons = [],
}: ManagementSectionProps) {
  const { colors } = useTheme();
  const progress = Math.min((currentCount / maxCount) * 100, 100);

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceContainerLow }]}>
      <View style={styles.inner}>
        {/* Left: Consumption */}
        <View style={[styles.section, styles.leftSection]}>
          <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>
            Consumption
          </Text>
          <View style={styles.countRow}>
            <Text style={[styles.count, { color: colors.primary }]}>{currentCount}</Text>
            <Text style={[styles.countDivider, { color: colors.onSurfaceVariant }]}>
              / {maxCount}
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.outlineVariant }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.primary, width: `${progress}%` },
              ]}
            />
          </View>
        </View>

        {/* Right: Platforms */}
        <View style={[styles.section, styles.rightSection]}>
          <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>
            Platforms
          </Text>
          <View style={styles.platformRow}>
            <Text style={[styles.count, { color: colors.onSurface }]}>{platformCount}</Text>
            <Text style={[styles.connectedLabel, { color: colors.onSurfaceVariant }]}>
              Connected
            </Text>
          </View>
          <View style={styles.iconsRow}>
            {platformIcons.slice(0, 4).map((icon, idx) => (
              <View
                key={idx}
                style={[
                  styles.iconBadge,
                  { backgroundColor: colors.surfaceContainerHighest },
                ]}
              >
                <MaterialIcons name={icon as any} size={14} color={colors.onSurfaceVariant} />
              </View>
            ))}
            {platformIcons.length > 4 && (
              <View
                style={[
                  styles.iconBadge,
                  { backgroundColor: colors.surfaceContainerHighest },
                ]}
              >
                <Text style={[styles.moreText, { color: colors.onSurfaceVariant }]}>
                  +{platformIcons.length - 4}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  inner: {
    flexDirection: 'row',
  },
  section: {
    flex: 1,
  },
  leftSection: {
    paddingRight: spacing.lg,
    borderRightWidth: 1,
    borderRightColor: 'rgba(216,194,187,0.15)',
  },
  rightSection: {
    paddingLeft: spacing.lg,
  },
  label: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.xs,
  },
  count: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    lineHeight: 28,
  },
  countDivider: {
    fontSize: fontSizes.md,
    lineHeight: 24,
    marginLeft: 2,
    marginBottom: 1,
  },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  connectedLabel: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  iconsRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    gap: 4,
  },
  iconBadge: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  moreText: {
    fontSize: 8,
    fontWeight: '700',
  },
});
