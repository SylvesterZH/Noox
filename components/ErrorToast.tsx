/**
 * Error Toast
 * 从左侧滑入的红色错误提示条
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, fontSizes, spacing } from '../lib/design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ErrorToastProps {
  message: string;
  visible: boolean;
  onDismiss?: () => void;
  duration?: number;
}

export default function ErrorToast({
  message,
  visible,
  onDismiss,
  duration = 3000,
}: ErrorToastProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-Dimensions.get('window').width)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide in from left
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after duration
      if (duration > 0) {
        const timer = setTimeout(() => {
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: -Dimensions.get('window').width,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onDismiss?.();
          });
        }, duration);
        return () => clearTimeout(timer);
      }
    }
  }, [visible, duration, onDismiss, translateX, opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.error,
          top: insets.top + 50,
          transform: [{ translateX }],
          opacity,
        },
      ]}
    >
      <MaterialIcons name="error-outline" size={18} color="#fff" />
      <Text style={styles.text} numberOfLines={1}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    zIndex: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  text: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: '#fff',
  },
});
