/**
 * Font loading for custom fonts
 */

import { useState } from 'react';
import { View, ActivityIndicator, TextStyle, ViewStyle } from 'react-native';
import { useFonts } from 'expo-font';

// Font files to load - make sure these are in assets/fonts/
const fontsToLoad = {
  'TMincho-GT01': require('../../assets/fonts/TMincho-GT01.ttc'),
};

interface FontLoaderProps {
  children: React.ReactNode;
}

export default function FontLoader({ children }: FontLoaderProps) {
  const [fontsLoaded] = useFonts(fontsToLoad);

  if (!fontsLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#894C34" />
      </View>
    );
  }

  return children;
}

const styles: { container: ViewStyle } = {
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FCF9F2',
  },
};