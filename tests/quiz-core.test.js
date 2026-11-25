import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateBank, fresh, restore, isCorrect, isWrong, completed,
  filterQuestions, statistics, assessments, topics, difficulties,
} from '../quiz-core.js';

const raw = JSON.parse(readFileSync(new URL('../data/questions.json', import.meta.url), 'utf8'));
const bank = validateBank(structuredClone(raw));
const single = bank.questions.find(q => q.type === 'single');
const short = bank.questions.find(q => q.type === 'short');
const allStates = () => Object.fromEntries(bank.questions.map(q => [q.id, fresh(q)]));

test('题库包含八个专题、两种题型且通过结构校验', () => {
  assert.ok(bank.questions.length >= 430, `expected 430+, got ${bank.questions.length}`);
  assert.equal(new Set(bank.questions.map(q => q.id)).size, bank.questions.length);
  assert.ok(bank.questions.filter(q => q.type === 'single').length >= 320);
  assert.ok(bank.questions.filter(q => q.type === 'short').length >= 95);
  const counts = Object.fromEntries(topics.map(topic => [topic, bank.questions.filter(q => q.topic === topic).length]));
  for (const topic of ['AI Infra', 'vLLM', 'SGLang']) {
    assert.ok(counts[topic] >= 95, `${topic} expected 95+, got ${counts[topic]}`);
    assert.ok(counts[topic] > counts.Motor * 2, `${topic} should far exceed Motor: ${counts[topic]} vs ${counts.Motor}`);
  }
  assert.ok(counts.Motor >= 40);
  assert.ok(counts['面经'] >= 20, `面经 expected 20+, got ${counts['面经']}`);
  for (const topic of ['TensorRT-LLM', '量化', 'CUDA/GPU']) {
    assert.ok(counts[topic] >= 20, `${topic} expected 20+, got ${counts[topic]}`);
  }
  for (const q of bank.questions) {
    assert.ok(difficulties.includes(q.difficulty));
    assert.ok(q.answer.keyPoints.length >= 3);
    assert.ok(q.answer.pitfalls.length >= 1);
    assert.ok(q.answer.followUps.length >= 1);
    assert.ok(q.answer.terms.length >= 3 && q.answer.terms.length <= 5);
    assert.ok(q.answer.deepDive.length >= 180);
    if (q.type === 'single') {
      assert.deepEqual(Object.keys(q.answer.optionNotes).sort(), q.options.map(o => o.id).sort());
    } else {
      assert.equal(q.answer.optionNotes, undefined);
    }
    assert.ok(q.sourceIds.every(id => bank.sources.some(s => s.id === id)));
  }
  for (const source of bank.sources) assert.match(source.url, /^https?:\/\//);
});

test('结构校验拒绝重复ID、错误来源和带选项的简答题', () => {
  const duplicate = structuredClone(bank);
  duplicate.questions[1].id = duplicate.questions[0].id;
  assert.throws(() => validateBank(duplicate), /题目身份/);

  const badSource = structuredClone(bank);
  badSource.questions[0].sourceIds = ['missing'];
  assert.throws(() => validateBank(badSource), /来源无效/);

  const shortWithOptions = structuredClone(bank);
  shortWithOptions.questions.find(q => q.type === 'short').options = [{ id: 'A', text: 'x' }];
  assert.throws(() => validateBank(shortWithOptions), /简答题不应包含选项/);

  const unknownTopic = structuredClone(bank);
  unknownTopic.questions[0].topic = 'GPU';
  assert.throws(() => validateBank(unknownTopic), /未知专题/);
});

test('恢复进度时核对revision并丢弃无效选择', () => {
  const differentRevision = restore(single, { revision: single.revision + 1, selected: single.answer.optionId, submitted: true });
  assert.equal(differentRevision.submitted, false);
  assert.equal(differentRevision.selected, null);

  const invalidSelection = restore(single, { revision: single.revision, selected: 'Z', submitted: true });
  assert.equal(invalidSelection.submitted, false);
  assert.equal(invalidSelection.selected, null);

  const valid = restore(single, { revision: single.revision, selected: single.answer.optionId, submitted: true, bookmarked: true });
  assert.equal(valid.submitted, true);
  assert.equal(valid.bookmarked, true);
  assert.equal(isCorrect(single, valid), true);

  const unrevealedRating = restore(short, { revision: short.revision, text: '回答', selfAssessment: '已掌握', revealed: false });
  assert.equal(unrevealedRating.selfAssessment, null);
  assert.equal(unrevealedRating.text, '回答');
});

test('单选正确性与简答自评分开统计', () => {
  const states = allStates();
  const [s1, s2] = bank.questions.filter(q => q.type === 'single');
  const sh = bank.questions.find(q => q.type === 'short');

  Object.assign(states[s1.id], { selected: s1.answer.optionId, submitted: true, revealed: true });
  const wrongOption = s2.options.find(o => o.id !== s2.answer.optionId).id;
  Object.assign(states[s2.id], { selected: wrongOption, submitted: true, revealed: true });
  Object.assign(states[sh.id], { text: '我的回答', revealed: true, selfAssessment: '部分掌握' });

  const s = statistics(bank.questions, states);
  assert.equal(s.attempted, 2);
  assert.equal(s.correct, 1);
  assert.equal(s.accuracy, 50);
  assert.equal(s.selfRated, 1);
  assert.equal(completed(s2, states[s2.id]), true);
  assert.equal(isWrong(s2, states[s2.id]), true);
  assert.equal(isWrong(sh, states[sh.id]), true);
  assert.equal(completed(sh, states[sh.id]), true);
  assert.equal(statistics(bank.questions, allStates()).accuracy, null);
  assert.ok(assessments.includes('已掌握'));
});

test('筛选按专题、难度、题型、关键词与练习模式组合生效', () => {
  const states = allStates();
  const base = { topic: '', difficulty: '', type: '', search: '', mode: 'all' };
  assert.equal(filterQuestions(bank.questions, states, { ...base, topic: 'Motor' }).length, bank.questions.filter(q => q.topic === 'Motor').length);
  assert.equal(filterQuestions(bank.questions, states, { ...base, type: 'short' }).length, bank.questions.filter(q => q.type === 'short').length);
  assert.equal(filterQuestions(bank.questions, states, { ...base, difficulty: '基础', type: 'single' }).length, bank.questions.filter(q => q.difficulty === '基础' && q.type === 'single').length);
  assert.equal(filterQuestions(bank.questions, states, { ...base, difficulty: '进阶', type: 'short' }).length, bank.questions.filter(q => q.difficulty === '进阶' && q.type === 'short').length);
  assert.equal(filterQuestions(bank.questions, states, { ...base, search: '前缀' }).length > 0, true);
  assert.equal(filterQuestions(bank.questions, states, { ...base, topic: '不存在' }).length, 0);

  const target = bank.questions[0];
  states[target.id].submitted = true;
  states[target.id].selected = target.options.find(o => o.id !== target.answer.optionId).id;
  assert.deepEqual(filterQuestions(bank.questions, states, { ...base, mode: 'wrong' }).map(q => q.id), [target.id]);

  states[target.id].bookmarked = true;
  assert.deepEqual(filterQuestions(bank.questions, states, { ...base, mode: 'bookmarked' }).map(q => q.id), [target.id]);
});
