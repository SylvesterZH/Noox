/**
 * Processing Indicator
 * 显示在导航栏下方的状态条，表示正在处理中
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme, fontSizes, spacing } from '../lib/design';

interface ProcessingIndicatorProps {
  message?: string;
}

export default function ProcessingIndicator({
  message = 'Processing...',
}: ProcessingIndicatorProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryContainer }]}>
      <View style={styles.content}>
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
        <Text style={[styles.text, { color: colors.onPrimaryContainer }]}>
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
});