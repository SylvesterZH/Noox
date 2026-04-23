import { Env } from '../index';

export interface SummaryResult {
  summary: string;
  tags: string[];
}

export interface TitleResult {
  title: string;
}

function detectLanguage(text: string): string {
  // Sample the first 500 chars for language detection
  const sample = text.substring(0, 500);

  // Count Chinese characters (CJK Unified Ideographs)
  const chineseChars = (sample.match(/[\u4e00-\u9fff]/g) || []).length;

  // Count Japanese characters (Hiragana + Katakana + CJK)
  const japaneseChars = (sample.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;

  // Count Korean characters (Hangul)
  const koreanChars = (sample.match(/[\uac00-\ud7af]/g) || []).length;

  const total = sample.replace(/\s/g, '').length;
  if (total === 0) return 'en';

  const chineseRatio = chineseChars / total;
  const japaneseRatio = japaneseChars / total;
  const koreanRatio = koreanChars / total;

  if (chineseRatio > 0.3) return 'zh';
  if (japaneseRatio > 0.3) return 'ja';
  if (koreanRatio > 0.3) return 'ko';

  // Check for other non-Latin scripts (Arabic, Cyrillic, etc.)
  const nonLatinChars = (sample.match(/[^\u0000-\u007F\u0080-\u00FF\u0100-\u017F\u0180-\u024F]/g) || []).length;
  if (nonLatinChars / total > 0.3) return 'multilingual';

  return 'en';
}

function buildPrompt(content: string, lang: string): string {
  const langMap: Record<string, { label: string; summaryLang: string; tagsLang: string }> = {
    zh: { label: '中文', summaryLang: '中文', tagsLang: '中文' },
    ja: { label: '日本語', summaryLang: '日本語', tagsLang: '日本語' },
    ko: { label: '한국어', summaryLang: '한국어', tagsLang: '한국어' },
    multilingual: { label: 'the detected language', summaryLang: 'the original language of the content', tagsLang: 'English or the original language' },
    en: { label: 'English', summaryLang: 'English', tagsLang: 'English' },
  };

  const { label, summaryLang, tagsLang } = langMap[lang] || langMap['en'];

  return `You are a helpful assistant that summarizes web content.

Analyze the following article (detected language: ${label}) and provide:
1. A 2-3 sentence summary in ${summaryLang} (concise, factual, no fluff)
2. 3-5 relevant tags in ${tagsLang} (single words or short phrases, lowercase)

Return your response as a JSON object with this exact format:
{
  "summary": "...",
  "tags": ["tag1", "tag2", "tag3"]
}

Requirements:
- Summary must be in ${summaryLang}, matching the original article's language
- Tags should be lowercase, concise (1-2 words max)
- If content is too short or unclear, still return valid JSON with your best effort
- Do not make up information not present in the article`;
}

export async function generateSummary(
  env: Env,
  content: string
): Promise<SummaryResult> {
  const lang = detectLanguage(content);
  const prompt = `${buildPrompt(content, lang)}

Article content:
---
${content.substring(0, 3000)}
---`;

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
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
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

  // Try to parse JSON from the response
  try {
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || 'Failed to generate summary',
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
      };
    }
  } catch {
    // Fall through to default
  }

  // Fallback if JSON parsing fails
  return {
    summary: content.substring(0, 150) + '...',
    tags: [],
  };
}

export interface DetailedSummaryResult {
  overview: string;
  details: string[];
}

function buildDetailedPrompt(content: string, lang: string): string {
  const langMap: Record<string, { label: string; outputLang: string }> = {
    zh: { label: '中文', outputLang: '中文' },
    ja: { label: '日本語', outputLang: '日本語' },
    ko: { label: '한국어', outputLang: '한국어' },
    multilingual: { label: 'the detected language', outputLang: 'the original language of the content' },
    en: { label: 'English', outputLang: 'English' },
  };

  const { label, outputLang } = langMap[lang] || langMap['en'];

  return `# 角色设定
你是一个专业、高效的"核心信息提炼专家"。你的首要目标是帮助用户极大地节省阅读时间，从繁杂的文本中精准萃取最具价值的核心信息，以便用户进行快速扫读。

# 核心任务
1. 语言镜像：自动识别用户提供文章的语种。**必须使用与原文完全相同的语言**进行后续的所有内容输出。
2. 深度提炼：通读全文，剔除冗余的背景铺垫、过渡句和无关紧要的细节，仅保留文章的绝对核心观点、关键数据或有价值的结论。

# 严格约束条件
1. 字数限制：总结的总长度**严格控制在 800 个字符以内**（包含标点符号和空格）。
2. 客观中立：忠于原文，绝对不要添加任何个人的评判、引申或原文未提及的推测。
3. 拒绝废话：不要输出诸如"这篇文章讲述了…"、"为您总结如下…"等无意义的开头或结尾，直接输出结果。

# 输出格式
请严格按照以下结构输出，以实现最高的阅读效率：
-  **概要**：（用精炼的 2-3 句话概括文章的核心目的、主要背景或最终结论）
-  **详述**：（使用项目符号，列出 3-8 条最具价值的核心信息、逻辑脉络或关键数据）

# 文章信息
- 检测到的语种：${label}

# 文章内容
---
${content.substring(0, 3000)}
---`;
}

export async function generateDetailedSummary(
  env: Env,
  content: string
): Promise<DetailedSummaryResult> {
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
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';

  // Try to parse JSON from the response
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        overview: parsed['概要'] || parsed.overview || '',
        details: Array.isArray(parsed['详述'] || parsed.details)
          ? (parsed['详述'] || parsed.details).slice(0, 8)
          : [],
      };
    }
  } catch {
    // Fall through to default
  }

  // Fallback if JSON parsing fails
  return {
    overview: content.substring(0, 150) + '...',
    details: [],
  };
}

export async function generateTitle(
  env: Env,
  content: string,
  lang: string = 'en'
): Promise<TitleResult> {
  const langMap: Record<string, string> = {
    zh: '中文',
    ja: '日本語',
    ko: '한국어',
    en: 'English',
  };
  const langLabel = langMap[lang] || 'English';

  const prompt = `You are a helpful assistant that titles web content.

Analyze the following article (detected language: ${langLabel}) and generate a concise, accurate title in ${langLabel}.

Requirements:
- Title should be 10-30 characters
- Title should be descriptive and capture the main topic
- Do not use quotes or special formatting
- Do not make up information not present in the article
- If the content is unclear, provide your best guess based on available information

Return your response as a JSON object with this exact format:
{
  "title": "your generated title here"
}

Article content:
---
${content.substring(0, 3000)}
---`;

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
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
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

  // Try to parse JSON from the response
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: parsed.title || 'Untitled',
      };
    }
  } catch {
    // Fall through to default
  }

  // Fallback if JSON parsing fails
  return {
    title: 'Untitled',
  };
}
