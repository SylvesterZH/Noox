import { Env } from '../index';

export interface SummaryResult {
  summary: string;
  tags: string[];
}

const SUMMARY_PROMPT = `You are a helpful assistant that summarizes web content.

Analyze the following article and provide:
1. A 2-3 sentence summary (concise, factual, no fluff)
2. 3-5 relevant tags (single words or short phrases, lowercase)

Return your response as a JSON object with this exact format:
{
  "summary": "...",
  "tags": ["tag1", "tag2", "tag3"]
}

Requirements:
- Summary should capture the main point and key takeaways
- Tags should be lowercase, concise (1-2 words max)
- If content is too short or unclear, still return valid JSON with your best effort
- Do not make up information not present in the article`;

export async function generateSummary(
  env: Env,
  content: string
): Promise<SummaryResult> {
  const prompt = `${SUMMARY_PROMPT}\n\nArticle content:\n---\n${content.substring(0, 3000)}\n---`;

  const response = await fetch(`${env.MINIMAX_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.MINIMAX_MODEL,
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
