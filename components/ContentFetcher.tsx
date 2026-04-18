import React, { useEffect, useRef, useState } from 'react';
import { View, Dimensions } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ExtractedContent {
  title: string;
  text: string;
  html: string;
}

interface ContentFetcherProps {
  url: string | null;
  onContent: (content: ExtractedContent) => void;
  onError: (error: string) => void;
  onLoadingChange?: (loading: boolean) => void;
}

// JavaScript injected into the WebView to extract page content
const EXTRACT_SCRIPT = `
(function() {
  try {
    // Try multiple title sources in order of preference
    var title = document.title || '';
    var metaOgTitle = document.querySelector('meta[property="og:title"]');
    if (metaOgTitle) {
      var og = metaOgTitle.getAttribute('content');
      if (og) title = og;
    }
    var metaTwitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (metaTwitterTitle) {
      var tw = metaTwitterTitle.getAttribute('content');
      if (tw && tw.length > title.length) title = tw;
    }
    var h1 = document.querySelector('h1');
    if (h1 && h1.innerText && h1.innerText.length > title.length) {
      title = h1.innerText.trim();
    }

    // Get body text with multiple fallbacks
    var bodyText = '';
    var article = document.querySelector('article');
    if (article) {
      bodyText = article.innerText || '';
    }
    if (!bodyText) {
      var main = document.querySelector('main');
      if (main) {
        bodyText = main.innerText || '';
      }
    }
    if (!bodyText) {
      bodyText = document.body ? document.body.innerText : '';
    }

    var html = document.documentElement ? document.documentElement.innerHTML : '';

    window.ReactNativeWebView.postMessage(JSON.stringify({
      title: title.substring(0, 200),
      text: bodyText.substring(0, 5000),
      html: html.substring(0, 10000),
      success: true
    }));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      success: false,
      error: e.message || 'Failed to extract content'
    }));
  }
})();
true;
`;

/**
 * Resolve a short URL to its final URL via HTTP redirect.
 * Returns the final URL, or the original URL if resolution fails.
 */
async function resolveShortUrl(shortUrl: string): Promise<string> {
  try {
    const response = await fetch(shortUrl, {
      method: 'HEAD',
      redirect: 'follow',
    });
    return response.url || shortUrl;
  } catch {
    return shortUrl;
  }
}

const TIMEOUT_MS = 30000; // 30 seconds for slow pages (WeChat, Xiaohongshu, etc.)
const INJECT_DELAY_MS = 2000; // Wait 2s for dynamic content to render
const MAX_RETRIES = 2;

export function ContentFetcher({ url, onContent, onError, onLoadingChange }: ContentFetcherProps) {
  const webviewRef = useRef<WebView>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const didInjectRef = useRef(false);
  const lastUrlRef = useRef<string | null>(null);
  const urlStableCountRef = useRef(0);
  const pendingUrlRef = useRef<string | null>(null);
  const injectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isResolvingRef = useRef(false);

  // Resolve short URL before loading in WebView
  const [webviewUrl, setWebviewUrl] = useState<string | null>(null);

  const doInject = () => {
    if (didInjectRef.current) return;
    didInjectRef.current = true;
    webviewRef.current?.injectJavaScript(EXTRACT_SCRIPT);
  };

  const scheduleInject = () => {
    if (injectTimerRef.current) {
      clearTimeout(injectTimerRef.current);
    }
    injectTimerRef.current = setTimeout(() => {
      doInject();
    }, INJECT_DELAY_MS);
  };

  const resetState = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (injectTimerRef.current) clearTimeout(injectTimerRef.current);
    retryCountRef.current = 0;
    didInjectRef.current = false;
    lastUrlRef.current = null;
    urlStableCountRef.current = 0;
    pendingUrlRef.current = null;
  };

  // Reset when URL changes
  useEffect(() => {
    if (!url) return;

    resetState();
    isResolvingRef.current = false;
    setWebviewUrl(null);

    // Resolve short URL first (xhslink.com, etc.)
    resolveShortUrl(url).then((resolved) => {
      if (isResolvingRef.current) return; // URL changed while resolving
      isResolvingRef.current = true;
      setWebviewUrl(resolved);
    });

    onLoadingChange?.(true);

    // Set timeout
    timeoutRef.current = setTimeout(() => {
      if (!didInjectRef.current) {
        didInjectRef.current = true;
        onLoadingChange?.(false);
        if (retryCountRef.current < MAX_RETRIES) {
          // Retry: reload
          retryCountRef.current += 1;
          didInjectRef.current = false;
          pendingUrlRef.current = url;
          onLoadingChange?.(true);
          webviewRef.current?.reload();
          timeoutRef.current = setTimeout(() => {
            if (!didInjectRef.current) {
              didInjectRef.current = true;
              onLoadingChange?.(false);
              onError(`Page load timed out after ${MAX_RETRIES + 1} attempts. The site may be blocking automated access.`);
            }
          }, TIMEOUT_MS);
        } else {
          onError('Page load timed out. The site may be blocking automated access.');
        }
      }
    }, TIMEOUT_MS);

    return () => {
      resetState();
    };
  }, [url]);

  const handleMessage = (event: WebViewMessageEvent) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (injectTimerRef.current) {
      clearTimeout(injectTimerRef.current);
    }
    if (!didInjectRef.current) {
      didInjectRef.current = true;
    }
    onLoadingChange?.(false);

    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.success) {
        onContent({
          title: data.title || 'Untitled',
          text: data.text || '',
          html: data.html || '',
        });
      } else {
        onError(data.error || 'Failed to extract content');
      }
    } catch (e) {
      onError('Failed to parse extracted content');
    }
  };

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    if (!navState.url || didInjectRef.current) return;

    // Check if URL has changed (redirect detected)
    const currentUrl = navState.url;
    if (currentUrl !== lastUrlRef.current) {
      // URL changed - likely a redirect, reset stability counter
      lastUrlRef.current = currentUrl;
      urlStableCountRef.current = 0;

      // If this is a new navigation to the same target URL, wait for it to settle
      if (pendingUrlRef.current && currentUrl === pendingUrlRef.current) {
        pendingUrlRef.current = null;
      }

      // If URL is still loading, wait
      if (navState.loading) return;

      // URL changed and now idle - schedule injection
      scheduleInject();
    } else {
      // Same URL, check if page has finished loading
      if (!navState.loading) {
        urlStableCountRef.current += 1;
        // URL has been stable for this event - inject
        scheduleInject();
      }
    }
  };

  const handleError = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (injectTimerRef.current) clearTimeout(injectTimerRef.current);
    if (!didInjectRef.current) {
      didInjectRef.current = true;
      onLoadingChange?.(false);
      onError('Failed to load the page');
    }
  };

  if (!url) return null;

  return (
    <View
      style={{
        position: 'absolute',
        opacity: 0,
        zIndex: -1,
        top: -SCREEN_HEIGHT,
        left: 0,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
      }}
    >
      <WebView
        key={webviewUrl || url}
        ref={webviewRef}
        source={{ uri: webviewUrl || url }}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigationStateChange}
        onError={handleError}
        onHttpError={handleError}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={false}
        hideKeyboardAccessoryView={true}
        allowsBackForwardNavigationGestures={false}
        // User agent to appear more like a real browser
        applicationNameForUserAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      />
    </View>
  );
}
