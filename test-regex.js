const text1 = `<think>
This is a thinking process.
I should output JSON.
</think>
\`\`\`json
{
  "概要": "这是一个测试的概要。包含{括号}。"
}
\`\`\`
`;

let clean = text1.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/\[[^\]]*\]\s*/g, '').trim();
const jsonMatch = clean.match(/\{[\s\S]*\}/);
if (jsonMatch) {
  try {
    console.log(JSON.parse(jsonMatch[0]));
  } catch (e) {
    console.error("Parse error 1:", e);
  }
} else {
  console.log("No match 1");
}
