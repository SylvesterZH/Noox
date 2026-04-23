import { Env } from '../index';

export interface SummaryResult {
  summary: string;
  tags: string[];
}

export interface TitleResult {
  title: string;
}

function detectLanguage(text: string): string {
  const sample = text.substring(0, 500);
  const chineseChars = (sample.match(/[\u4e00-\u9fff]/g) || []).length;
  const japaneseChars = (sample.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  const koreanChars = (sample.match(/[\uac00-\ud7af]/g) || []).length;
  const total = sample.replace(/\s/g, '').length;
  if (total === 0) return 'en';
  if (chineseChars / total > 0.3) return 'zh';
  if (japaneseChars / total > 0.3) return 'ja';
  if (koreanChars / total > 0.3) return 'ko';
  return 'en';
}

function buildPrompt(content: string, lang: string): string {
  const langMap: Record<string, { label: string; summaryLang: string; tagsLang: string }> = {
    zh: { label: '中文', summaryLang: '中文', tagsLang: '中文' },
    ja: { label: '日本語', summaryLang: '日本語', tagsLang: '日本語' },
    ko: { label: '한국어', summaryLang: '한국어', tagsLang: '한국어' },
    multilingual: { label: 'the detected language', summaryLang: 'the original language', tagsLang: 'English' },
    en: { label: 'English', summaryLang: 'English', tagsLang: 'English' },
  };
  const { label, summaryLang, tagsLang } = langMap[lang] || langMap['en'];
  return `Summarize this article (${label}) in 2-3 sentences in ${summaryLang}. Also provide 3-5 tags in ${tagsLang}. Return as JSON: {"summary": "...", "tags": [...]}. Article: ${content.substring(0, 3000)}`;
}

export async function generateSummary(env: Env, content: string): Promise<SummaryResult> {
  const lang = detectLanguage(content);
  const prompt = buildPrompt(content, lang);
  const MINIMAX_BASE_URL = 'https://api.minimaxi.com/v1';
  const MINIMAX_MODEL = 'MiniMax-M2.7';

  const response = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || content.substring(0, 150) + '...',
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
      };
    }
  } catch { /* fall through */ }

  return { summary: content.substring(0, 150) + '...', tags: [] };
}

export interface DetailedSummaryResult {
  overview: string;
  details: string[];
}

function buildDetailedPrompt(content: string, lang: string): string {
  // Language-specific output
  const outputs: Record<string, { summaryTitle: string; detailsTitle: string; label: string }> = {
    zh: { summaryTitle: '概要', detailsTitle: '详述', label: '简体中文' },
    ja: { summaryTitle: '概要', detailsTitle: '詳述', label: '日本語' },
    ko: { summaryTitle: '概要', detailsTitle: '詳述', label: '한국어' },
    en: { summaryTitle: 'Summary', detailsTitle: 'Details', label: 'English' },
    multilingual: { summaryTitle: 'Summary', detailsTitle: 'Details', label: 'English' },
  };
  const { summaryTitle, detailsTitle, label } = outputs[lang] || outputs['en'];

  // Short, direct prompt - no verbose instructions
  return `请用${label}输出以下JSON格式（不要包含任何其他文字）：
{"${summaryTitle}":"2-3句概括","${detailsTitle}":["要点1","要点2","要点3"]}

严格控制总长度在800字符以内。只输出JSON，不要解释。

文章内容：
${content.substring(0, 3000)}`;
}

export async function generateDetailedSummary(env: Env, content: string): Promise<DetailedSummaryResult> {
  const lang = detectLanguage(content);
  const prompt = buildDetailedPrompt(content, lang);

  const MINIMAX_BASE_URL = 'https://api.minimaxi.com/v1';
  const MINIMAX_MODEL = 'MiniMax-M2.7';

  const response = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // Lower temp for more consistent output
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';

  console.log('[generateDetailedSummary] raw response:', text.substring(0, 300));

  // Clean the response - remove thinking tags
  let clean = text.replace(/<[^>]+>/g, '').replace(/\[[^\]]*\]\s*/g, '').trim();

  // Try to find and parse JSON
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      // Try all possible key combinations
      const summaryTitles = ['概要', 'Summary', 'summary', 'overview', 'Overview'];
      const detailsTitles = ['详述', 'Details', 'details', '詳述'];

      let overview = '';
      for (const key of summaryTitles) {
        if (parsed[key] && typeof parsed[key] === 'string') {
          overview = parsed[key];
          break;
        }
      }

      let details: string[] = [];
      for (const key of detailsTitles) {
        if (Array.isArray(parsed[key])) {
          details = parsed[key].slice(0, 8);
          break;
        }
      }

      // If overview is too long (likely article content instead of summary), skip
      if (overview.length > 500) {
        overview = '';
      }

      if (overview || details.length > 0) {
        console.log('[generateDetailedSummary] JSON parsed OK, overview len:', overview.length, 'details:', details.length);
        return {
          overview: overview || content.substring(0, 150) + '...',
          details,
        };
      }
    } catch (e) {
      console.error('[generateDetailedSummary] JSON parse error:', e);
    }
  }

  // If JSON parsing failed, return fallback
  console.log('[generateDetailedSummary] parsing failed, fallback');
  return {
    overview: content.substring(0, 150) + '...',
    details: [],
  };
}

export async function generateTitle(env: Env, content: string, lang: string = 'en'): Promise<TitleResult> {
  const langMap: Record<string, string> = {
    zh: '中文', ja: '日本語', ko: '한국어', en: 'English',
  };
  const langLabel = langMap[lang] || 'English';
  const prompt = `Generate a concise title (10-30 chars) in ${langLabel} for this article. Return as JSON: {"title": "..."}. Article: ${content.substring(0, 3000)}`;

  const MINIMAX_BASE_URL = 'https://api.minimaxi.com/v1';
  const MINIMAX_MODEL = 'MiniMax-M2.7';

  const response = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 50,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { title: parsed.title || 'Untitled' };
    }
  } catch { /* fall through */ }

  return { title: 'Untitled' };
}
