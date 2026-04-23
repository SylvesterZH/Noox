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
  const langMap: Record<string, { label: string; outputLang: string; summaryTitle: string; detailsTitle: string }> = {
    zh: { label: '中文', outputLang: '中文', summaryTitle: '概要', detailsTitle: '详述' },
    ja: { label: '日本語', outputLang: '日本語', summaryTitle: '概要', detailsTitle: '詳述' },
    ko: { label: '한국어', outputLang: '한국어', summaryTitle: '概要', detailsTitle: '詳述' },
    multilingual: { label: 'the detected language', outputLang: 'the original language of the content', summaryTitle: 'Summary', detailsTitle: 'Details' },
    en: { label: 'English', outputLang: 'English', summaryTitle: 'Summary', detailsTitle: 'Details' },
  };

  const { label, outputLang, summaryTitle, detailsTitle } = langMap[lang] || langMap['en'];

  return `# 角色设定
你是一个专业、高效的"核心信息提炼专家"。你的首要目标是帮助用户极大地节省阅读时间，从繁杂的文本中精准萃取最具价值的核心信息，便于快速扫读。

# 核心任务
1. 绝对语言镜像：自动识别输入文章的语种。**你的所有输出内容（包括正文和排版标题）必须与原文语言完全一致！** 如果原文是英文，你的标题必须用 "Summary" 和 "Details"，正文必须全英文；以此类推。
2. 深度提炼：剔除冗余背景、过渡句和无关细节，仅保留绝对核心观点和关键数据。

# 严格约束条件
1. 长度限制：输出总长度**严格控制在 800 个字符以内**。
2. 客观中立：忠于原文，绝对不添加任何个人评判或推测。
3. 拒绝废话：不要输出任何多余的开头寒暄或结尾（例如 "Here is the summary..."），直接输出结构化结果。

# 输出格式
(注意：请严格根据原文语言，自动替换下方括号中的标题名称)

-  **[${summaryTitle}]**：（用精炼的 2-3 句话概括文章的核心目的、主要背景或最终结论）
-  **[${detailsTitle}]**：（使用项目符号，列出 3-8 条最具价值的核心信息、逻辑脉络或关键数据）

# 用户输入
请提炼以下内容：
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

  // DEBUG: log raw response (truncated)
  console.log('[generateDetailedSummary] raw response:', text.substring(0, 500));

  // Step 0: Remove thinking tags if present
  let cleanText = text.replace(/<\/?(?:think|thought)>/gi, '').trim();
  // Also remove <think> and ]]> style tags
  cleanText = cleanText.replace(/^(?:<think>|<\/思考>)[\s\S]*?(?:|<\/思考>)/i, '').trim();

  // Try to parse JSON from the response
  try {
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Check all possible keys based on language
      const overview = parsed['概要'] || parsed['Summary'] || parsed['overview'] || parsed['summary'] || '';
      const detailsRaw = parsed['详述'] || parsed['Details'] || parsed['details'] || parsed['詳述'] || [];
      const details = Array.isArray(detailsRaw) ? detailsRaw.slice(0, 8) : [];
      console.log('[generateDetailedSummary] JSON parsed, overview length:', overview.length, 'details count:', details.length);
      if (overview || details.length > 0) {
        return { overview, details };
      }
    }
  } catch (e) {
    console.error('[generateDetailedSummary] JSON parse error:', e);
    // Fall through to try text parsing
  }

  // Fallback: try to parse plain text format
  // Supports both Chinese and English labels, with or without markdown bold (**text**)
  try {
    // Match patterns like "**概要**：" or "概要：" or "Summary:"
    const overviewMatch = cleanText.match(/(?:\*\*)?(?:概要|Summary|Overview)(?:\*\*)?[:：]\s*([^\n]*?)(?:\n|$)/i);
    const overview = overviewMatch ? overviewMatch[1].trim() : '';
    const details: string[] = [];
    // Match bullet points - support numbered lists (1. 2. etc) and bullet points (- * •)
    const detailsSectionMatch = cleanText.match(/(?:\*\*)?(?:详述|Details|詳述)(?:\*\*)?[:：：]?\s*([\s\S]*?)$/i);
    if (detailsSectionMatch) {
      const sectionContent = detailsSectionMatch[1];
      // Match various bullet formats: "- item", "* item", "1. item", "① item", etc.
      const bulletMatches = sectionContent.match(/(?:^|\n)\s*(?:[-*•]|\d+\.|①|②|③|④|⑤|⑥|⑦|⑧)[.、]\s*(.+)/gm);
      if (bulletMatches) {
        for (const m of bulletMatches) {
          const item = m.replace(/^\s*(?:[-*•]|\d+\.|①|②|③|④|⑤|⑥|⑦|⑧)[.、]\s*/, '').trim();
          if (item) details.push(item);
        }
      }
    }
    console.log('[generateDetailedSummary] text parsed, overview length:', overview.length, 'details count:', details.length);
    if (overview || details.length > 0) {
      return { overview: overview || content.substring(0, 150) + '...', details: details.slice(0, 8) };
    }
  } catch (e) {
    console.error('[generateDetailedSummary] text parse error:', e);
    // Fall through to default
  }

  // Fallback if all parsing fails
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
