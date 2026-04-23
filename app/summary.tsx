/**
 * Summary Detail Screen
 * TikTok-style vertical swipe through item summaries
 * Bottom button to open original article in WebView
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Dimensions,
  Share,
  Linking,
  ActivityIndicator,
  ViewToken,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fontSizes, spacing } from '../lib/design';
import { Item } from '../types';
import { useAuth } from '../context/AuthContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SummaryPageProps {
  item: Item;
  onOpenOriginal: () => void;
}

function SummaryPage({ item, onOpenOriginal }: SummaryPageProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

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

  const timeAgo = getTimeAgo(item.created_at);
  const ds = item.detailed_summary;
  const hasDetailedSummary = ds && (ds.overview || (ds.details && ds.details.length > 0));

  return (
    <View style={[styles.pageContainer, { backgroundColor: colors.background }]}>
      {/* Main scrollable content */}
      <View style={styles.contentArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.source, { color: colors.onSurfaceVariant }]}>
            {item.source?.toUpperCase()} · {timeAgo}
          </Text>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.onSurface }]}>
          {item.title}
        </Text>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {item.tags.slice(0, 5).map((tag, idx) => (
              <View
                key={idx}
                style={[
                  styles.tag,
                  { backgroundColor: colors.surfaceContainerHigh },
                ]}
              >
                <Text style={[styles.tagText, { color: colors.onSurfaceVariant }]}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Detailed Summary */}
        {hasDetailedSummary ? (
          <View style={styles.summarySection}>
            {/* Overview */}
            {ds.overview ? (
              <View style={styles.overviewBlock}>
                <Text style={[styles.sectionLabel, { color: colors.primary }]}>
                  概要
                </Text>
                <Text style={[styles.overviewText, { color: colors.onSurface }]}>
                  {ds.overview}
                </Text>
              </View>
            ) : null}

            {/* Details */}
            {ds.details && ds.details.length > 0 ? (
              <View style={styles.detailsBlock}>
                <Text style={[styles.sectionLabel, { color: colors.primary }]}>
                  详述
                </Text>
                {ds.details.map((detail, idx) => (
                  <View key={idx} style={styles.detailItem}>
                    <View
                      style={[
                        styles.bullet,
                        { backgroundColor: colors.primary },
                      ]}
                    />
                    <Text style={[styles.detailText, { color: colors.onSurface }]}>
                      {detail}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          /* Fallback: show brief summary if no detailed summary */
          <View style={styles.summarySection}>
            <Text style={[styles.sectionLabel, { color: colors.primary }]}>
              概要
            </Text>
            <Text style={[styles.overviewText, { color: colors.onSurface }]}>
              {item.summary || 'No summary available'}
            </Text>
          </View>
        )}
      </View>

      {/* Fixed bottom action bar */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: isDark ? 'rgba(28,27,31,0.95)' : 'rgba(252,249,242,0.95)',
            paddingBottom: insets.bottom + spacing.md,
            borderTopColor: colors.outlineVariant,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={onOpenOriginal}
        >
          <MaterialIcons name="language" size={20} color={colors.onPrimary} />
          <Text style={[styles.actionBtnText, { color: colors.onPrimary }]}>
            查看原文
          </Text>
        </TouchableOpacity>

        <View style={styles.secondaryActions}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              if (item.url) {
                Share.share({ url: item.url });
              }
            }}
          >
            <MaterialIcons
              name="share"
              size={20}
              color={colors.onSurfaceVariant}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              if (item.url) {
                Linking.openURL(item.url);
              }
            }}
          >
            <MaterialIcons
              name="open-in-new"
              size={20}
              color={colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Swipe hint */}
      <View style={styles.swipeHint}>
        <MaterialIcons
          name="keyboard-arrow-up"
          size={20}
          color={colors.outlineVariant}
        />
        <Text style={[styles.swipeHintText, { color: colors.outlineVariant }]}>
          上滑翻页
        </Text>
      </View>
    </View>
  );
}

interface SummaryScreenParams {
  itemId: string;
}

export default function SummaryScreen() {
  const { colors, isDark } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const insets = useSafeAreaInsets();

  // Get items from route params - passed as a JSON string
  // We'll use a global state approach via a ref for simplicity
  // The parent (FeedScreen) passes items via a module-level store

  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerTitle, setViewerTitle] = useState('');
  const webviewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user]);

  // Get shared items from global store (set by FeedScreen before navigating)
  const items = global.__noox_summary_items__ || [];
  const initialIndex = itemId
    ? items.findIndex((i: Item) => i.id === itemId)
    : 0;
  const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const flatListRef = useRef<FlatList>(null);

  const handleOpenOriginal = useCallback(() => {
    const currentItem = items[currentIndex];
    if (currentItem) {
      setViewerUrl(currentItem.url);
      setViewerTitle(currentItem.title);
    }
  }, [currentIndex, items]);

  const handleCloseViewer = useCallback(() => {
    setViewerUrl(null);
  }, []);

  // Update current index when scroll ends
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const firstVisible = viewableItems[0];
        if (firstVisible.index !== null) {
          setCurrentIndex(firstVisible.index);
        }
      }
    },
    []
  );

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };

  const renderItem = ({ item }: { item: Item }) => (
    <SummaryPage
      item={item}
      onOpenOriginal={handleOpenOriginal}
    />
  );

  if (items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + spacing.md }]}
          onPress={() => router.back()}
        >
          <MaterialIcons name="close" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
            No items available
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header bar with close button and page indicator */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + spacing.sm,
            backgroundColor: isDark ? 'rgba(28,27,31,0.9)' : 'rgba(252,249,242,0.9)',
            borderBottomColor: colors.outlineVariant,
          },
        ]}
      >
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.pageIndicator, { color: colors.onSurfaceVariant }]}>
          {currentIndex + 1} / {items.length}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* TikTok-style flat list */}
      <FlatList
        ref={flatListRef}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
      />

      {/* Article Viewer Modal */}
      <Modal
        visible={viewerUrl !== null}
        animationType="slide"
        onRequestClose={handleCloseViewer}
      >
        <View style={[styles.viewerContainer, { backgroundColor: isDark ? '#000' : '#fff' }]}>
          <View
            style={[
              styles.viewerHeader,
              {
                paddingTop: insets.top,
                backgroundColor: isDark ? colors.surfaceContainerLow : '#fff',
                borderBottomColor: colors.outlineVariant,
              },
            ]}
          >
            <TouchableOpacity style={styles.viewerCloseBtn} onPress={handleCloseViewer}>
              <MaterialIcons name="close" size={24} color={colors.onSurface} />
            </TouchableOpacity>
            <Text
              style={[styles.viewerTitle, { color: colors.onSurface }]}
              numberOfLines={1}
            >
              {viewerTitle || (viewerUrl ? new URL(viewerUrl).hostname : '')}
            </Text>
            {viewerLoading && (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginLeft: 8 }}
              />
            )}
          </View>

          <View style={styles.viewerWebview}>
            {viewerUrl && (
              <WebView
                ref={webviewRef}
                source={{ uri: viewerUrl }}
                onNavigationStateChange={(navState: WebViewNavigation) => {
                  setCanGoBack(navState.canGoBack);
                  setCanGoForward(navState.canGoForward);
                  setViewerLoading(navState.loading);
                  if (navState.title && navState.title.length > 3) {
                    setViewerTitle(navState.title);
                  }
                }}
                onError={() => setViewerLoading(false)}
                onLoadStart={() => setViewerLoading(true)}
                onLoadEnd={() => setViewerLoading(false)}
                style={{ flex: 1 }}
                startInLoadingState={false}
                scalesPageToFit={true}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsBackForwardNavigationGestures={true}
              />
            )}
          </View>

          <View
            style={[
              styles.viewerToolbar,
              {
                paddingBottom: insets.bottom + spacing.md,
                backgroundColor: isDark ? colors.surfaceContainerLow : '#fff',
                borderTopColor: colors.outlineVariant,
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.toolbarBtn, !canGoBack && styles.toolbarBtnDisabled]}
              onPress={() => webviewRef.current?.goBack()}
              disabled={!canGoBack}
            >
              <MaterialIcons
                name="arrow-back"
                size={22}
                color={canGoBack ? colors.onSurface : colors.outlineVariant}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toolbarBtn, !canGoForward && styles.toolbarBtnDisabled]}
              onPress={() => webviewRef.current?.goForward()}
              disabled={!canGoForward}
            >
              <MaterialIcons
                name="arrow-forward"
                size={22}
                color={canGoForward ? colors.onSurface : colors.outlineVariant}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolbarBtn}
              onPress={() => webviewRef.current?.reload()}
            >
              <MaterialIcons name="refresh" size={22} color={colors.onSurface} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolbarBtn}
              onPress={() => {
                if (viewerUrl) {
                  Share.share({ url: viewerUrl });
                }
              }}
            >
              <MaterialIcons name="share" size={22} color={colors.onSurface} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolbarBtn}
              onPress={() => {
                if (viewerUrl) {
                  Linking.openURL(viewerUrl);
                }
              }}
            >
              <MaterialIcons name="open-in-new" size={22} color={colors.onSurface} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  closeBtn: {
    padding: spacing.sm,
    width: 40,
  },
  pageIndicator: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    letterSpacing: 1,
  },
  placeholder: {
    width: 40,
  },
  pageContainer: {
    height: SCREEN_HEIGHT,
    flex: 1,
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: 70,
    paddingBottom: 120,
  },
  header: {
    marginBottom: spacing.md,
  },
  source: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: fontSizes['3xl'],
    fontWeight: '700',
    lineHeight: 36,
    letterSpacing: -0.3,
    marginBottom: spacing.lg,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  tagText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  summarySection: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  overviewBlock: {
    marginBottom: spacing.xl,
  },
  overviewText: {
    fontSize: fontSizes.lg,
    lineHeight: 30,
    letterSpacing: 0.2,
  },
  detailsBlock: {
    gap: spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    flexShrink: 0,
  },
  detailText: {
    flex: 1,
    fontSize: fontSizes.md,
    lineHeight: 26,
    opacity: 0.85,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: 999,
  },
  actionBtnText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginLeft: spacing.md,
  },
  secondaryBtn: {
    padding: spacing.sm,
  },
  swipeHint: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  swipeHintText: {
    fontSize: fontSizes.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // Viewer
  viewerContainer: {
    flex: 1,
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  viewerCloseBtn: {
    padding: spacing.sm,
  },
  viewerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
  },
  viewerWebview: {
    flex: 1,
  },
  viewerToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
  },
  toolbarBtn: {
    padding: spacing.sm,
    minWidth: 44,
    alignItems: 'center',
  },
  toolbarBtnDisabled: {
    opacity: 0.4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSizes.md,
  },
});
