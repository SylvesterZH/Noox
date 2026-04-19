/**
 * Keyboard Dismiss View
 * 点击空白区域自动收起键盘
 */

import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Keyboard } from 'react-native';

interface KeyboardDismissViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function KeyboardDismissView({ children, style }: KeyboardDismissViewProps) {
  return (
    <Pressable
      style={style}
      onPress={() => Keyboard.dismiss()}
    >
      {children}
    </Pressable>
  );
}