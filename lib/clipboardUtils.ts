/**
 * Clipboard utilities - clean and parse clipboard content
 * 通用规则：只要链接能打开就行，不针对特定平台
 */

/**
 * 从文本中提取所有有效的 http/https URL
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s\u200b\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u205f\u3000\ufeff<>[\](){}'"]+/gi;
  const matches = text.match(urlRegex);
  return matches ? matches.map(u => u.replace(/[),。】\]]+$/, '')) : [];
}

/**
 * 从文本中提取第一个有效 URL
 */
export function extractFirstUrl(text: string): string | null {
  const urls = extractUrls(text);
  return urls.length > 0 ? urls[0] : null;
}

/**
 * 判断字符串是否是噪音（图片数量、分页等）
 */
function isNoise(str: string): boolean {
  // 匹配 "1/6", "2/9" 等图片/分页计数
  if (/^\d+\/\d+$/.test(str)) return true;
  // 匹配 "第1页/共6页"
  if (/第?\d+页?\/?共?\d+页?/.test(str)) return true;
  // 匹配 "图1/6"
  if (/图\d+\/\d+/.test(str)) return true;
  // 太短的噪音
  if (str.length <= 3 && /\d/.test(str)) return true;
  return false;
}

/**
 * 清洗标题，去除噪音
 */
export function cleanTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  if (isNoise(title)) return null;
  return title;
}

/**
 * 从文本中提取标题（取链接前后的文字）
 */
export function extractTitle(text: string, url: string): string | null {
  const content = text.replace(url, '').trim();

  // 从【】中提取
  const bracketMatch = content.match(/【(.+?)】/);
  if (bracketMatch) {
    const title = bracketMatch[1].trim();
    if (!isNoise(title)) return title;
  }

  // 从()中提取
  const parenMatch = content.match(/[(（](.+?)[)）]/);
  if (parenMatch) {
    const title = parenMatch[1].trim();
    if (!isNoise(title)) return title;
  }

  // 从""中提取
  const quoteMatch = content.match(/[""](.+?)[""]/);
  if (quoteMatch) {
    const title = quoteMatch[1].trim();
    if (!isNoise(title)) return title;
  }

  return null;
}

/**
 * 解析剪贴板内容，返回链接和标题
 */
export function parseClipboardContent(text: string): {
  url: string | null;
  title: string | null;
} {
  const url = extractFirstUrl(text);
  if (!url) {
    return { url: null, title: null };
  }

  const title = extractTitle(text, url);
  return { url, title };
}

/**
 * 从 URL 中提取域名
 */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
