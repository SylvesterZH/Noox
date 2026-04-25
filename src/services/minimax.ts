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

export interface OverviewResult {
  overview: string;
}

export interface DetailsResult {
  details: string[];
}

function buildOverviewPrompt(content: string, lang: string): string {
  const langMap: Record<string, { title: string; label: string }> = {
    zh: { title: '概要', label: '简体中文' },
    zh_TW: { title: '概要', label: '繁體中文' },
    ja: { title: '概要', label: '日本語' },
    ko: { title: '概要', label: '한국어' },
    pt: { title: 'Resumo', label: 'Português' },
    es: { title: 'Resumen', label: 'Español' },
    fr: { title: 'Résumé', label: 'Français' },
    de: { title: 'Zusammenfassung', label: 'Deutsch' },
    en: { title: 'Summary', label: 'English' },
  };
  const { title, label } = langMap[lang] || langMap['en'];

  return `# 角色设定
你是一个专业、高效的"核心信息提炼专家"。你的目标是从繁杂的文本中提炼出最核心的概要，帮助用户在几秒钟内把握文章主旨。

# 核心任务
1. 绝对语言镜像：自动识别输入文章的语种。你的所有输出内容必须与原文语言完全一致。
2. 提炼概要：用精炼的 2-3 句话概括文章的核心目的、主要背景或最终结论。

# 严格约束条件
1. 长度限制：总长度严格控制在 300 个字符以内。
2. 客观中立：忠于原文，绝对不添加任何个人评判或推测。
3. 拒绝废话：不输出任何多余的开头寒暄，直接输出JSON。

# 输出格式
请用${label}输出以下JSON格式，不要包含任何其他文字：
{"${title}":"[2-3句概括]"}

# 用户输入
请提炼以下内容的概要：
${content.substring(0, 2000)}`;
}

function buildDetailsPrompt(content: string, lang: string): string {
  const langMap: Record<string, { title: string; label: string }> = {
    zh: { title: '详述', label: '简体中文' },
    zh_TW: { title: '詳述', label: '繁體中文' },
    ja: { title: '詳述', label: '日本語' },
    ko: { title: '詳述', label: '한국어' },
    pt: { title: 'Detalhes', label: 'Português' },
    es: { title: 'Detalles', label: 'Español' },
    fr: { title: 'Détails', label: 'Français' },
    de: { title: 'Details', label: 'Deutsch' },
    en: { title: 'Details', label: 'English' },
  };
  const { title, label } = langMap[lang] || langMap['en'];

  return `# 角色设定
你是一个专业、高效的"核心信息提炼专家"。你的目标是深度萃取文章中的高价值细节，帮助用户进行高效的结构化扫读。

# 核心任务
1. 绝对语言镜像：自动识别输入文章的语种。你的所有输出内容必须与原文语言完全一致。
2. 提取详述：剔除冗余的背景铺垫、过渡句和无关细节，仅保留文章的绝对核心观点或有价值的数据。

# 严格约束条件
1. 数量限制：必须提取 3-8 条最具价值的核心信息或逻辑脉络。
2. 长度限制：输出总长度严格控制在 800 个字符以内。
3. 客观中立：忠于原文，绝对不添加任何个人评判或推测。
4. 拒绝废话：不输出任何多余的开头寒暄，直接输出JSON。

# 输出格式
请用${label}输出以下JSON格式，不要包含任何其他文字：
{"${title}":["[要点1]","[要点2]","[要点3]","[要点4]"]}

# 用户输入
请提取以下内容的详述要点：
${content.substring(0, 2000)}`;
}

async function callMinimax(prompt: string, env: Env): Promise<string> {
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
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseOverview(text: string): string {
  // Remove thinking block entirely, then extra markdown or whitespace
  let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/\[[^\]]*\]\s*/g, '').trim();

  // Try JSON parsing (greedy match to handle braces inside strings)
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      // Try all possible overview key names across languages
      const keys = ['概要', '概要', '詳述', 'Summary', 'Resumo', 'Resumen', 'Résumé', 'Zusammenfassung', 'summary', 'overview', 'Overview'];
      for (const key of keys) {
        if (parsed[key] && typeof parsed[key] === 'string') {
          const val = parsed[key].trim();
          // Reject if it looks like article content (too long)
          if (val.length > 500) continue;
          return val;
        }
      }
    } catch { /* fall through */ }
  }

  return '';
}

function parseDetails(text: string): string[] {
  // Remove thinking block entirely
  let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/\[[^\]]*\]\s*/g, '').trim();

  // Try JSON parsing (greedy match to handle braces inside strings)
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const keys = ['详述', '詳述', 'Details', 'Detalhes', 'Detalles', 'Détails', 'Details', 'details'];
      for (const key of keys) {
        if (Array.isArray(parsed[key])) {
          return parsed[key]
            .filter((v: unknown) => typeof v === 'string')
            .map((v: string) => v.trim())
            .filter(Boolean)
            .slice(0, 8);
        }
      }
    } catch { /* fall through */ }
  }

  return [];
}

export async function generateOverview(env: Env, content: string): Promise<OverviewResult> {
  const lang = detectLanguage(content);
  const prompt = buildOverviewPrompt(content, lang);

  const text = await callMinimax(prompt, env);
  console.log('[generateOverview] raw response:', text.substring(0, 300));

  const overview = parseOverview(text);

  if (overview) {
    console.log('[generateOverview] parsed OK, len:', overview.length);
    return { overview };
  }

  console.log('[generateOverview] parsing failed, fallback');
  return { overview: content.substring(0, 150) + '...' };
}

export async function generateDetails(env: Env, content: string): Promise<DetailsResult> {
  const lang = detectLanguage(content);
  const prompt = buildDetailsPrompt(content, lang);

  const text = await callMinimax(prompt, env);
  console.log('[generateDetails] raw response:', text.substring(0, 300));

  const details = parseDetails(text);

  if (details.length > 0) {
    console.log('[generateDetails] parsed OK, count:', details.length);
    return { details };
  }

  console.log('[generateDetails] parsing failed, fallback');
  return { details: [] };
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
    const clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { title: parsed.title || 'Untitled' };
    }
  } catch { /* fall through */ }

  return { title: 'Untitled' };
}