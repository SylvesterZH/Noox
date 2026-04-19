/**
 * KeyboardAvoiding Modal Wrapper
 * 处理弹窗被键盘挡住的问题
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Keyboard, Platform, Animated, KeyboardEvent, ViewStyle } from 'react-native';

interface KeyboardAvoidingModalProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function KeyboardAvoidingModal({ children, style }: KeyboardAvoidingModalProps) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [animatedValue] = useState(new Animated.Value(0));

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showListener = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
      const height = e.endCoordinates.height;
      setKeyboardHeight(height);
      Animated.timing(animatedValue, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });

    const hideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, [animatedValue]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ translateY: animatedValue }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}