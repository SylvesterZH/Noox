export interface ParsedContent {
  title: string;
  content: string;
  description?: string;
}

export async function fetchPage(url: string): Promise<ParsedContent> {
  const encodedUrl = encodeURIComponent(url);
  const jinaUrl = `https://r.jina.ai/${encodedUrl}`;

  let response: Response;
  try {
    response = await fetch(jinaUrl, {
      headers: {
        Accept: 'text/markdown',
        'X-Return-Format': 'markdown',
      },
    });
  } catch (err) {
    throw new Error(`Jina network error: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Jina fetch failed: ${response.status} - ${text}`);
  }

  const markdown = await response.text();
  return parseMarkdown(markdown);
}

export function parseMarkdown(markdown: string): ParsedContent {
  const lines = markdown.split('\n');

  let title = '';
  let description = '';

  // Title: first H1 or first non-empty line
  for (const line of lines) {
    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match) {
      title = h1Match[1].trim();
      break;
    }
    if (line.trim() && !title) {
      title = line.trim();
    }
  }

  // Description: first paragraph after title that has substantial content
  let inCodeBlock = false;
  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Skip headers and empty lines
    if (line.startsWith('#') || line.startsWith('![') || !line.trim()) continue;

    // Look for first substantial paragraph
    if (line.trim().length > 50) {
      description = line.trim();
      break;
    }
  }

  // Content: collect substantive paragraphs (skip code, images, headers)
  const paragraphs: string[] = [];
  inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    if (line.startsWith('#') || line.startsWith('![') || line.startsWith('[')) continue;
    if (line.trim().length < 30) continue;

    paragraphs.push(line.trim());
  }

  const content = paragraphs.slice(0, 5).join(' ').substring(0, 2000);

  return {
    title: title || 'Untitled',
    content: content || description,
    description: description.substring(0, 300),
  };
}

export function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Parse HTML content from WebView
export function parseHtmlContent(html: string): ParsedContent {
  const title = extractTitleFromHtml(html);
  const text = extractTextFromHtml(html);

  return {
    title: title || 'Untitled',
    content: text.substring(0, 2000),
    description: text.substring(0, 300),
  };
}

function extractTitleFromHtml(html: string): string {
  // Try to find <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();

  // Try to find <h1> tag
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) return h1Match[1].trim();

  // Try og:title
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (ogTitleMatch) return ogTitleMatch[1].trim();

  return '';
}

function extractTextFromHtml(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Replace common block elements with newlines
  text = text.replace(/<\/(p|div|section|article|header|footer|main|li|tr)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

// Extract title from plain text (for contentType = 'text')
export function extractTitleFromText(text: string): string {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return 'Untitled';

  // First line is likely the title
  return lines[0].substring(0, 100);
}

// Check if a title is noise (image count, page count, etc.)
export function isNoiseTitle(title: string): boolean {
  if (!title || title === 'Untitled') return true;

  // Match "1/6", "2/9" etc. (image/page count)
  if (/^\d+\/\d+$/.test(title)) return true;

  // Match "第1页/共6页" etc.
  if (/第?\d+页?\/?共?\d+页?/.test(title)) return true;

  // Match "图1/6" etc.
  if (/图\d+\/\d+/.test(title)) return true;

  // Too short with numbers (likely noise)
  if (title.length <= 3 && /\d/.test(title)) return true;

  // Very short titles (likely not real titles)
  if (title.length <= 2) return true;

  return false;
}
