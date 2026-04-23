/**
 * Skeleton Item Card
 * 骨架屏占位卡片，用于显示正在保存中的内容
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { spacing } from '../lib/design';

// 骨架屏颜色
const SKELETON_COLOR = 'rgb(216, 194, 187)';
const SKELETON_LIGHT = 'rgb(237, 226, 220)';

interface SkeletonItemProps {
  url?: string;
}

export default function SkeletonItem({ url }: SkeletonItemProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 闪烁动画：从左到右扫过
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [0.3, 0.6, 0.6, 0.3],
  });

  return (
    <View style={styles.container}>
      {/* Meta row: platform icon + text lines */}
      <View style={styles.metaRow}>
        <Animated.View
          style={[
            styles.skeletonIcon,
            { opacity: shimmerOpacity },
          ]}
        />
        <Animated.View
          style={[
            styles.skeletonText,
            styles.skeletonTextShort,
            { opacity: shimmerOpacity },
          ]}
        />
      </View>

      {/* Title */}
      <Animated.View
        style={[
          styles.skeletonText,
          styles.skeletonTitle,
          { opacity: shimmerOpacity },
        ]}
      />

      {/* Summary lines - 4.5 lines */}
      <View style={styles.summaryArea}>
        <Animated.View
          style={[
            styles.skeletonLine,
            styles.fullWidth,
            { opacity: shimmerOpacity },
          ]}
        />
        <Animated.View
          style={[
            styles.skeletonLine,
            styles.fullWidth,
            { opacity: shimmerOpacity },
          ]}
        />
        <Animated.View
          style={[
            styles.skeletonLine,
            styles.fullWidth,
            { opacity: shimmerOpacity },
          ]}
        />
        <Animated.View
          style={[
            styles.skeletonLine,
            styles.fullWidth,
            { opacity: shimmerOpacity },
          ]}
        />
        <Animated.View
          style={[
            styles.skeletonLine,
            styles.halfWidth,
            { opacity: shimmerOpacity },
          ]}
        />
      </View>

      {/* Footer line */}
      <Animated.View
        style={[
          styles.skeletonFooter,
          { opacity: shimmerOpacity },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
    marginBottom: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  skeletonIcon: {
    width: 16,
    height: 16,
    backgroundColor: SKELETON_COLOR,
  },
  skeletonText: {
    height: 16,
    backgroundColor: SKELETON_COLOR,
  },
  skeletonTextShort: {
    width: 60,
  },
  skeletonTitle: {
    width: '85%',
    height: 26,
    marginBottom: spacing.md,
  },
  summaryArea: {
    gap: spacing.sm,
  },
  skeletonLine: {
    height: 16,
    backgroundColor: SKELETON_COLOR,
  },
  fullWidth: {
    width: '100%',
  },
  halfWidth: {
    width: '55%',
  },
  skeletonFooter: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: SKELETON_LIGHT,
    width: 80,
    height: 14,
  },
});
