import { readFileSync } from 'node:fs';
import { validateBank, topics } from '../quiz-core.js';

const file = new URL('../data/questions.json', import.meta.url);
let bank;
try {
  bank = validateBank(JSON.parse(readFileSync(file, 'utf8')));
} catch (error) {
  console.error(`题库校验失败：${error.message}`);
  process.exit(1);
}

const counts = Object.fromEntries(topics.map(topic => [topic, bank.questions.filter(q => q.topic === topic).length]));
const singles = bank.questions.filter(q => q.type === 'single').length;
const shorts = bank.questions.filter(q => q.type === 'short').length;
const missing = topics.filter(topic => !counts[topic]);

console.log(`题库通过：${bank.questions.length} 道题，${bank.sources.length} 个来源`);
console.log(`题型：单选 ${singles}，简答自评 ${shorts}`);
console.log(`专题：${topics.map(topic => `${topic} ${counts[topic]}`).join(' · ')}`);
if (missing.length) {
  console.error(`缺少专题题目：${missing.join('、')}`);
  process.exit(1);
}
