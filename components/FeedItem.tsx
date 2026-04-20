/**
 * Feed Item Card
 * Two layouts: with image preview (horizontal) and without image (vertical)
 * Based on Stitch's design
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  Alert,
  Linking,
  Share,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, fontSizes, spacing } from '../lib/design';
import { Item } from '../types';
import { cleanTitle, getDomain } from '../lib/clipboardUtils';

interface FeedItemProps {
  item: Item;
  hasImage?: boolean;
  imageUrl?: string;
  onPress?: () => void;
  onDelete?: () => void;
  onBookmark?: () => void;
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface PlatformConfig {
  name: string;
  fallbackIcon: string;
  iconAsset?: number; // require() returns a number (module ID)
}

// Platform configs for friendly names and icons
// Custom PNG icons are loaded via require() and rendered via Image
const xiaohongshuIcon = require('../assets/platforms/xiaohongshu.png');
const wechatIcon = require('../assets/platforms/wechat.png');

const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  // Chinese platforms
  'xiaohongshu': { name: '小红书', fallbackIcon: 'bookmark', iconAsset: xiaohongshuIcon },
  'xhslink': { name: '小红书', fallbackIcon: 'bookmark', iconAsset: xiaohongshuIcon },
  'mp.weixin': { name: '微信公众号', fallbackIcon: 'article', iconAsset: wechatIcon },
  'weixin': { name: '微信', fallbackIcon: 'chat', iconAsset: wechatIcon },
  'wechat': { name: '微信', fallbackIcon: 'chat', iconAsset: wechatIcon },
  'bilibili': { name: '哔哩哔哩', fallbackIcon: 'play-circle-filled' },
  // Global platforms
  'twitter': { name: 'Twitter', fallbackIcon: 'tag' },
  'x.com': { name: 'X', fallbackIcon: 'tag' },
  'youtube': { name: 'YouTube', fallbackIcon: 'smart-display' },
  'instagram': { name: 'Instagram', fallbackIcon: 'camera-alt' },
  'tiktok': { name: 'TikTok', fallbackIcon: 'music-note' },
  'medium': { name: 'Medium', fallbackIcon: 'edit' },
  'substack': { name: 'Substack', fallbackIcon: 'edit' },
  'reddit': { name: 'Reddit', fallbackIcon: 'forum' },
};

function getPlatformConfig(source: string): PlatformConfig {
  const domain = source.toLowerCase();
  for (const [key, config] of Object.entries(PLATFORM_CONFIGS)) {
    if (domain.includes(key)) return config;
  }
  return { name: source, fallbackIcon: 'language' };
}

export default function FeedItem({
  item,
  hasImage = false,
  imageUrl,
  onPress,
  onDelete,
  onBookmark,
}: FeedItemProps) {
  const { colors } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const timeAgo = getTimeAgo(item.created_at);
  const platform = getPlatformConfig(item.source);
  const sourceIcon = platform.fallbackIcon;

  const handleDelete = () => {
    setShowMenu(false);
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: onDelete,
        },
      ]
    );
  };

  const handleOpenExternal = () => {
    setShowMenu(false);
    if (item.url) {
      Linking.openURL(item.url);
    }
  };

  const handleShare = () => {
    setShowMenu(false);
    if (item.url) {
      Share.share({ url: item.url });
    }
  };

  const handleBookmark = () => {
    setShowMenu(false);
    onBookmark?.();
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={onPress}
        style={styles.container}
      >
        {/* Meta header: source icon, domain, time */}
        <View style={styles.metaRow}>
          <View style={[styles.sourceIcon, { backgroundColor: colors.onSurface }]}>
            {platform.iconAsset ? (
              <Image
                source={platform.iconAsset}
                style={{ width: 10, height: 10 }}
                resizeMode="contain"
              />
            ) : (
              <MaterialIcons
                name={sourceIcon as any}
                size={10}
                color={colors.surface}
              />
            )}
          </View>
          <Text style={[styles.source, { color: colors.onSurfaceVariant }]}>
            {platform.name}
          </Text>
          <View style={[styles.dot, { backgroundColor: colors.outlineVariant }]} />
          <Text style={[styles.time, { color: colors.onSurfaceVariant }]}>
            {timeAgo}
          </Text>
        </View>

        {/* Title */}
        <Text
          style={[styles.title, { color: colors.onSurface }]}
          numberOfLines={2}
        >
          {cleanTitle(item.title) || getDomain(item.url)}
        </Text>

        {/* Content: with image (horizontal) or without (vertical) */}
        {hasImage && imageUrl ? (
          <View style={styles.withImageRow}>
            <View style={styles.summaryWrapper}>
              <Text
                style={[styles.summary, { color: colors.onSurface }]}
                numberOfLines={5}
              >
                {item.summary}
              </Text>
            </View>
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                resizeMode="cover"
              />
            </View>
          </View>
        ) : (
          <Text
            style={[styles.summary, { color: colors.onSurface }]}
            numberOfLines={5}
          >
            {item.summary}
          </Text>
        )}

        {/* Footer actions */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
            <Text style={[styles.actionText, { color: colors.primary }]}>
              {hasImage ? 'Read Full Inquiry' : 'Explore'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setShowMenu(true)}
          >
            <MaterialIcons
              name="more-horiz"
              size={18}
              color={colors.outlineVariant}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Action Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <Pressable
            style={[styles.menuContent, { backgroundColor: colors.surface }]}
            onPress={() => {}}
          >
            <TouchableOpacity style={styles.menuItem} onPress={handleBookmark}>
              <MaterialIcons name="bookmark-add" size={20} color={colors.primary} />
              <Text style={[styles.menuText, { color: colors.primary }]}>
                Bookmark
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleOpenExternal}>
              <MaterialIcons name="open-in-new" size={20} color={colors.onSurface} />
              <Text style={[styles.menuText, { color: colors.onSurface }]}>
                Open Original
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
              <MaterialIcons name="share" size={20} color={colors.onSurface} />
              <Text style={[styles.menuText, { color: colors.onSurface }]}>
                Share
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
              <MaterialIcons name="delete" size={20} color={colors.error} />
              <Text style={[styles.menuText, { color: colors.error }]}>
                Delete
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
  },
  sourceIcon: {
    width: 16,
    height: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  source: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginLeft: spacing.sm,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: spacing.sm,
    opacity: 0.3,
  },
  time: {
    fontSize: fontSizes.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.3,
    marginBottom: spacing.md,
  },
  withImageRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  summaryWrapper: {
    flex: 1,
  },
  summary: {
    fontSize: fontSizes.md,
    lineHeight: 25,
    opacity: 0.8,
  },
  imageWrapper: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgb(247,241,234)',
  },
  actionBtn: {
    paddingVertical: spacing.xs,
  },
  actionText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  menuBtn: {
    padding: spacing.xs,
  },
  // Menu
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    borderRadius: 16,
    paddingVertical: spacing.sm,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  menuText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
});
