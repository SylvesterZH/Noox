import { Env } from '../index';

export interface SummaryResult {
  summary: string;
  tags: string[];
}

export interface TitleResult {
  title: string;
}

export interface OverviewResult {
  overview: string;
}

export interface DetailsResult {
  details: string[];
}

export interface UnifiedAIResult {
  title: string;
  overview: string;
  details: Array<{ subtitle: string; content: string } | string>;
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

function buildUnifiedPrompt(content: string, lang: string): string {
  const langMap: Record<string, string> = {
    zh: '简体中文',
    zh_TW: '繁體中文',
    ja: '日本語',
    ko: '한국어',
    pt: 'Português',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    en: 'English',
  };
  const label = langMap[lang] || langMap['en'];

  return `# 角色设定
你是一个专业、高效的"核心信息提炼专家"。你的目标是深度萃取文章中的高价值细节，帮助用户进行高效的结构化扫读。

# 核心任务
1. 绝对语言镜像：自动识别输入文章的语种。你的所有输出内容必须与原文语言完全一致（使用 ${label}）。
2. 提取标题：为文章生成或提取一个准确且简短的标题（10-30个字符）。
3. 提炼概要：用精炼的 2-3 句话概括文章的核心目的、主要背景或最终结论（不超过300个字符）。
4. 结构化详述：提取文章的 3-5 个核心模块/逻辑脉络。每个模块必须包含一个高度概括的「小标题」（subtitle）和一段有血有肉、条理清晰的「核心内容」（content）。不要使用任何 emoji 或特殊符号（如 * 或 #）。

# 严格约束条件
1. 客观中立：忠于原文，绝对不添加任何个人评判或推测。
2. 拒绝废话：不输出任何多余的开头寒暄，必须直接且仅输出JSON。
3. 结构严谨：小标题要求极简、克制；核心内容要求丰满、有逻辑（每个模块的内容长度控制在 50-150 字）。

# 输出格式
请务必直接输出以下JSON格式，不要包含任何其他文字或 markdown 格式：
{
  "title": "[文章标题]",
  "overview": "[2-3句概括]",
  "details": [
    {
      "subtitle": "[小标题，例如：弱者的献祭（导火索）]",
      "content": "[丰满的核心内容段落]"
    },
    {
      "subtitle": "[小标题]",
      "content": "[丰满的核心内容段落]"
    }
  ]
}

# 用户输入
请提炼以下内容：
${content.substring(0, 3000)}`;
}

export async function generateUnifiedSummary(env: Env, content: string): Promise<UnifiedAIResult> {
  const lang = detectLanguage(content);
  const prompt = buildUnifiedPrompt(content, lang);

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
      temperature: 0.1, // lowered temperature for more stable JSON output
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';

  try {
    const clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      let processedDetails: Array<{subtitle: string, content: string} | string> = [];
      if (Array.isArray(parsed.details)) {
        processedDetails = parsed.details.map((item: any) => {
          if (typeof item === 'string') return item.trim();
          if (typeof item === 'object' && item !== null) {
            return {
              subtitle: typeof item.subtitle === 'string' ? item.subtitle.trim() : '',
              content: typeof item.content === 'string' ? item.content.trim() : ''
            };
          }
          return '';
        }).filter((item: any) => item !== '' && (typeof item === 'string' || item.content !== '')).slice(0, 8);
      }

      return {
        title: typeof parsed.title === 'string' ? parsed.title.trim() : 'Untitled',
        overview: typeof parsed.overview === 'string' ? parsed.overview.trim() : '',
        details: processedDetails
      };
    }
  } catch (err) {
    console.error('[generateUnifiedSummary] Parsing failed', err);
  }

  // Fallback
  return {
    title: 'Untitled',
    overview: content.substring(0, 150) + '...',
    details: []
  };
}

// Keep the original brief summary logic for the feed card
function buildBriefSummaryPrompt(content: string, lang: string): string {
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
  const prompt = buildBriefSummaryPrompt(content, lang);
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
    const clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
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

// Deprecated functions (kept to satisfy TypeScript if they are imported elsewhere before we remove them)
export async function generateOverview(env: Env, content: string): Promise<OverviewResult> {
  return { overview: '' };
}
export async function generateDetails(env: Env, content: string): Promise<DetailsResult> {
  return { details: [] };
}
export async function generateTitle(env: Env, content: string, lang: string = 'en'): Promise<TitleResult> {
  return { title: 'Untitled' };
}