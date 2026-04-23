/**
 * Side Drawer Component
 * Slides in from the left with account info, stats, and settings
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fontSizes, spacing } from '../lib/design';
import { useAuth } from '../context/AuthContext';
import * as WebBrowser from 'expo-web-browser';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.8;
const CARD_BG = '#F5F3EC';
const CARD_BG_DARK = '#2A2420';
const DIVIDER = '#EDE7DF';
const DIVIDER_DARK = '#3D352E';
const PROGRESS_BG = '#D8C2BB';
const PROGRESS_FILL = '#894C34';
const TEXT_SECONDARY = '#53433E';

interface SideDrawerProps {
  visible: boolean;
  onClose: () => void;
  currentCount: number;
  maxCount: number;
  platformCount: number;
  platformSources: string[];
}

export default function SideDrawer({
  visible,
  onClose,
  currentCount,
  maxCount,
  platformCount,
  platformSources,
}: SideDrawerProps) {
  const PRIVACY_URL = 'https://www.privacypolicies.com/live/9e80091f-0759-4ad8-b719-3f52e0f8e8ed';

  const { colors, isDark } = useTheme();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const slideAnim = React.useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;

  const CACHE_SIZE = '27.8 MB';

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const progress = Math.min((currentCount / maxCount) * 100, 100);

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will remove temporary files. Your saved links are not affected.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive' }]
    );
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); } },
    ]);
  };

  const getPlatformIconName = (source: string): string => {
    const s = source.toLowerCase();
    if (s.includes('xiaohongshu') || s.includes('xhslink')) return 'bookmark';
    if (s.includes('mp.weixin') || s.includes('weixin') || s.includes('wechat')) return 'chat';
    if (s.includes('bilibili')) return 'play-circle-filled';
    if (s.includes('twitter') || s.includes('x.com')) return 'tag';
    if (s.includes('youtube')) return 'smart-display';
    if (s.includes('instagram')) return 'camera-alt';
    if (s.includes('tiktok')) return 'music-note';
    if (s.includes('medium') || s.includes('substack')) return 'edit';
    if (s.includes('reddit')) return 'forum';
    if (s.includes('news') || s.includes('article')) return 'article';
    if (s.includes('blog')) return 'rss-feed';
    return 'language';
  };

  if (!visible) return null;

  const cardBg = isDark ? CARD_BG_DARK : CARD_BG;
  const dividerColor = isDark ? DIVIDER_DARK : DIVIDER;
  const progressBgColor = isDark ? '#3D352E' : PROGRESS_BG;
  const progressFillColor = isDark ? '#C27B60' : PROGRESS_FILL;
  const textSecondary = isDark ? '#8C7C72' : TEXT_SECONDARY;
  const iconBg = isDark ? colors.surface : '#FCF9F2';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Overlay */}
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            backgroundColor: isDark ? '#1E1A16' : '#FBF9F2',
            transform: [{ translateX: slideAnim }],
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        {/* User info section */}
        <View style={styles.userSection}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
            <MaterialIcons name="person" size={18} color={colors.onPrimaryContainer} />
          </View>
          <Text
            style={[styles.email, { color: colors.onSurface }]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {user?.email || 'No account'}
          </Text>
          <TouchableOpacity
            onPress={handleSignOut}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.signOutBtn}
          >
            <MaterialIcons name="logout" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>

        {/* Single card: left/right column layout */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={styles.cardRow}>
            {/* Left column: CONSUMPTION */}
            <View style={styles.colLeft}>
              <Text style={[styles.cardTitle, { color: textSecondary }]}>CONSUMPTION</Text>
              <View style={styles.numberRow}>
                <Text style={[styles.number, { color: isDark ? '#C27B60' : '#894C34' }]}>
                  {currentCount}
                </Text>
                <Text style={[styles.numberDivider, { color: colors.onSurface }]}>
                  / {maxCount}
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: progressBgColor }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: progressFillColor, width: `${progress}%` },
                  ]}
                />
              </View>
            </View>

            {/* Vertical divider */}
            <View style={[styles.dividerLine, { backgroundColor: dividerColor }]} />

            {/* Right column: PLATFORMS */}
            <View style={styles.colRight}>
              <Text style={[styles.cardTitle, { color: textSecondary }]}>PLATFORMS</Text>
              <View style={styles.numberRow}>
                <Text style={[styles.number, { color: isDark ? '#C27B60' : '#894C34' }]}>
                  {platformCount}
                </Text>
                <Text style={[styles.numberDivider, { color: colors.onSurface }]}>
                  / 5
                </Text>
              </View>
              <View style={styles.platformIconsRow}>
                {platformSources.slice(0, 3).map((src, idx) => (
                  <View key={idx} style={[styles.platformIcon, { backgroundColor: iconBg }]}>
                    <MaterialIcons
                      name={getPlatformIconName(src) as any}
                      size={14}
                      color={textSecondary}
                    />
                  </View>
                ))}
                {platformSources.length === 0 && (
                  <Text style={[styles.noPlatforms, { color: textSecondary }]}>None yet</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Settings section */}
        <View style={[styles.settingsCard, { backgroundColor: cardBg }]}>
          {/* Version */}
          <View style={styles.settingsItem}>
            <MaterialIcons name="smartphone" size={20} color={colors.onSurfaceVariant} />
            <Text style={[styles.settingsLabel, { color: colors.onSurface }]}>Version</Text>
            <Text style={[styles.settingsValue, { color: colors.onSurfaceVariant }]}>
              v1.0.0
            </Text>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />

          {/* Clear Cache */}
          <TouchableOpacity style={styles.settingsItem} onPress={handleClearCache}>
            <MaterialIcons name="delete-sweep" size={20} color={colors.onSurfaceVariant} />
            <Text style={[styles.settingsLabel, { color: colors.onSurface }]}>Clear Cache</Text>
            <Text style={[styles.settingsValue, { color: colors.onSurfaceVariant }]}>
              {CACHE_SIZE}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />

          {/* Privacy Policy */}
          <TouchableOpacity style={styles.settingsItem} onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}>
            <MaterialIcons name="policy" size={20} color={colors.onSurfaceVariant} />
            <Text style={[styles.settingsLabel, { color: colors.onSurface }]}>Privacy Policy</Text>
            <MaterialIcons name="chevron-right" size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>

        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 100,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    paddingHorizontal: spacing.lg,
    zIndex: 101,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  email: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
  },
  signOutBtn: {
    padding: spacing.xs,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  colLeft: {
    flex: 1,
    padding: spacing.lg,
  },
  dividerLine: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: spacing.lg,
  },
  colRight: {
    flex: 1,
    padding: spacing.lg,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  number: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  numberDivider: {
    fontSize: fontSizes.md,
    fontWeight: '400',
    lineHeight: 24,
    marginLeft: 2,
  },
  progressTrack: {
    height: 3,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  platformIconsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  platformIcon: {
    width: 26,
    height: 26,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPlatforms: {
    fontSize: fontSizes.xs,
    fontStyle: 'italic',
  },
  settingsCard: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  settingsLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
  },
  settingsValue: {
    fontSize: 13,
  },
  divider: {
    height: 1,
    marginHorizontal: spacing.md,
  },
});
