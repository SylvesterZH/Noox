const { MINIMAX_API_KEY } = process.env;

async function generateTitle(content, lang = 'en') {
  const langMap = {
    zh: '中文', ja: '日本語', ko: '한국어', en: 'English',
  };
  const langLabel = langMap[lang] || 'English';
  const prompt = `Generate a concise title (10-30 chars) in ${langLabel} for this article. Return as JSON: {"title": "..."}. Article: ${content.substring(0, 3000)}`;

  const response = await fetch('https://api.minimaxi.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.7',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 50,
    }),
  });
  
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  console.log("RAW TEXT:", text);

  try {
    const clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    console.log("CLEAN:", clean);
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { title: parsed.title || 'Untitled' };
    }
  } catch (e) { console.error("ERR", e) }

  return { title: 'Untitled' };
}

generateTitle("高学历人才正大量涌入AI数据标注行业...", "zh").then(console.log).catch(console.error);
