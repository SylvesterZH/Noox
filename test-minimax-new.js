const { MINIMAX_API_KEY } = process.env;

const content = `面对“力能扛鼎”的史书记载，何润东进行高强度增肌，穿起七十斤重甲，在近零下二十度环境中裸臂涂血浆拍摄两周，拒绝替身完成骑马冲锋全景打戏。他系统研读《史记》，辩证分析坑杀秦军等争议事件，提出“人性本善”立场剖析项羽重义轻谋的政治短板，将“非黑即白”的价值观与“破釜沉舟”的决绝融入表演设计。2026年初，因《楚汉传奇》中项羽角色，何润东意外走红网络，被年轻观众冠以“粉底液将军”称号。这位出道32年的演员，从北美街头洗碗少年成长为演绎古典顶级武将的专业演员，他的隐藏才华与“大巧若拙”的人生哲学构成独特张力。项羽角色的成功，不仅源于极限的身体塑造，更因为他深刻理解了悲剧英雄忠于本性的哲学内核。`;

const prompt1 = `Summarize this article (简体中文) in 2-3 sentences in 中文. Also provide 3-5 tags in 中文. Return as JSON: {"summary": "...", "tags": [...]}. Article: ${content}`;

const prompt2 = `# 角色设定
你是一个专业、高效的"核心信息提炼专家"。你的目标是深度萃取文章中的高价值细节，帮助用户进行高效的结构化扫读。

# 核心任务
1. 绝对语言镜像：自动识别输入文章的语种。你的所有输出内容必须与原文语言完全一致（使用 简体中文）。
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
      "subtitle": "[小标题1]",
      "content": "[核心内容1]"
    },
    {
      "subtitle": "[小标题2]",
      "content": "[核心内容2]"
    },
    {
      "subtitle": "[小标题3]",
      "content": "[核心内容3]"
    }
  ]
}

# 用户输入
请提炼以下内容：
${content}`;

async function test(prompt, temp) {
  const response = await fetch('https://api.minimaxi.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.7',
      messages: [{ role: 'user', content: prompt }],
      temperature: temp,
      max_tokens: 1500,
    }),
  });
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  console.log("Raw:\n", text);
  const clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    console.log("Parsed:\n", JSON.parse(jsonMatch[0]));
  }
}

async function run() {
  console.log("=== SUMMARY ===");
  await test(prompt1, 0.7);
  console.log("\n=== UNIFIED ===");
  await test(prompt2, 0.1);
}

run();
