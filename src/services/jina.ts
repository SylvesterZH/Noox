export interface ParsedContent {
  title: string;
  content: string;
  description?: string;
}

export async function fetchPage(url: string): Promise<ParsedContent> {
  const encodedUrl = encodeURIComponent(url);
  const jinaUrl = `https://r.jina.ai/${encodedUrl}`;

  const response = await fetch(jinaUrl, {
    headers: {
      Accept: 'text/markdown',
      'X-Return-Format': 'markdown',
    },
  });

  if (!response.ok) {
    throw new Error(`Jina fetch failed: ${response.statusText}`);
  }

  const markdown = await response.text();
  return parseMarkdown(markdown);
}

function parseMarkdown(markdown: string): ParsedContent {
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
