const { MINIMAX_API_KEY } = process.env;
if (!MINIMAX_API_KEY) {
  console.log("No API key set, skipping local test");
  process.exit(0);
}

const prompt = `# 角色设定
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
请用简体中文输出以下JSON格式，不要包含任何其他文字：
{"详述":["[要点1]","[要点2]","[要点3]","[要点4]"]}

# 用户输入
请提取以下内容的详述要点：
高学历人才正大量涌入AI数据标注行业，这些看似高薪的岗位要求985毕业生给AI出题、改作业，实际上处于产业链下游，无法接触核心产品与算法。标注员在"训练AI变聪明"的过程中自身也遭受消耗，而更广泛的现实是，每个人都在以不同方式参与这场"投喂"AI的集体劳动。`;

async function main() {
  const response = await fetch('https://api.minimaxi.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.7',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });
  const data = await response.json();
  console.log("RAW RESPONSE:", JSON.stringify(data.choices?.[0]?.message?.content, null, 2));
}

main().catch(console.error);
