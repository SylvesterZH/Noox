const { MINIMAX_API_KEY } = process.env;

const prompt = `你是一个专业、高效的"核心信息提炼专家"。你的目标是深度萃取文章中的高价值细节，帮助用户进行高效的结构化扫读。

文章内容：
Anthropic在4年内估值增长约380倍，但早期融资极为艰难，创始人携项目拜访22家顶级VC，21家拒绝，核心原因是这些顶尖投资人当时甚至不了解GPT-3技术。早期天使投资人Anj Midha正是凭借对AI的深刻认知，从首轮跟投至最新轮次，见证了认知差距如何转化为财富神话。

请提取文章的标题、一句不超过300字的概要，以及3-8条核心详述。

严格要求：
1. 绝对语言镜像：自动识别输入文章的语种。你的所有输出内容必须与原文语言完全一致。
2. 客观中立：忠于原文，绝对不添加任何个人评判或推测。
3. 拒绝废话：不输出任何多余的开头寒暄，直接输出JSON。

必须输出以下JSON格式（不要输出除了JSON以外的任何内容，也不要使用markdown格式包裹）：
{
  "title": "[文章标题]",
  "overview": "[2-3句概括]",
  "details": [
    "[要点1]",
    "[要点2]",
    "[要点3]"
  ]
}
`;

async function testSingleCall() {
  const response = await fetch('https://api.minimaxi.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.7',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1500,
    }),
  });
  
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  console.log("RAW TEXT:\n", text);
  
  let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log("\nPARSED JSON:\n", JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log("\nFAILED TO PARSE JSON", e);
    }
  } else {
    console.log("\nNO JSON MATCH");
  }
}

testSingleCall().catch(console.error);
