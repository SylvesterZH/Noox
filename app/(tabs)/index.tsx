/**
 * Feed Screen (Home)
 * No bottom tab bar, no top header
 * Left menu opens SideDrawer, floating button opens Search
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Share,
  Alert,
  Keyboard,
  Platform,
  LayoutAnimation,
  AppState,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useTheme, fontSizes, spacing } from '../../lib/design';
import { getItems, saveUrl, deleteItem } from '../../lib/api';
import { parseClipboardContent } from '../../lib/clipboardUtils';
import { Item } from '../../types';
import { useAuth } from '../../context/AuthContext';
import FeedItem from '../../components/FeedItem';
import { ContentFetcher } from '../../components/ContentFetcher';
import ProcessingIndicator from '../../components/ProcessingIndicator';
import SideDrawer from '../../components/SideDrawer';
import { getCachedItems, setCachedItems } from '../../lib/cache';
import SkeletonItem from '../../components/SkeletonItem';
import ErrorToast from '../../components/ErrorToast';

const MAX_CONSUMPTION = 50;
const MAX_PLATFORMS = 5;

const VISIBLE_WEBVIEW_EXTRACT_SCRIPT = `
(function() {
  try {
    var title = document.title || '';
    var metaOgTitle = document.querySelector('meta[property="og:title"]');
    if (metaOgTitle) { var og = metaOgTitle.getAttribute('content'); if (og) title = og; }
    var metaTwitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (metaTwitterTitle) { var tw = metaTwitterTitle.getAttribute('content'); if (tw && tw.length > title.length) title = tw; }
    var h1 = document.querySelector('h1');
    if (h1 && h1.innerText && h1.innerText.length > title.length) title = h1.innerText.trim();

    var bodyText = '';
    var article = document.querySelector('article');
    if (article) bodyText = article.innerText || '';
    if (!bodyText) { var main = document.querySelector('main'); if (main) bodyText = main.innerText || ''; }
    if (!bodyText) bodyText = document.body ? document.body.innerText : '';

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'EXTRACTED',
      title: title.substring(0, 200),
      text: bodyText.substring(0, 5000),
      success: true
    }));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'EXTRACTED',
      success: false,
      error: e.message
    }));
  }
})();
true;
`;

export default function FeedScreen() {
  const { colors, isDark } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Search modal state
  const [searchOpen, setSearchOpen] = useState(false);

  // FAB visibility (scroll-aware)
  const [fabVisible, setFabVisible] = useState(true);
  const lastScrollY = React.useRef(0);
  const scrollDir = React.useRef<'down' | 'up' | 'idle'>('idle');
  const fabAnim = React.useRef(new Animated.Value(0)).current;
  const scrollViewRef = React.useRef<ScrollView>(null);

  // Data state
  const [items, setItems] = useState<Item[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshingFromCache, setIsRefreshingFromCache] = useState(false);

  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fetchingContent, setFetchingContent] = useState(false);
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Visible WebView modal state
  const [showVisibleWebview, setShowVisibleWebview] = useState(false);
  const [visibleWebviewUrl, setVisibleWebviewUrl] = useState<string | null>(null);
  const [visibleWebviewLoading, setVisibleWebviewLoading] = useState(false);
  const visibleWebviewRef = useRef<WebView>(null);
  const [visibleWebviewCanGoBack, setVisibleWebviewCanGoBack] = useState(false);
  const [visibleWebviewCanGoForward, setVisibleWebviewCanGoForward] = useState(false);
  const [visibleWebviewSaving, setVisibleWebviewSaving] = useState(false);
  const [webviewExtractedContent, setWebviewExtractedContent] = useState<{ title: string; text: string } | null>(null);

  // Clipboard tracking
  const lastClipboardRef = useRef<string | null>(null);

  // Processing indicator state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  // Menu state
  const [menuItemId, setMenuItemId] = useState<string | null>(null);

  // Skeleton item state - for items being saved
  const [savingItemUrl, setSavingItemUrl] = useState<string | null>(null);

  // Error toast state
  const [saveError, setSaveError] = useState<string | null>(null);

  // Article viewer state
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const webviewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [viewerTitle, setViewerTitle] = useState('');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user]);

  // Calculate unique platforms from items
  const uniquePlatforms = React.useMemo(() => {
    const sources = items.map((item) => item.source);
    return [...new Set(sources)];
  }, [items]);

  const loadItems = useCallback(async (suppressError = false) => {
    try {
      const res = await getItems({ limit: 50 });
      setItems(res.items);
      setCachedItems(res.items);
      setErrorMessage(null);
    } catch (e: any) {
      // Silently keep cached data when API fails (suppressError=true during init)
      // Errors are suppressed when we have cached items to display
      if (!suppressError) {
        const msg = e?.message || '';
        if (msg.includes('Failed to fetch') || msg.includes('Network')) {
          setErrorMessage('Network error. Check your connection.');
        } else {
          setErrorMessage('Failed to load items.');
        }
      }
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  }, [loadItems]);

  useEffect(() => {
    setLoading(true);
    // Load from cache first for immediate display
    const init = async () => {
      try {
        const cached = await getCachedItems();
        if (cached && cached.length > 0) {
          setItems(cached);
          setIsRefreshingFromCache(true);
        }
      } catch {
        // Cache read failed, continue without cache
      }
      setLoading(false);
      // Auto-refresh from API - pull down the scroll view to trigger refresh
      setRefreshing(true);
      try {
        await loadItems(true);
      } catch {
        // API failed, will use cached data if available
      } finally {
        setRefreshing(false);
        setIsRefreshingFromCache(false);
      }
    };
    init();
  }, [loadItems]);

  // AppState listener - check clipboard when app comes to foreground
  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const text = await Clipboard.getStringAsync();
        if (!text || text === lastClipboardRef.current) return;

        const { url } = parseClipboardContent(text);
        if (url) {
          lastClipboardRef.current = text;
          setUrlInput(url);
          setFetchedUrl(null);
          setErrorMessage(null);
          setShowSaveModal(true);
        }
      } catch (e) {
        // Clipboard read failed, ignore
      }
    };

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkClipboard();
      }
    });

    checkClipboard();

    return () => {
      subscription.remove();
    };
  }, []);

  // Sync items to cache whenever they change
  useEffect(() => {
    if (items.length > 0) {
      setCachedItems(items);
    }
  }, [items]);

  // Keyboard listener for modal
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showListener = Keyboard.addListener(showEvent, (e: any) => {
      setKeyboardHeight(e.endCoordinates.height);
    });

    const hideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  const isBlockedPlatform = (url: string): boolean => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return (
        hostname.includes('xiaohongshu') ||
        hostname.includes('xhslink') ||
        hostname.includes('weixin') ||
        hostname.includes('mp.weixin') ||
        hostname.includes('wechat')
      );
    } catch {
      return false;
    }
  };

  const handleSave = () => {
    if (!urlInput.trim()) return;
    const url = urlInput.trim();

    // Close modal immediately and show skeleton + progress bar
    setShowSaveModal(false);
    setUrlInput('');
    setErrorMessage(null);
    setSavingItemUrl(url);
    // Scroll to top to show skeleton placeholder (after state updates)
    setTimeout(() => scrollViewRef.current?.scrollTo({ y: 0, animated: true }), 0);

    if (isBlockedPlatform(url)) {
      setFetchedUrl(url);
      setVisibleWebviewUrl(url);
      setVisibleWebviewLoading(true);
      setWebviewExtractedContent(null);
      setShowVisibleWebview(true);
      return;
    }

    setFetchedUrl(url);
    setFetchingContent(true);
    setIsProcessing(true);
    setProcessingMessage('Fetching content...');
  };

  const handleContentFetched = async (content: { text: string; html: string }) => {
    setFetchingContent(false);
    setSaving(true);
    setProcessingMessage('Saving link...');
    try {
      await saveUrl(fetchedUrl!, { content: content.text, contentType: 'text' });

      const res = await getItems({ limit: 50 });
      const newItem = res.items.find(i => i.url === fetchedUrl);

      setFetchedUrl(null);
      setSavingItemUrl(null);

      setIsProcessing(false);
      setProcessingMessage('');

      if (newItem) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setItems(prev => [newItem, ...prev]);
      } else {
        setItems(res.items);
      }
    } catch (e: any) {
      setIsProcessing(false);
      setProcessingMessage('');
      const code = (e as any).code;
      if (code === 'DUPLICATE') {
        setSaveError('This link is already saved');
        setErrorMessage('This link is already saved');
      } else if (code === 'UNAUTHORIZED') {
        setSaveError('Please sign in to save links');
        setErrorMessage('Please sign in to save links');
      } else if (code === 'AI_FAILED') {
        setSaveError('Summary failed but link was saved.');
        setErrorMessage('Summary failed but link was saved.');
        setSavingItemUrl(null);
        loadItems();
        return;
      } else {
        setSaveError(e.message || 'Failed to save link');
        setErrorMessage(e.message || 'Failed to save link');
      }
      setFetchedUrl(null);
      setSavingItemUrl(null);
      setShowSaveModal(true);
    } finally {
      setSaving(false);
    }
  };

  const handleContentError = async (error: string) => {
    setFetchingContent(false);
    setSaving(true);
    setProcessingMessage('Saving link...');

    let fallbackUrl = fetchedUrl!;
    let resolvedUrl: string | undefined;

    try {
      const response = await fetch(fallbackUrl, { method: 'HEAD', redirect: 'follow' });
      const finalUrl = response.url;
      if (finalUrl && finalUrl !== fallbackUrl) {
        resolvedUrl = finalUrl;
        fallbackUrl = finalUrl;
      }
    } catch {
      // Resolution failed, use original URL
    }

    setFetchedUrl(null);
    saveUrl(fallbackUrl, { resolvedUrl })
      .then(async () => {
        const res = await getItems({ limit: 50 });
        const newItem = res.items.find(i => i.url === fallbackUrl || (resolvedUrl && i.url === resolvedUrl));

        setUrlInput('');
        setIsProcessing(false);
        setProcessingMessage('');
        setSavingItemUrl(null);

        if (newItem) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setItems(prev => [newItem, ...prev]);
        } else {
          setItems(res.items);
        }
      })
      .catch((e: any) => {
        setIsProcessing(false);
        setProcessingMessage('');
        setSavingItemUrl(null);
        const code = (e as any).code;
        if (code === 'DUPLICATE') {
          setSaveError('This link is already saved');
          setErrorMessage('This link is already saved');
        } else {
          setSaveError(e.message || 'Failed to save link');
          setErrorMessage(e.message || 'Failed to save link');
        }
        setShowSaveModal(true);
      })
      .finally(() => setSaving(false));
  };

  const handleDelete = async (id: string) => {
    setMenuItemId(null);
    try {
      await deleteItem(id);
      await loadItems();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to delete item');
    }
  };

  // Close drawer when user navigates away
  useEffect(() => {
    if (!drawerOpen) return;
    // Keep drawer state independent of other interactions
  }, [drawerOpen]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Top Header - minimal, just menu icon + logo hint */}
      <View
        style={[
          styles.header,
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            paddingTop: insets.top + spacing.md,
            backgroundColor: isDark ? 'rgb(28,27,31)' : 'rgb(252,249,242)',
            height: insets.top + 50 + spacing.md,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)}>
            <MaterialIcons name="menu" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.logo, { color: colors.onSurface }]}>NOOX</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setShowSaveModal(true)}>
            <MaterialIcons name="bookmark-add" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Processing Indicator */}
      {isProcessing && (
        <ProcessingIndicator message={processingMessage || 'Processing...'} />
      )}

      {/* Error Toast - slides in from left */}
      <ErrorToast
        message={saveError || ''}
        visible={!!saveError}
        onDismiss={() => setSaveError(null)}
        duration={4000}
      />

      {/* Refresh Header - shows during pull-to-refresh or auto-refresh */}
      {(refreshing || isRefreshingFromCache) && (
        <View style={{
          position: 'absolute',
          top: insets.top + 50,
          left: 0,
          right: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.sm,
          zIndex: 100,
        }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ fontSize: fontSizes.sm, fontWeight: '500', color: colors.onSurfaceVariant }}>
            Refreshing...
          </Text>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const delta = y - lastScrollY.current;

          if (Math.abs(delta) > 4) {
            const newDir = delta > 0 ? 'down' : 'up';

            if (y > 60) {
              if (newDir === 'down' && scrollDir.current !== 'down') {
                scrollDir.current = 'down';
                Animated.timing(fabAnim, {
                  toValue: 1,
                  duration: 250,
                  useNativeDriver: true,
                }).start();
              } else if (newDir === 'up' && scrollDir.current !== 'up') {
                scrollDir.current = 'up';
                Animated.timing(fabAnim, {
                  toValue: 0,
                  duration: 250,
                  useNativeDriver: true,
                }).start();
              }
            } else if (y < 30) {
              if (scrollDir.current !== 'up') {
                scrollDir.current = 'up';
                Animated.timing(fabAnim, {
                  toValue: 0,
                  duration: 250,
                  useNativeDriver: true,
                }).start();
              }
            }
          }
          lastScrollY.current = y;
        }}
        scrollEventThrottle={16}
      >
        {/* Skeleton item for saving in progress */}
        {savingItemUrl && <SkeletonItem url={savingItemUrl} />}

        {/* Feed Items */}
        {items.map((item, index) => (
          <FeedItem
            key={item.id}
            item={item}
            hasImage={!!item.thumbnail_url}
            imageUrl={item.thumbnail_url}
            onPress={() => {
              // Set global store so SummaryScreen can access the full items list
              (global as any).__noox_summary_items__ = items;
              router.push(`/summary?itemId=${encodeURIComponent(item.id)}`);
            }}
            onDelete={() => handleDelete(item.id)}
          />
        ))}

        {/* Empty State */}
        {items.length === 0 && !loading && !errorMessage && (
          <View style={styles.emptyState}>
            <MaterialIcons
              name="collections-bookmark"
              size={64}
              color={colors.outlineVariant}
            />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              No saved items yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
              Tap the + button to save your first link
            </Text>
          </View>
        )}

        {/* Loading State */}
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
              Loading your library...
            </Text>
          </View>
        )}

        {/* Error State */}
        {errorMessage && items.length === 0 && (
          <View style={styles.centered}>
            <MaterialIcons name="error-outline" size={48} color={colors.error} />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              Something went wrong
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
              {errorMessage}
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadItems(false)}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom padding */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Search Button */}
      <Animated.View
        style={[
          styles.fabContainer,
          {
            bottom: insets.bottom + spacing.xl,
            opacity: fabAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
            transform: [
              {
                translateY: fabAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 80],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => setSearchOpen(true)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="search" size={28} color={colors.onPrimary} />
        </TouchableOpacity>
      </Animated.View>

      {/* Side Drawer */}
      <SideDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentCount={items.length}
        maxCount={MAX_CONSUMPTION}
        platformCount={uniquePlatforms.length}
        platformSources={uniquePlatforms}
      />

      {/* Search Modal */}
      <Modal
        visible={searchOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setSearchOpen(false)}
      >
        <View style={[styles.searchModalContainer, { backgroundColor: colors.background }]}>
          {/* Search Header */}
          <View
            style={[
              styles.searchHeader,
              {
                paddingTop: insets.top + spacing.md,
                backgroundColor: isDark ? 'rgba(28,27,31,0.85)' : 'rgba(252,249,242,0.85)',
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => setSearchOpen(false)}
              style={{ width: 40 }}
            >
              <MaterialIcons name="close" size={24} color={colors.onSurface} />
            </TouchableOpacity>
            <Text style={[styles.searchTitle, { color: colors.onSurface }]}>Search</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Search Input */}
          <View style={styles.searchInputRow}>
            <View
              style={[
                styles.searchInputWrapper,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <MaterialIcons name="search" size={20} color={colors.onSurfaceVariant} />
              <TextInput
                style={[styles.searchInput, { color: colors.onSurface }]}
                placeholder="Search your library..."
                placeholderTextColor={colors.onSurfaceVariant}
                autoFocus
              />
            </View>
          </View>

          {/* Placeholder for search results */}
          <View style={styles.searchPlaceholder}>
            <MaterialIcons name="search" size={48} color={colors.outlineVariant} />
            <Text style={[styles.searchHint, { color: colors.onSurfaceVariant }]}>
              Start typing to search
            </Text>
          </View>
        </View>
      </Modal>

      {/* Save Modal */}
      <Modal visible={showSaveModal} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            Keyboard.dismiss();
            setTimeout(() => {
              if (!keyboardHeight) {
                setShowSaveModal(false);
                setUrlInput('');
                setFetchedUrl(null);
                setFetchingContent(false);
                setErrorMessage(null);
              }
            }, 100);
          }}
        >
          <Pressable
            style={[
              styles.modalContent,
              { backgroundColor: colors.surface },
              { transform: [{ translateY: -keyboardHeight / 2 }] },
            ]}
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: colors.primary }]}>
                <MaterialIcons name="link" size={24} color={colors.onPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalLabel, { color: colors.onSurfaceVariant }]}>
                  SAVE LINK
                </Text>
                <Text
                  style={[styles.modalUrl, { color: colors.onSurface }]}
                  numberOfLines={1}
                >
                  {urlInput || 'Paste a URL'}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.inputContainer,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <TextInput
                style={[styles.input, { color: urlInput ? colors.onSurface : colors.outlineVariant }]}
                placeholder="Paste URL here..."
                placeholderTextColor={colors.outline}
                value={urlInput}
                onChangeText={setUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TouchableOpacity
                onPress={async () => {
                  const text = await Clipboard.getStringAsync();
                  if (text) {
                    const { url } = parseClipboardContent(text);
                    if (url) {
                      setUrlInput(url);
                    } else {
                      setUrlInput(text);
                    }
                  }
                }}
                style={styles.pasteBtn}
              >
                <MaterialIcons
                  name="content-paste"
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.cancelBtn,
                  { backgroundColor: colors.surfaceContainerHighest },
                ]}
                onPress={() => {
                  setShowSaveModal(false);
                  setFetchedUrl(null);
                  setFetchingContent(false);
                }}
              >
                <Text style={[styles.cancelBtnText, { color: colors.onSurface }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.saveBtn,
                  { backgroundColor: colors.primary },
                  (saving || fetchingContent) && styles.disabledBtn,
                ]}
                onPress={handleSave}
                disabled={saving || fetchingContent}
              >
                <Text style={[styles.saveBtnText, { color: colors.onPrimary }]}>
                  {saving
                    ? 'Saving...'
                    : fetchingContent
                    ? 'Loading...'
                    : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>

            {fetchingContent && (
              <View style={styles.fetchingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.fetchingText, { color: colors.onSurfaceVariant }]}>
                  Loading page content...
                </Text>
              </View>
            )}

            {errorMessage && (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: colors.errorContainer },
                ]}
              >
                <Text style={[styles.errorText, { color: colors.onErrorContainer }]}>
                  {errorMessage}
                </Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Content Fetcher - only for non-blocked platforms */}
      {!isBlockedPlatform(fetchedUrl || '') && (
        <ContentFetcher
          url={fetchedUrl}
          onContent={handleContentFetched}
          onError={handleContentError}
        />
      )}

      {/* Visible WebView Modal - for blocked platforms */}
      <Modal
        visible={showVisibleWebview}
        animationType="slide"
        onRequestClose={() => {
          Alert.alert(
            'Cancel save?',
            'Do you want to cancel saving this link?',
            [
              { text: 'Continue browsing', style: 'cancel' },
              {
                text: 'Cancel',
                style: 'destructive',
                onPress: () => {
                  setShowVisibleWebview(false);
                  setVisibleWebviewUrl(null);
                  setFetchedUrl(null);
                  setVisibleWebviewLoading(false);
                },
              },
            ]
          );
        }}
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
            <TouchableOpacity
              style={styles.viewerCloseBtn}
              onPress={() => {
                Alert.alert(
                  'Cancel save?',
                  'Do you want to cancel saving this link?',
                  [
                    { text: 'Continue browsing', style: 'cancel' },
                    {
                      text: 'Cancel',
                      style: 'destructive',
                      onPress: () => {
                        setShowVisibleWebview(false);
                        setVisibleWebviewUrl(null);
                        setFetchedUrl(null);
                        setVisibleWebviewLoading(false);
                      },
                    },
                  ]
                );
              }}
            >
              <MaterialIcons name="close" size={24} color={colors.onSurface} />
            </TouchableOpacity>
            <Text
              style={[styles.viewerTitle, { color: colors.onSurface }]}
              numberOfLines={1}
            >
              {webviewExtractedContent?.title || (visibleWebviewUrl ? new URL(visibleWebviewUrl).hostname : 'Save Link')}
            </Text>
            <TouchableOpacity
              style={[styles.saveLinkBtn, { backgroundColor: colors.primary }, visibleWebviewSaving && styles.disabledBtn]}
              onPress={() => {
                if (visibleWebviewSaving) return;
                setVisibleWebviewSaving(true);

                setShowVisibleWebview(false);
                setVisibleWebviewUrl(null);
                setSavingItemUrl(fetchedUrl!);

                setIsProcessing(true);
                setProcessingMessage('Saving link...');

                const extracted = webviewExtractedContent;
                const saveOptions = extracted && extracted.text.trim().length > 0
                  ? { content: extracted.text, contentType: 'text' as const }
                  : undefined;

                saveUrl(fetchedUrl!, saveOptions)
                  .then(async () => {
                    const res = await getItems({ limit: 50 });
                    const newItem = res.items.find(i => i.url === fetchedUrl);
                    setVisibleWebviewSaving(false);
                    setIsProcessing(false);
                    setProcessingMessage('');
                    setFetchedUrl(null);
                    setWebviewExtractedContent(null);
                    setUrlInput('');
                    setSavingItemUrl(null);
                    if (newItem) {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setItems(prev => [newItem, ...prev]);
                    } else {
                      setItems(res.items);
                    }
                  })
                  .catch((e: any) => {
                    setVisibleWebviewSaving(false);
                    setIsProcessing(false);
                    setProcessingMessage('');
                    setSavingItemUrl(null);
                    const code = (e as any).code;
                    if (code === 'DUPLICATE') {
                      setSaveError('This link is already saved');
                      setErrorMessage('This link is already saved');
                    } else {
                      setSaveError(e.message || 'Failed to save');
                      setErrorMessage(e.message || 'Failed to save');
                    }
                    setFetchedUrl(null);
                    setWebviewExtractedContent(null);
                  });
              }}
              disabled={visibleWebviewSaving}
            >
              <Text style={[styles.saveLinkBtnText, { color: colors.onPrimary }]}>
                {visibleWebviewSaving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          {visibleWebviewLoading && (
            <View style={[styles.webviewLoadingBar, { backgroundColor: colors.primary }]} />
          )}

          <View style={styles.viewerWebview}>
            {visibleWebviewUrl && (
              <WebView
                ref={visibleWebviewRef}
                source={{ uri: visibleWebviewUrl }}
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'EXTRACTED' && data.success) {
                      setWebviewExtractedContent({
                        title: data.title || '',
                        text: data.text || '',
                      });
                    }
                  } catch {}
                }}
                onNavigationStateChange={(navState: WebViewNavigation) => {
                  setVisibleWebviewCanGoBack(navState.canGoBack);
                  setVisibleWebviewCanGoForward(navState.canGoForward);
                  setVisibleWebviewLoading(navState.loading);
                  setWebviewExtractedContent(null);
                }}
                onLoadEnd={() => {
                  setVisibleWebviewLoading(false);
                  visibleWebviewRef.current?.injectJavaScript(VISIBLE_WEBVIEW_EXTRACT_SCRIPT);
                }}
                onError={() => {
                  setVisibleWebviewLoading(false);
                }}
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
                backgroundColor: isDark ? colors.surfaceContainerLow : '#fff',
                borderTopColor: colors.outlineVariant,
                paddingBottom: insets.bottom + spacing.md,
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.toolbarBtn, !visibleWebviewCanGoBack && styles.toolbarBtnDisabled]}
              onPress={() => visibleWebviewRef.current?.goBack()}
              disabled={!visibleWebviewCanGoBack}
            >
              <MaterialIcons
                name="arrow-back"
                size={22}
                color={visibleWebviewCanGoBack ? colors.onSurface : colors.outlineVariant}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toolbarBtn, !visibleWebviewCanGoForward && styles.toolbarBtnDisabled]}
              onPress={() => visibleWebviewRef.current?.goForward()}
              disabled={!visibleWebviewCanGoForward}
            >
              <MaterialIcons
                name="arrow-forward"
                size={22}
                color={visibleWebviewCanGoForward ? colors.onSurface : colors.outlineVariant}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolbarBtn}
              onPress={() => visibleWebviewRef.current?.reload()}
            >
              <MaterialIcons name="refresh" size={22} color={colors.onSurface} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolbarBtn}
              onPress={() => {
                if (visibleWebviewUrl) Share.share({ url: visibleWebviewUrl });
              }}
            >
              <MaterialIcons name="share" size={22} color={colors.onSurface} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Article Viewer Modal */}
      <Modal
        visible={viewerUrl !== null}
        animationType="slide"
        onRequestClose={() => setViewerUrl(null)}
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
            <TouchableOpacity
              style={styles.viewerCloseBtn}
              onPress={() => setViewerUrl(null)}
            >
              <MaterialIcons name="close" size={24} color={colors.onSurface} />
            </TouchableOpacity>
            <Text
              style={[styles.viewerTitle, { color: colors.onSurface }]}
              numberOfLines={1}
            >
              {viewerTitle || (viewerUrl ? new URL(viewerUrl!).hostname : '')}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    zIndex: 99,
  },
  headerLeft: {
    width: 40,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  logo: {
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    letterSpacing: 2,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: 120,
    paddingBottom: spacing['3xl'],
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing['3xl'],
    gap: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing['3xl'],
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: fontSizes.md,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  retryBtnText: {
    fontWeight: '600',
    fontSize: fontSizes.md,
  },

  // FAB
  fabContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },

  // Search Modal
  searchModalContainer: {
    flex: 1,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(216,194,187,0.15)',
  },
  searchTitle: {
    flex: 1,
    fontSize: fontSizes['2xl'],
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  searchInputRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSizes.md,
  },
  searchPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  searchHint: {
    fontSize: fontSizes.md,
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLabel: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  modalUrl: {
    fontSize: fontSizes.md,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: fontSizes.md,
  },
  pasteBtn: {
    padding: spacing.xs,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
  },
  cancelBtn: {},
  cancelBtnText: {
    fontWeight: '600',
    fontSize: fontSizes.md,
  },
  saveBtn: {},
  saveBtnText: {
    fontWeight: '700',
    fontSize: fontSizes.md,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  fetchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  fetchingText: {
    fontSize: fontSizes.sm,
  },
  errorBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 8,
  },
  errorText: {
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },

  // Article Viewer
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
  saveLinkBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    marginLeft: spacing.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  saveLinkBtnText: {
    fontWeight: '700',
    fontSize: fontSizes.sm,
  },
  webviewLoadingBar: {
    height: 2,
    width: '100%',
  },

  // Clipboard Modal
  clipboardModalContent: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: spacing.lg,
  },
  clipboardHeader: {
    marginBottom: spacing.md,
  },
  clipboardTitle: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  clipboardImageWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  clipboardImage: {
    width: '100%',
    height: '100%',
  },
  clipboardContent: {
    marginBottom: spacing.lg,
  },
  clipboardItemTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: spacing.xs,
  },
  clipboardItemUrl: {
    fontSize: fontSizes.sm,
    opacity: 0.7,
  },
  clipboardSaveBtn: {
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  clipboardSaveBtnText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  clipboardCancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  clipboardCancelText: {
    fontSize: fontSizes.sm,
  },
  // Cache refresh indicator — now handled by refreshHeader
  cachedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    marginHorizontal: spacing.xl,
    borderRadius: 12,
  },
  cachedText: {
    fontSize: fontSizes.sm,
  },

});