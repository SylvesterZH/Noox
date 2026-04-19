/**
 * Feed Screen (Home)
 * Based on Stitch's new design
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
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useTheme, fontSizes, spacing } from '../../lib/design';
import { getItems, saveUrl, deleteItem } from '../../lib/api';
import { parseClipboardContent, getDomain } from '../../lib/clipboardUtils';
import { Item } from '../../types';
import { useAuth } from '../../context/AuthContext';
import ManagementSection from '../../components/ManagementSection';
import FeedItem from '../../components/FeedItem';
import { ContentFetcher } from '../../components/ContentFetcher';
import ProcessingIndicator from '../../components/ProcessingIndicator';

const MAX_CONSUMPTION = 50; // Maximum items user can save

// JavaScript injected into the visible WebView to extract content in the background
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

  // Data state
  const [items, setItems] = useState<Item[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fetchingContent, setFetchingContent] = useState(false);
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Visible WebView modal state (for blocked platforms like 小红书)
  const [showVisibleWebview, setShowVisibleWebview] = useState(false);
  const [visibleWebviewUrl, setVisibleWebviewUrl] = useState<string | null>(null);
  const [visibleWebviewLoading, setVisibleWebviewLoading] = useState(false);
  const visibleWebviewRef = useRef<WebView>(null);
  const [visibleWebviewCanGoBack, setVisibleWebviewCanGoBack] = useState(false);
  const [visibleWebviewCanGoForward, setVisibleWebviewCanGoForward] = useState(false);
  const [visibleWebviewSaving, setVisibleWebviewSaving] = useState(false);
  const [visibleWebviewExtracted, setVisibleWebviewExtracted] = useState(false);
  const [visibleWebviewExtracting, setVisibleWebviewExtracting] = useState(false);
  const visibleWebviewExtractedContentRef = useRef<{ title: string; text: string } | null>(null);

  // Check if URL is from a platform that blocks hidden WebView content extraction
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

  // Clipboard preview modal state
  const [showClipboardModal, setShowClipboardModal] = useState(false);
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [clipboardTitle, setClipboardTitle] = useState<string | null>(null);
  const [clipboardThumbnail, setClipboardThumbnail] = useState<string | null>(null);
  const lastClipboardRef = useRef<string | null>(null);

  // Processing indicator state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  // Menu state
  const [menuItemId, setMenuItemId] = useState<string | null>(null);

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

  const loadItems = useCallback(async () => {
    try {
      const res = await getItems({ limit: 50 });
      setItems(res.items);
      setPlatforms([...new Set(res.items.map((i) => i.source))]);
      setErrorMessage(null);
    } catch (e: any) {
      console.error('Failed to load items:', e);
      const msg = e?.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('Network')) {
        setErrorMessage('Network error. Check your connection.');
      } else {
        setErrorMessage('Failed to load items.');
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
    const timer = setTimeout(() => {
      loadItems().finally(() => setLoading(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [loadItems]);

  // Helper function to check if string is a valid URL
  const isValidUrl = (text: string): boolean => {
    try {
      const url = new URL(text);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // AppState listener - check clipboard when app comes to foreground
  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const text = await Clipboard.getStringAsync();
        if (!text || text === lastClipboardRef.current) return;

        const { url, title, cleanedUrl } = parseClipboardContent(text);
        if (url) {
          lastClipboardRef.current = text;
          setClipboardUrl(cleanedUrl || url);
          setClipboardTitle(title);
          setClipboardThumbnail(null);
          setShowClipboardModal(true);
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

    // Also check once on mount
    checkClipboard();

    return () => {
      subscription.remove();
    };
  }, []);

  // Keyboard listener for modal
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showListener = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
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

  const handleSave = () => {
    if (!urlInput.trim()) return;
    const url = urlInput.trim();

    // Close modal immediately, then determine how to fetch
    setShowSaveModal(false);
    setErrorMessage(null);

    // For blocked platforms (小红书, 微信, etc.), use visible WebView
    if (isBlockedPlatform(url)) {
      setUrlInput('');
      setFetchedUrl(url);
      setVisibleWebviewUrl(url);
      setVisibleWebviewLoading(true);
      setVisibleWebviewExtracting(true);
      setVisibleWebviewExtracted(false);
      visibleWebviewExtractedContentRef.current = null;
      setShowVisibleWebview(true);
      return;
    }

    // Normal flow: use hidden ContentFetcher
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
      // Save the URL
      await saveUrl(fetchedUrl!, { content: content.text, contentType: 'text' });

      // Get the new item to add to the list
      const res = await getItems({ limit: 50 });
      const newItem = res.items.find(i => i.url === fetchedUrl);

      // Clear states
      setFetchedUrl(null);
      setUrlInput('');

      // Hide processing indicator
      setIsProcessing(false);
      setProcessingMessage('');

      if (newItem) {
        // Add new item at the top with LayoutAnimation
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setItems(prev => [newItem, ...prev]);
      } else {
        // Fallback: just reload all items
        setItems(res.items);
      }
    } catch (e: any) {
      setIsProcessing(false);
      setProcessingMessage('');
      const code = (e as any).code;
      if (code === 'DUPLICATE') {
        setErrorMessage('This link is already saved');
      } else if (code === 'UNAUTHORIZED') {
        setErrorMessage('Please sign in to save links');
      } else if (code === 'AI_FAILED') {
        setErrorMessage('Summary failed but link was saved.');
        loadItems();
        return;
      } else {
        setErrorMessage(e.message || 'Failed to save link');
      }
      setFetchedUrl(null);
      // Reopen modal on failure
      setShowSaveModal(true);
      setErrorMessage(e.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleContentError = async (error: string) => {
    setFetchingContent(false);
    setSaving(true);
    setProcessingMessage('Saving link...');

    // Try to resolve short URL before falling back to backend
    let fallbackUrl = fetchedUrl!;
    let resolvedUrl: string | undefined;

    try {
      // Follow redirects to get the real URL
      const response = await fetch(fallbackUrl, { method: 'HEAD', redirect: 'follow' });
      const finalUrl = response.url;
      // Only use if it's different (i.e., was a short URL)
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
        // Get the new item to add to the list
        // The item's url is the original (short) URL stored by backend
        const res = await getItems({ limit: 50 });
        // Check against original short URL or resolved URL
        const newItem = res.items.find(i => i.url === fallbackUrl || (resolvedUrl && i.url === resolvedUrl));

        setUrlInput('');
        setIsProcessing(false);
        setProcessingMessage('');

        if (newItem) {
          // Add new item at the top with LayoutAnimation
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setItems(prev => [newItem, ...prev]);
        } else {
          // Fallback: just reload all items
          setItems(res.items);
        }
      })
      .catch((e: any) => {
        setIsProcessing(false);
        setProcessingMessage('');
        const code = (e as any).code;
        if (code === 'DUPLICATE') {
          setErrorMessage('This link is already saved');
        } else {
          setErrorMessage(e.message || 'Failed to save link');
        }
        // Reopen modal on failure
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

  const getPlatformIcon = (source: string): string => {
    const domain = source.toLowerCase();
    if (domain.includes('twitter') || domain.includes('x.com')) return 'tag';
    if (domain.includes('youtube')) return 'smart-display';
    if (domain.includes('instagram')) return 'camera-alt';
    if (domain.includes('tiktok')) return 'music-note';
    if (domain.includes('medium') || domain.includes('substack')) return 'edit';
    if (domain.includes('reddit')) return 'forum';
    if (domain.includes('news') || domain.includes('article')) return 'article';
    if (domain.includes('blog')) return 'rss-feed';
    return 'language';
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.md,
            backgroundColor: isDark ? 'rgba(28,27,31,0.85)' : 'rgba(252,249,242,0.85)',
            borderBottomColor: colors.surfaceContainerLow,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity>
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

      <ScrollView
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
      >
        {/* Management Section */}
        <ManagementSection
          currentCount={items.length}
          maxCount={MAX_CONSUMPTION}
          platformCount={uniquePlatforms.length}
          platformIcons={uniquePlatforms.map(getPlatformIcon)}
        />

        {/* Feed Items */}
        {items.map((item) => (
          <FeedItem
            key={item.id}
            item={item}
            hasImage={!!item.thumbnail_url}
            imageUrl={item.thumbnail_url}
            onPress={() => setViewerUrl(item.url)}
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
            <TouchableOpacity style={styles.retryBtn} onPress={loadItems}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom padding for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Clipboard Preview Modal */}
      <Modal visible={showClipboardModal} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowClipboardModal(false)}
        >
          <Pressable
            style={[styles.clipboardModalContent, { backgroundColor: colors.surface }]}
            onPress={() => {}}
          >
            <View style={styles.clipboardHeader}>
              <Text style={[styles.clipboardTitle, { color: colors.onSurface }]}>
                I found some content
              </Text>
            </View>

            {clipboardThumbnail && (
              <View style={styles.clipboardImageWrapper}>
                <Image
                  source={{ uri: clipboardThumbnail }}
                  style={styles.clipboardImage}
                  resizeMode="cover"
                />
              </View>
            )}

            <View style={styles.clipboardContent}>
              {clipboardTitle ? (
                <>
                  <Text style={[styles.clipboardItemTitle, { color: colors.onSurface }]}>
                    {clipboardTitle}
                  </Text>
                  <Text style={[styles.clipboardItemUrl, { color: colors.onSurfaceVariant }]}>
                    {getDomain(clipboardUrl!)}
                  </Text>
                </>
              ) : (
                <Text style={[styles.clipboardItemUrl, { color: colors.onSurface }]}>
                  {clipboardUrl}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.clipboardSaveBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                setUrlInput(clipboardUrl!);
                setShowClipboardModal(false);
                setShowSaveModal(true);
              }}
            >
              <Text style={[styles.clipboardSaveBtnText, { color: colors.onPrimary }]}>
                Save
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clipboardCancelBtn}
              onPress={() => setShowClipboardModal(false)}
            >
              <Text style={[styles.clipboardCancelText, { color: colors.onSurfaceVariant }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
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
                style={[styles.input, { color: colors.onSurface }]}
                placeholder="Paste URL here..."
                placeholderTextColor={colors.onSurfaceVariant}
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
                    const { cleanedUrl } = parseClipboardContent(text);
                    if (cleanedUrl) {
                      setUrlInput(cleanedUrl);
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
      {/* For blocked platforms (小红书, 微信), we show visible WebView instead */}
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
          {/* Header with save button */}
          <View
            style={[
              styles.viewerHeader,
              {
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
              {visibleWebviewUrl ? new URL(visibleWebviewUrl).hostname : ''}
            </Text>
            <TouchableOpacity
              style={[styles.saveLinkBtn, { backgroundColor: colors.primary }, (visibleWebviewSaving || visibleWebviewExtracting) && styles.disabledBtn]}
              onPress={() => {
                if (visibleWebviewSaving || visibleWebviewExtracting) return;
                setVisibleWebviewSaving(true);

                // Use pre-extracted content if available, otherwise just save URL
                const extracted = visibleWebviewExtractedContentRef.current;
                const saveOptions = extracted && extracted.text.trim().length > 0
                  ? { content: extracted.text, contentType: 'text' as const }
                  : undefined;

                saveUrl(fetchedUrl!, saveOptions)
                  .then(async () => {
                    const res = await getItems({ limit: 50 });
                    const newItem = res.items.find(i => i.url === fetchedUrl);
                    setVisibleWebviewSaving(false);
                    setShowVisibleWebview(false);
                    setFetchedUrl(null);
                    setVisibleWebviewUrl(null);
                    setVisibleWebviewExtracted(false);
                    visibleWebviewExtractedContentRef.current = null;
                    setUrlInput('');
                    if (newItem) {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setItems(prev => [newItem, ...prev]);
                    } else {
                      setItems(res.items);
                    }
                  })
                  .catch((e: any) => {
                    setVisibleWebviewSaving(false);
                    const code = (e as any).code;
                    if (code === 'DUPLICATE') {
                      setErrorMessage('This link is already saved');
                    } else {
                      setErrorMessage(e.message || 'Failed to save');
                    }
                    setShowVisibleWebview(false);
                    setFetchedUrl(null);
                    setVisibleWebviewUrl(null);
                    setVisibleWebviewExtracted(false);
                    visibleWebviewExtractedContentRef.current = null;
                  });
              }}
              disabled={visibleWebviewSaving || visibleWebviewExtracting}
            >
              <Text style={[styles.saveLinkBtnText, { color: colors.onPrimary }]}>
                {visibleWebviewSaving ? 'Saving...' : visibleWebviewExtracting ? 'Extracting...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Loading indicator */}
          {visibleWebviewLoading && (
            <View style={[styles.webviewLoadingBar, { backgroundColor: colors.primary }]} />
          )}

          {/* WebView */}
          <View style={styles.viewerWebview}>
            {visibleWebviewUrl && (
              <WebView
                ref={visibleWebviewRef}
                source={{ uri: visibleWebviewUrl }}
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'EXTRACTED' && data.success) {
                      visibleWebviewExtractedContentRef.current = {
                        title: data.title || '',
                        text: data.text || '',
                      };
                      setVisibleWebviewExtracting(false);
                      setVisibleWebviewExtracted(true);
                    }
                  } catch {}
                }}
                onNavigationStateChange={(navState: WebViewNavigation) => {
                  setVisibleWebviewCanGoBack(navState.canGoBack);
                  setVisibleWebviewCanGoForward(navState.canGoForward);
                  setVisibleWebviewLoading(navState.loading);
                  // Reset extraction state on navigation
                  setVisibleWebviewExtracting(true);
                  setVisibleWebviewExtracted(false);
                  visibleWebviewExtractedContentRef.current = null;
                }}
                onLoadEnd={() => {
                  setVisibleWebviewLoading(false);
                  // Inject extraction script when page finishes loading
                  visibleWebviewRef.current?.injectJavaScript(VISIBLE_WEBVIEW_EXTRACT_SCRIPT);
                }}
                onError={() => {
                  setVisibleWebviewLoading(false);
                  setVisibleWebviewExtracting(false);
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

          {/* Toolbar */}
          <View
            style={[
              styles.viewerToolbar,
              {
                backgroundColor: isDark ? colors.surfaceContainerLow : '#fff',
                borderTopColor: colors.outlineVariant,
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
          {/* Viewer Header */}
          <View
            style={[
              styles.viewerHeader,
              {
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

          {/* WebView */}
          <View style={styles.viewerWebview}>
            {viewerUrl && (
              <WebView
                ref={webviewRef}
                source={{ uri: viewerUrl }}
                onNavigationStateChange={(navState: WebViewNavigation) => {
                  setCanGoBack(navState.canGoBack);
                  setCanGoForward(navState.canGoForward);
                  setViewerLoading(navState.loading);
                  if (navState.title) {
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

          {/* Viewer Toolbar */}
          <View
            style={[
              styles.viewerToolbar,
              {
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
    borderBottomWidth: 1,
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
    paddingTop: spacing.xl,
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
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  viewerCloseBtn: {
    padding: spacing.sm,
  },
  viewerTitle: {
    flex: 1,
    fontSize: fontSizes.md,
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
});