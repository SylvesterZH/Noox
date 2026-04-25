const text = `<think>用户要求我提取文章的核心信息点，以JSON格式输出。

原文主要内容：
1. 高学 历人才涌入AI数据标注行业
2. 这些岗位看似高薪，要求985毕业生
3. 实际工作内容是给AI出题、改作业
4. 处于产业链下游，无法接触核心产品与算法
5. 标注员在"训练AI变聪明"过程中自身也遭受消耗
6. 每个人都在以不同方式参与"投喂"AI的集体劳动

需要提取3-8条核心信息，800字符以内，JSON格式输出。

要点提炼：
1. 高学历人才（985毕业生）大量涌入AI数据标注行业
2. 岗位虽薪资可观，但工作内容是基础 性的标注、出题、改作业
3. 处于产业链下游，缺乏核心产品与算法接触机会
4. 标注员在训练AI的过程中自身也面临消耗和消耗
5. 这反映了更广泛的社会现象：大众以不同方式参与"投喂"AI的集体劳动

我需要 精简到800字以内，用JSON格式输出。</think>

{"详述":["高学历人才（985毕业生）正大量涌入AI数据 标注行业","岗位薪资看似可观，但工作内容仅为给AI出题、改作业等基础性标注任务","从业者处于产业链下游，无法接触核心产品与算法","标注员在\"训练AI变聪明\"的过程中自身也遭受消耗","这一现象折射出更广泛的社会现实：每个人都在以不同方式参与\"投喂\"AI的集体劳动"]}`;

function parseDetails(text) {
  let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/\[[^\]]*\]\s*/g, '').trim();

  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log("Parsed JSON:", parsed);
      const keys = ['详述', '詳述', 'Details', 'Detalhes', 'Detalles', 'Détails', 'Details', 'details'];
      for (const key of keys) {
        if (Array.isArray(parsed[key])) {
          return parsed[key]
            .filter(v => typeof v === 'string')
            .map(v => v.trim())
            .filter(Boolean)
            .slice(0, 8);
        }
      }
    } catch (e) {
        console.error("Parse Error:", e);
    }
  }
  return [];
}

console.log(parseDetails(text));
