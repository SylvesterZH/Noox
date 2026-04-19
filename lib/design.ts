/**
 * Noox Design System
 * Based on Stitch's design specification
 */

import { Platform, useColorScheme } from 'react-native';

// ─── Color Tokens ────────────────────────────────────────────────────────────

export const lightColors = {
  // Surface layers (lightest to darkest)
  surfaceBright: '#fcf9f2',
  surface: '#fcf9f2',
  background: '#fcf9f2',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f6f3ec',
  surfaceContainer: '#f1eee7',
  surfaceContainerHigh: '#ebe8e1',
  surfaceContainerHighest: '#e5e2db',
  surfaceDim: '#dcdad3',
  // On surfaces
  onSurface: '#1c1c18',
  onSurfaceVariant: '#53433e',
  outline: '#85736d',
  outlineVariant: '#d8c2bb',
  // Primary
  primary: '#894c34',
  primaryContainer: '#a6644a',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#fffbff',
  inversePrimary: '#ffb59a',
  // Secondary
  secondary: '#78574b',
  secondaryContainer: '#ffd3c4',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#7a594d',
  // Tertiary
  tertiary: '#0f6762',
  tertiaryContainer: '#33807b',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#f3fffd',
  // Error
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  onErrorContainer: '#93000a',
  // Inverse
  inverseSurface: '#31312c',
  inverseOnSurface: '#f3f0e9',
  // Surfaces (with tint for Material You)
  surfaceTint: '#8b4e36',
};

export const darkColors = {
  // Surface layers
  surfaceBright: '#1c1c18',
  surface: '#1c1c18',
  background: '#1c1c18',
  surfaceContainerLowest: '#141413',
  surfaceContainerLow: '#1f1f1b',
  surfaceContainer: '#252521',
  surfaceContainerHigh: '#2a2a24',
  surfaceContainerHighest: '#2f2f2a',
  surfaceDim: '#252521',
  // On surfaces
  onSurface: '#e5e2db',
  onSurfaceVariant: '#d8c2bb',
  outline: '#a0918b',
  outlineVariant: '#53433e',
  // Primary
  primary: '#c27b60',
  primaryContainer: '#6b3520',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#ffdbce',
  inversePrimary: '#894c34',
  // Secondary
  secondary: '#e8bdae',
  secondaryContainer: '#5e4035',
  onSecondary: '#442b23',
  onSecondaryContainer: '#ffdbce',
  // Tertiary
  tertiary: '#89d4cd',
  tertiaryContainer: '#00504c',
  onTertiary: '#003734',
  onTertiaryContainer: '#a5f0e9',
  // Error
  error: '#ffb4ab',
  errorContainer: '#93000a',
  onError: '#690005',
  onErrorContainer: '#ffdad6',
  // Inverse
  inverseSurface: '#e5e2db',
  inverseOnSurface: '#31312c',
  surfaceTint: '#ffb59a',
};

export type Colors = typeof lightColors;

// ─── Font Families ───────────────────────────────────────────────────────────
// Custom font: TMincho-GT01 (supports both Chinese and English)
// Fallback to System for Android

export const fontFamilies = {
  headline: Platform.select({
    ios: 'TMincho-GT01',
    android: 'sans-serif',
    default: 'TMincho-GT01'
  }) as string,
  body: Platform.select({
    ios: 'TMincho-GT01',
    android: 'sans-serif',
    default: 'TMincho-GT01'
  }) as string,
  label: Platform.select({
    ios: 'TMincho-GT01',
    android: 'sans-serif',
    default: 'TMincho-GT01'
  }) as string,
};

// ─── Font Sizes ──────────────────────────────────────────────────────────────

export const fontSizes = {
  // Labels / meta
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  // Headlines
  '2xl': 22,
  '3xl': 26,
  '4xl': 32,
};

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTheme() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? darkColors : lightColors;
  return { isDark, colors };
}

// ─── Default export ───────────────────────────────────────────────────────────

export default { lightColors, darkColors, fontFamilies, fontSizes, spacing, useTheme };
