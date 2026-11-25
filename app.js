import {
  assessments, restore, isCorrect, isWrong, completed, filterQuestions,
  statistics, validateBank, topics,
} from './quiz-core.js';

const $ = id => document.getElementById(id);
const KEY = 'infra-interview-practice-v1';
const SLIDE_NAMES = {
  question: '题目', summary: '参考答案', terms: '名词拆解', explain: '为什么',
  deep: '再深一层', options: '选项辨析', review: '易错与追问', assess: '自评',
};
const app = { bank: null, states: {}, currentId: null, slideIndex: 0, topic: '', overviewOpen: false };
const overviewFilters = { search: '', topic: '', difficulty: '', type: '', wrong: false, bookmarked: false };
let saveTimer = null;
let wired = false;

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const makeButton = (label, handler, className = '') => {
  const node = el('button', className, label);
  node.type = 'button';
  node.addEventListener('click', handler);
  return node;
};
const currentQuestion = () => app.bank?.questions.find(q => q.id === app.currentId) || null;
const visibleQuestions = () => app.bank
  ? filterQuestions(app.bank.questions, app.states, { topic: app.topic, difficulty: '', type: '', search: '', mode: 'all' })
  : [];
const slidesFor = q => {
  if (!q) return [];
  const s = app.states[q.id];
  const result = ['question'];
  if (q.type === 'single' && s.submitted) result.push('summary', 'terms', 'explain', 'deep', 'options', 'review');
  if (q.type === 'short' && s.revealed) result.push('summary', 'terms', 'explain', 'deep', 'review', 'assess');
  return result;
};
const slideNumber = (q, key) => slidesFor(q).indexOf(key);
const slideKicker = (q, key) => `解析 ${slideNumber(q, key)} / ${slidesFor(q).length - 1} · ${q.topic}`;
const resultText = q => {
  const s = app.states[q.id];
  if (q.type === 'single') return s.submitted ? (isCorrect(q, s) ? '答对' : '答错') : '待作答';
  if (s.selfAssessment) return `自评：${s.selfAssessment}`;
  return s.revealed ? '待自评' : '待作答';
};

function save(immediate = false) {
  if (!app.bank) return;
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        schemaVersion: app.bank.schemaVersion,
        currentId: app.currentId,
        slideIndex: app.slideIndex,
        questions: app.states,
      }));
    } catch {
      if (!app.storageWarned) {
        app.storageWarned = true;
        announce('进度无法保存：浏览器存储不可用或空间已满。关闭无痕模式或清理站点数据后重试。');
      }
    }
  };
  clearTimeout(saveTimer);
  if (immediate) write();
  else saveTimer = setTimeout(write, 220);
}
function announce(message) {
  $('announcer').textContent = '';
  requestAnimationFrame(() => { $('announcer').textContent = message; });
}
function exportProgress() {
  const stamp = new Date().toISOString().slice(0, 10);
  const data = {
    schemaVersion: app.bank.schemaVersion,
    exportedAt: new Date().toISOString(),
    currentId: app.currentId,
    questions: app.states,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `infra-interview-progress-${stamp}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce('进度已导出为 JSON 文件。');
}
async function importProgress(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data?.schemaVersion !== app.bank.schemaVersion || !data.questions || typeof data.questions !== 'object') throw new Error('bad file');
    let applied = 0, stale = 0;
    for (const q of app.bank.questions) {
      const raw = data.questions[q.id];
      if (!raw || typeof raw !== 'object') continue;
      if (raw.revision !== q.revision) { stale += 1; continue; }
      app.states[q.id] = restore(q, raw);
      applied += 1;
    }
    save(true);
    render();
    announce(`已导入 ${applied} 道题的进度${stale ? `，${stale} 道因题目版本变化被跳过` : ''}。`);
  } catch {
    announce('导入失败：请选择本站导出的进度 JSON 文件。');
  }
}
function focusStage() {
  requestAnimationFrame(() => $('stage').focus({ preventScroll: true }));
}
function announcePage() {
  const heading = $('stage').querySelector('h1');
  announce(`${$('location-title').textContent}${heading ? `。${heading.textContent}` : ''}`);
}
function trapOverviewFocus(event) {
  if (event.key !== 'Tab') return;
  const panel = $('overview').querySelector('.overview-panel');
  const nodes = [...panel.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]')]
    .filter(node => node.offsetParent !== null);
  if (!nodes.length) return;
  const first = nodes[0], last = nodes[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function fitStage() {
  const frame = $('stage'), fitter = $('fitter'), viewport = $('viewport');
  const short = window.innerHeight < 560;
  const narrow = window.matchMedia('(max-width: 900px)').matches || short;
  if (narrow) {
    frame.classList.add('stage-mobile');
    frame.classList.toggle('stage-compact', short);
    fitter.style.width = '100%';
    fitter.style.height = '100%';
    frame.style.transform = 'none';
    return;
  }
  frame.classList.remove('stage-mobile', 'stage-compact');
  const box = viewport.getBoundingClientRect();
  const scale = Math.max(.2, Math.min((box.width - 2) / 1600, (box.height - 2) / 900));
  fitter.style.width = `${Math.floor(1600 * scale)}px`;
  fitter.style.height = `${Math.floor(900 * scale)}px`;
  frame.style.transform = `scale(${scale})`;
}

function renderTopics() {
  const all = ['', ...topics];
  $('topic-tabs').replaceChildren(...all.map(topic => {
    const count = app.bank.questions.filter(q => !topic || q.topic === topic).length;
    const node = makeButton('', () => setTopic(topic));
    node.setAttribute('aria-pressed', String(topic === app.topic));
    node.append(el('span', 'topic-label', topic || '全部'), el('span', 'count', String(count)));
    return node;
  }));
}
function renderStats() {
  const s = statistics(app.bank.questions, app.states);
  $('stat-done').textContent = `${s.done} / ${s.total}`;
  $('stat-accuracy').textContent = s.accuracy === null ? '—' : `${s.accuracy}%`;
  $('stat-self').textContent = `${s.selfRated} / ${s.shortTotal}`;
  $('stat-accuracy').title = `${s.correct} / ${s.attempted} 道已提交单选答对`;
  $('stat-self').title = '简答自评数量，不计入单选正确率';
}

function render() {
  const q = currentQuestion();
  if (!q) return;
  const slides = slidesFor(q);
  app.slideIndex = Math.max(0, Math.min(app.slideIndex, slides.length - 1));
  renderTopics();
  renderStats();
  renderStage(q, slides);
  renderFooter(q, slides);
}

function slideHead(kicker, q, extra) {
  const head = el('header', 'slide-head');
  const left = el('div');
  left.append(el('div', 'kicker', kicker));
  const rail = el('div', 'question-rail');
  rail.append(el('span', 'chip', q.difficulty), el('span', 'chip', q.type === 'single' ? '单选' : '简答 · 自评'));
  left.append(rail);
  const right = el('div', 'head-meta');
  const badge = el('span', `result-badge ${q.type === 'single' ? (app.states[q.id].submitted ? (isCorrect(q, app.states[q.id]) ? 'good' : 'bad') : 'neutral') : (app.states[q.id].selfAssessment ? 'good' : 'neutral')}`, resultText(q));
  right.append(badge);
  if (extra) right.append(extra);
  head.append(left, right);
  return head;
}

function renderStage(q, slides) {
  const kind = slides[app.slideIndex];
  const stage = $('stage');
  stage.setAttribute('aria-label', `${q.title}，${SLIDE_NAMES[kind]}，第 ${app.slideIndex + 1} / ${slides.length} 页`);
  const renderer = {
    question: renderQuestionSlide,
    summary: renderSummarySlide,
    terms: renderTermsSlide,
    explain: renderExplainSlide,
    deep: renderDeepSlide,
    options: renderOptionsSlide,
    review: renderReviewSlide,
    assess: renderAssessSlide,
  }[kind];
  const slide = renderer(q);
  if (['terms', 'deep', 'options', 'review'].includes(kind)) {
    const length = slide.textContent.replace(/\s+/g, '').length;
    slide.classList.toggle('density-tight', length > 760);
    slide.classList.toggle('density-airy', length < 420);
  }
  stage.replaceChildren(slide);
}

function renderQuestionSlide(q) {
  const s = app.states[q.id];
  const slide = el('article', 'slide slide-question');
  slide.append(slideHead(`第 ${bankIndex(q) + 1} 题 · ${q.topic}`, q));

  slide.append(el('h1', '', q.title));
  const body = el('div', 'slide-body');
  body.append(el('p', 'slide-sub', q.prompt));

  if (q.type === 'single') {
    const fieldset = el('fieldset', 'options');
    fieldset.append(el('legend', '', '选择一个最合适的答案'));
    q.options.forEach(option => {
      const label = el('label', 'option');
      const input = el('input');
      input.type = 'radio';
      input.name = `answer-${q.id}`;
      input.value = option.id;
      input.checked = s.selected === option.id;
      input.disabled = s.submitted;
      input.setAttribute('aria-label', `${option.id} ${option.text}`);
      input.addEventListener('change', () => {
        s.selected = option.id;
        const feedback = $('answer-feedback');
        if (feedback) { feedback.className = 'feedback'; feedback.textContent = '已选择，提交后进入解析。'; }
        save();
      });
      label.append(input, el('span', 'option-key', option.id), el('span', '', option.text));
      if (s.submitted) {
        label.dataset.locked = 'true';
        if (option.id === q.answer.optionId) label.classList.add('correct');
        else if (option.id === s.selected) label.classList.add('wrong');
      }
      fieldset.append(label);
    });
    body.append(fieldset);
    const feedback = el('p', 'feedback');
    feedback.id = 'answer-feedback';
    if (s.submitted) {
      feedback.className = `feedback ${isCorrect(q, s) ? 'good' : 'bad'}`;
      feedback.textContent = isCorrect(q, s) ? '答对了。翻页检查自己的理由是否完整。' : '这次没有选对。翻页看解析，之后可以重做。';
    } else {
      feedback.textContent = '先独立判断，提交后再看答案。';
    }
    const actions = el('div', 'slide-actions');
    if (s.submitted) {
      actions.append(
        makeButton('查看解析 →', () => goToSlide(1), 'btn primary'),
        makeButton('重做本题', () => resetQuestion(q), 'btn ghost'),
      );
    } else {
      actions.append(makeButton('提交答案', () => {
        if (!s.selected) {
          feedback.className = 'feedback bad';
          feedback.textContent = '请先选择一个答案。';
          announce('请先选择一个答案。');
          return;
        }
        s.submitted = true;
        s.revealed = true;
        app.slideIndex = 1;
        save(true);
        announce(isCorrect(q, s) ? '答对了。已进入参考答案。' : '答错了。已进入参考答案。');
        render();
        focusStage();
      }, 'btn primary'));
    }
    actions.append(feedback);
    body.append(actions);
  } else {
    const field = el('label', 'short-field', '你的回答（只保存在当前浏览器）');
    const input = el('textarea', 'short-input');
    input.id = 'short-answer';
    input.value = s.text;
    input.readOnly = s.revealed;
    input.placeholder = '先用自己的话回答，再展开参考答案。';
    input.addEventListener('input', () => { s.text = input.value; save(); });
    field.append(input);
    body.append(field, el('p', 'short-note', '简答由你对照要点自评，不作自动语义评分。'));
    const feedback = el('p', 'feedback');
    feedback.id = 'answer-feedback';
    feedback.textContent = s.revealed ? '参考答案已展开，请在最后一页完成自评。' : '写完后展开参考答案，再对照要点自评。';
    const actions = el('div', 'slide-actions');
    if (s.revealed) {
      actions.append(
        makeButton('查看解析 →', () => goToSlide(1), 'btn primary'),
        makeButton('重做本题', () => resetQuestion(q), 'btn ghost'),
      );
    } else {
      actions.append(makeButton('查看参考答案', () => {
        s.revealed = true;
        app.slideIndex = 1;
        save(true);
        announce('参考答案已展开，请对照要点自评。');
        render();
        focusStage();
      }, 'btn primary'));
    }
    actions.append(feedback);
    body.append(actions);
  }
  slide.append(body);
  return slide;
}

function renderSummarySlide(q) {
  const s = app.states[q.id];
  const slide = el('article', 'slide');
  slide.append(slideHead(slideKicker(q, 'summary'), q));
  slide.append(el('h1', '', '参考答案'));
  const grid = el('div', 'answer-grid');

  const left = el('section', 'panel');
  if (q.type === 'single') {
    const correct = q.options.find(o => o.id === q.answer.optionId);
    left.append(el('h2', '', '正确选项'));
    left.append(el('p', 'answer-text', `${correct.id} · ${correct.text}`));
    const selected = q.options.find(o => o.id === s.selected);
    const choice = el('p', `choice-line ${isCorrect(q, s) ? '' : 'miss'}`);
    choice.append(document.createTextNode('你的选择：'), el('b', '', selected ? `${selected.id} · ${selected.text}` : '未选择'));
    left.append(choice);
    left.append(el('h2', '', '参考回答'));
    left.append(el('p', 'answer-text', q.answer.reference));
  } else {
    left.append(el('h2', '', '参考回答'));
    left.append(el('p', 'answer-text', q.answer.reference));
    left.append(el('p', 'note-line', '对照下面的要点，看自己的回答覆盖了哪些、漏了哪些。'));
  }

  const right = el('section', 'panel');
  right.append(el('h2', '', '回答要点'));
  const list = el('ul', 'key-list');
  q.answer.keyPoints.forEach(point => list.append(el('li', '', point)));
  right.append(list);
  grid.append(left, right);
  slide.append(grid);
  return slide;
}

function renderExplainSlide(q) {
  const slide = el('article', 'slide');
  slide.append(slideHead(slideKicker(q, 'explain'), q));
  slide.append(el('h1', '', '为什么这样理解'));
  const grid = el('div', 'answer-grid');
  const left = el('section', 'panel');
  left.append(el('p', 'explain-lead', q.answer.explanation));
  const right = el('section', 'panel');
  const analogy = el('blockquote', 'analogy');
  analogy.append(el('span', 'analogy-label', '换个日常例子'), el('p', '', q.answer.analogy));
  right.append(analogy);
  grid.append(left, right);
  slide.append(grid);
  return slide;
}

function renderTermsSlide(q) {
  const terms = q.answer.terms || [];
  const slide = el('article', 'slide');
  slide.append(slideHead(slideKicker(q, 'terms'), q));
  slide.append(el('h1', '', '先把名词拆开'));
  const grid = el('div', `term-grid${terms.length > 4 ? ' dense' : ''}`);
  terms.forEach((item, index) => {
    const card = el('section', 'term-card');
    card.append(el('span', 'term-index', String(index + 1).padStart(2, '0')));
    card.append(el('h2', '', item.term), el('p', '', item.plain));
    const source = item.sourceId ? app.bank.sources.find(entry => entry.id === item.sourceId) : null;
    if (source) {
      const link = el('a', 'term-link', `想补基础：${source.title} →`);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      card.append(link);
    }
    grid.append(card);
  });
  if (!terms.length) grid.append(el('p', 'note-line', '本题的名词解释正在补充。'));
  slide.append(grid);
  slide.append(el('p', 'slide-footnote', '第一次看不懂没关系：先记住这个名词在流程里的位置，再回到解析看它怎么被使用。'));
  return slide;
}

function renderDeepSlide(q) {
  const slide = el('article', 'slide');
  slide.append(slideHead(slideKicker(q, 'deep'), q));
  slide.append(el('h1', '', '再往下挖一层'));
  const grid = el('div', 'deep-grid');
  const main = el('section', 'panel deep-copy');
  String(q.answer.deepDive || q.answer.explanation).split(/\n{2,}/).forEach(paragraph => {
    main.append(el('p', '', paragraph));
  });
  const aside = el('aside', 'deep-aside');
  aside.append(el('h2', '', '面试时压缩成 30 秒'));
  aside.append(el('p', 'answer-text', q.answer.reference));
  aside.append(el('p', 'note-line', '先讲它是什么，再讲为什么需要，最后补一句代价或适用边界。'));
  grid.append(main, aside);
  slide.append(grid);
  return slide;
}

function renderOptionsSlide(q) {
  const slide = el('article', 'slide');
  slide.append(slideHead(slideKicker(q, 'options'), q));
  slide.append(el('h1', '', '四个选项逐一拆开'));
  const legend = el('p', 'option-legend');
  legend.append(el('span', 'yes', '✓ 正确答案'), el('span', 'no', '✗ 错误选项'), el('span', '', '不要只记字母，要能说出每个选项成立或不成立的条件。'));
  slide.append(legend);
  const grid = el('div', 'option-review');
  const notes = q.answer.optionNotes || {};
  q.options.forEach(option => {
    const correct = option.id === q.answer.optionId;
    const row = el('section', `option-review-row ${correct ? 'correct' : 'wrong'}`);
    const head = el('div', 'option-review-head');
    const mark = el('span', 'option-mark', correct ? '✓' : '✗');
    mark.setAttribute('aria-label', correct ? '正确选项' : '错误选项');
    head.append(mark, el('strong', '', `${option.id} · ${option.text}`));
    row.append(head, el('p', '', notes[option.id] || (correct ? '这个选项与参考回答一致。' : '这个选项与题干的机制或边界不符。')));
    grid.append(row);
  });
  slide.append(grid);
  return slide;
}

function renderReviewSlide(q) {
  const slide = el('article', 'slide');
  slide.append(slideHead(slideKicker(q, 'review'), q));
  slide.append(el('h1', '', '易错点与追问'));
  const grid = el('div', 'answer-grid three');

  const pitfalls = el('section', 'panel');
  pitfalls.append(el('h2', '', '容易答错'));
  const pitList = el('ul', 'key-list');
  q.answer.pitfalls.forEach(item => pitList.append(el('li', '', item)));
  pitfalls.append(pitList);

  const follows = el('section', 'panel');
  follows.append(el('h2', '', '可能继续追问'));
  const followList = el('ul', 'key-list');
  q.answer.followUps.forEach(item => followList.append(el('li', '', item)));
  follows.append(followList);

  const sources = el('section', 'panel');
  sources.append(el('h2', '', '资料来源'));
  const sourceList = el('ul', 'source-list');
  q.sourceIds.forEach(id => {
    const source = app.bank.sources.find(s => s.id === id);
    if (!source) return;
    const li = el('li');
    const link = el('a', '', source.title);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    li.append(link);
    sourceList.append(li);
  });
  sources.append(sourceList, el('p', 'origin', `${q.origin.kind === 'original' ? '原创项目题' : '公开题型改写'} · ${q.origin.note}`));

  grid.append(pitfalls, follows, sources);
  slide.append(grid);

  const actions = el('div', 'slide-actions');
  actions.append(makeButton('重做本题', () => resetQuestion(q), 'btn ghost'));
  if (q.type === 'short') {
    actions.append(makeButton('去自评 →', () => goToSlide(6), 'btn primary'));
  } else {
    const nextButton = makeButton(globalNextLabel(), () => goNext(), 'btn primary');
    nextButton.disabled = !hasNext();
    actions.append(nextButton);
  }
  slide.append(actions);
  return slide;
}

function renderAssessSlide(q) {
  const s = app.states[q.id];
  const slide = el('article', 'slide');
  slide.append(slideHead(`自评 ${slideNumber(q, 'assess')} / ${slidesFor(q).length - 1} · ${q.topic}`, q));
  slide.append(el('h1', '', '对照后自评'));

  const grid = el('div', 'answer-grid');
  const left = el('section', 'panel');
  left.append(el('h2', '', '参考回答'), el('p', 'answer-text', q.answer.reference));
  left.append(el('h2', '', '回答要点'));
  const list = el('ul', 'key-list');
  q.answer.keyPoints.forEach(point => list.append(el('li', '', point)));
  left.append(list);

  const right = el('section', 'panel');
  right.append(el('h2', '', '你能否在面试中讲清楚？'), el('p', 'note-line', '这不是自动判分。对照左侧内容，选择最接近自己掌握程度的一项。'));
  const controls = el('div', 'self-controls');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', '简答掌握程度');
  assessments.forEach(value => {
    const node = makeButton(value, () => {
      s.selfAssessment = value;
      save(true);
      announce(`已记录自评：${value}`);
      render();
    });
    node.setAttribute('aria-pressed', String(s.selfAssessment === value));
    controls.append(node);
  });
  right.append(controls);
  right.append(el('p', 'note-line', s.selfAssessment ? `当前记录：${s.selfAssessment}。可以随时修改或重做本题。` : '自评只影响“简答自评”统计，不计入单选正确率。'));
  grid.append(left, right);
  slide.append(grid);

  const actions = el('div', 'slide-actions');
  actions.append(makeButton('重做本题', () => resetQuestion(q), 'btn ghost'));
  const nextButton = makeButton(globalNextLabel(), () => goNext(), 'btn primary');
  nextButton.disabled = !hasNext();
  actions.append(nextButton);
  slide.append(actions);
  return slide;
}

function globalNextLabel() {
  const visible = visibleQuestions();
  const index = visible.findIndex(q => q.id === app.currentId);
  return index >= 0 && index < visible.length - 1 ? '下一题 →' : '已是最后一题';
}
function bankIndex(q) {
  return app.bank.questions.findIndex(item => item.id === q.id);
}

function renderFooter(q, slides) {
  const visible = visibleQuestions();
  const qIndex = Math.max(0, visible.findIndex(item => item.id === q.id));
  const slideName = SLIDE_NAMES[slides[app.slideIndex]];
  $('location').textContent = `${app.topic || '全部'} · 第 ${qIndex + 1} / ${visible.length} 题`;
  $('location-title').textContent = `${q.title} · 第 ${app.slideIndex + 1} / ${slides.length} 页 · ${slideName}`;
  $('footer-summary').textContent = `本页 ${app.slideIndex + 1} / ${slides.length} · ${slideName} · ${resultText(q)}`;
  $('bookmark').textContent = app.states[q.id].bookmarked ? '已收藏' : '收藏';
  $('bookmark').setAttribute('aria-pressed', String(app.states[q.id].bookmarked));
  $('prev').disabled = !hasPrev();
  $('next').disabled = !hasNext();
  const track = $('progress-track');
  track.setAttribute('aria-valuemax', String(visible.length));
  track.setAttribute('aria-valuenow', String(qIndex + 1));
  track.setAttribute('aria-valuetext', `第 ${qIndex + 1} 题，共 ${visible.length} 题`);
  $('progress-fill').style.width = `${((qIndex + 1) / Math.max(1, visible.length)) * 100}%`;
}

function hasPrev() {
  const visible = visibleQuestions();
  const index = visible.findIndex(q => q.id === app.currentId);
  return app.slideIndex > 0 || index > 0;
}
function hasNext() {
  const visible = visibleQuestions();
  const index = visible.findIndex(q => q.id === app.currentId);
  const q = currentQuestion();
  return app.slideIndex < slidesFor(q).length - 1 || index < visible.length - 1;
}
function goNext() {
  const visible = visibleQuestions();
  const q = currentQuestion();
  const index = visible.findIndex(item => item.id === q.id);
  if (app.slideIndex < slidesFor(q).length - 1) app.slideIndex += 1;
  else if (index < visible.length - 1) { app.currentId = visible[index + 1].id; app.slideIndex = 0; }
  else return;
  save(true);
  render();
  focusStage();
  announcePage();
}
function goPrev() {
  const visible = visibleQuestions();
  const q = currentQuestion();
  const index = visible.findIndex(item => item.id === q.id);
  if (app.slideIndex > 0) app.slideIndex -= 1;
  else if (index > 0) {
    app.currentId = visible[index - 1].id;
    app.slideIndex = Math.max(0, slidesFor(currentQuestion()).length - 1);
  } else return;
  save(true);
  render();
  focusStage();
  announcePage();
}
function goToSlide(n) {
  const q = currentQuestion();
  app.slideIndex = Math.max(0, Math.min(n, slidesFor(q).length - 1));
  save(true);
  render();
  focusStage();
  announcePage();
}
function resetQuestion(q) {
  const s = app.states[q.id];
  s.selected = null;
  s.submitted = false;
  s.revealed = false;
  s.selfAssessment = null;
  s.text = '';
  app.slideIndex = 0;
  save(true);
  render();
  focusStage();
  announcePage();
}
function setTopic(topic) {
  app.topic = topic;
  const visible = visibleQuestions();
  const changed = !visible.some(q => q.id === app.currentId);
  if (changed) {
    app.currentId = visible[0]?.id || null;
    app.slideIndex = 0;
  }
  save(true);
  render();
  focusStage();
  announcePage();
}

function toggleBookmark() {
  const q = currentQuestion();
  if (!q) return;
  const s = app.states[q.id];
  s.bookmarked = !s.bookmarked;
  save(true);
  render();
  announce(s.bookmarked ? '已收藏本题。' : '已取消收藏。');
}

function renderOverviewTopics() {
  const select = $('overview-topic');
  const current = select.value;
  select.replaceChildren(el('option', '', '全部专题'));
  select.firstChild.value = '';
  topics.forEach(topic => {
    const option = el('option', '', topic);
    option.value = topic;
    select.append(option);
  });
  select.value = current;
}

function overviewList() {
  let list = filterQuestions(app.bank.questions, app.states, {
    ...overviewFilters,
    mode: 'all',
  });
  if (overviewFilters.wrong) list = list.filter(q => isWrong(q, app.states[q.id]));
  if (overviewFilters.bookmarked) list = list.filter(q => app.states[q.id].bookmarked);
  return list;
}

function renderOverview() {
  const list = overviewList();
  $('overview-count').textContent = `${list.length} / ${app.bank.questions.length} 道`;
  const grid = $('overview-grid');
  if (!list.length) {
    grid.replaceChildren(el('div', 'overview-empty', '当前筛选没有题目。调整关键词或筛选条件后再试。'));
    return;
  }
  grid.replaceChildren(...list.map(q => {
    const node = el('button');
    node.type = 'button';
    node.setAttribute('aria-current', String(q.id === app.currentId));
    node.title = `${q.topic} · ${q.title}`;
    const index = bankIndex(q) + 1;
    const title = el('span', 'title');
    title.append(el('strong', '', q.title), el('span', 'state', `${q.topic} · ${resultText(q)}`));
    node.append(el('span', 'index', String(index).padStart(3, '0')), title);
    node.addEventListener('click', () => goToQuestion(q.id));
    return node;
  }));
}

function openOverview() {
  app.overviewOpen = true;
  app.overviewOpener = document.activeElement;
  $('overview').hidden = false;
  $('overview-toggle').setAttribute('aria-expanded', 'true');
  $('overview-button').setAttribute('aria-expanded', 'true');
  renderOverview();
  requestAnimationFrame(() => $('overview-search').focus());
}
function closeOverview() {
  app.overviewOpen = false;
  $('overview').hidden = true;
  $('overview-toggle').setAttribute('aria-expanded', 'false');
  $('overview-button').setAttribute('aria-expanded', 'false');
  const opener = app.overviewOpener;
  app.overviewOpener = null;
  const target = opener && opener.isConnected ? opener : $('overview-toggle');
  target.focus({ preventScroll: true });
}
function toggleOverview() {
  if (app.overviewOpen) closeOverview(); else openOverview();
}
function selectOption(optionId) {
  const q = currentQuestion();
  if (!q || q.type !== 'single') return false;
  const s = app.states[q.id];
  if (s.submitted || slidesFor(q)[app.slideIndex] !== 'question') return false;
  const input = document.querySelector(`#stage .option input[value="${optionId}"]`);
  if (!input || input.disabled) return false;
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  announce(`已选择 ${optionId}`);
  return true;
}
function submitCurrent() {
  const q = currentQuestion();
  if (!q || q.type !== 'single') return false;
  if (slidesFor(q)[app.slideIndex] !== 'question' || app.states[q.id].submitted) return false;
  const button = document.querySelector('#stage .slide-actions .btn.primary');
  if (!button || !button.textContent.includes('提交答案')) return false;
  button.click();
  return true;
}
function goToQuestion(id) {
  if (!app.bank.questions.some(q => q.id === id)) return;
  if (app.overviewOpen) closeOverview();
  app.currentId = id;
  app.slideIndex = 0;
  if (app.topic && !app.bank.questions.some(q => q.id === id && q.topic === app.topic)) app.topic = '';
  save(true);
  render();
  focusStage();
  announcePage();
}

function wire() {
  if (wired) return;
  wired = true;
  $('prev').addEventListener('click', goPrev);
  $('next').addEventListener('click', goNext);
  $('bookmark').addEventListener('click', toggleBookmark);
  $('overview-toggle').addEventListener('click', toggleOverview);
  $('overview-button').addEventListener('click', toggleOverview);
  $('overview-close').addEventListener('click', closeOverview);
  $('overview').addEventListener('click', event => { if (event.target === $('overview')) closeOverview(); });
  $('overview').addEventListener('keydown', trapOverviewFocus);
  $('overview-search').addEventListener('input', event => {
    overviewFilters.search = event.target.value;
    clearTimeout(window.__overviewSearchTimer);
    window.__overviewSearchTimer = setTimeout(renderOverview, 120);
  });
  $('overview-topic').addEventListener('change', event => { overviewFilters.topic = event.target.value; renderOverview(); });
  $('overview-difficulty').addEventListener('change', event => { overviewFilters.difficulty = event.target.value; renderOverview(); });
  $('overview-type').addEventListener('change', event => { overviewFilters.type = event.target.value; renderOverview(); });
  $('overview-wrong').addEventListener('change', event => { overviewFilters.wrong = event.target.checked; renderOverview(); });
  $('overview-bookmarked').addEventListener('change', event => { overviewFilters.bookmarked = event.target.checked; renderOverview(); });
  $('export-progress').addEventListener('click', exportProgress);
  $('import-progress').addEventListener('change', event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) importProgress(file);
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && app.overviewOpen) { event.preventDefault(); closeOverview(); return; }
    if (app.overviewOpen) return;
    const target = event.target;
    if (target?.closest('input,textarea,select')) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;
    if (key === 'ArrowRight' || key === 'PageDown' || key === 'j' || key === 'J') { event.preventDefault(); goNext(); }
    else if (key === 'ArrowLeft' || key === 'PageUp' || key === 'k' || key === 'K') { event.preventDefault(); goPrev(); }
    else if (/^[a-dA-D]$/.test(key) || /^[1-4]$/.test(key)) {
      const optionId = /^[1-4]$/.test(key) ? 'ABCD'[Number(key) - 1] : key.toUpperCase();
      if (selectOption(optionId)) event.preventDefault();
    }
    else if (key === 'Enter' && !target?.closest('button,a')) {
      if (submitCurrent()) event.preventDefault();
    }
  });
  window.addEventListener('resize', fitStage);
  if ('ResizeObserver' in window) new ResizeObserver(fitStage).observe($('viewport'));
}

async function load() {
  const loading = $('loading');
  loading.hidden = false;
  loading.replaceChildren(document.createTextNode('正在读取独立题库…'));
  try {
    const response = await fetch('./data/questions.json', { cache: 'no-cache' });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    app.bank = validateBank(await response.json());
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* fresh state */ }
    if (saved?.schemaVersion !== app.bank.schemaVersion) saved = {};
    app.states = Object.fromEntries(app.bank.questions.map(q => [q.id, restore(q, saved.questions?.[q.id])]));
    app.currentId = app.bank.questions.some(q => q.id === saved.currentId) ? saved.currentId : app.bank.questions[0].id;
    app.slideIndex = Number.isInteger(saved.slideIndex) ? saved.slideIndex : 0;
    app.slideIndex = Math.max(0, Math.min(app.slideIndex, slidesFor(currentQuestion()).length - 1));
    $('overview').hidden = true;
    $('loading').hidden = true;
    $('app').hidden = false;
    renderOverviewTopics();
    wire();
    render();
    fitStage();
  } catch (error) {
    $('app').hidden = true;
    loading.replaceChildren(
      el('h2', '', '暂时无法读取题库'),
      el('p', '', `请检查题库文件或通过本地 HTTP 服务打开。${error.message}`),
      el('p', '', '在此文件夹运行：'),
      el('code', '', 'python3 -m http.server 4180 --bind 127.0.0.1'),
      makeButton('重新读取题库', load, 'btn primary'),
    );
  }
}

window.addEventListener('beforeunload', () => save(true));
window.addEventListener('pagehide', () => save(true));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(true); });
load();
