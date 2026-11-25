const h = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const list = value => Array.isArray(value) ? value : [];

function labelOf(item) {
  if (typeof item === 'string') return item;
  return item?.label ?? item?.term ?? item?.title ?? '';
}

function noteOf(item) {
  return typeof item === 'object' && item ? (item.note ?? item.detail ?? '') : '';
}

/* ---------------------------------------------------------------- presets */

function renderFlow(host, data) {
  const wrap = h('div', 'p-flow');
  const line = h('div', 'p-flow-line');
  const nodes = h('div', 'p-flow-nodes');
  const items = list(data.nodes);
  items.forEach((item, index) => {
    const node = h('div', 'p-node');
    node.dataset.focus = `node-${index}`;
    node.dataset.caption = noteOf(item) || labelOf(item);
    node.style.setProperty('--enter', index);
    node.append(h('span', 'p-node-index', String(index + 1).padStart(2, '0')), h('strong', '', labelOf(item)));
    if (noteOf(item)) node.append(h('small', '', noteOf(item)));
    nodes.append(node);
    if (index < items.length - 1) nodes.append(h('span', 'p-arrow', '→'));
  });
  wrap.append(line, nodes);
  host.append(wrap);
}

function renderCompare(host, data) {
  const wrap = h('div', 'p-compare');
  const side = (item, cls) => {
    const box = h('div', `p-side ${cls}`);
    box.dataset.focus = cls;
    box.style.setProperty('--enter', cls === 'left' ? 0 : 1);
    box.dataset.caption = item?.caption || item?.title || '';
    box.append(h('span', 'p-side-kicker', item?.kicker || ''), h('h3', '', item?.title || ''));
    const items = list(item?.items);
    if (items.length) {
      const ul = h('ul');
      items.forEach(text => ul.append(h('li', '', text)));
      box.append(ul);
    }
    return box;
  };
  wrap.append(side(data.left, 'left'), h('div', 'p-vs', data.vs || 'VS'), side(data.right, 'right'));
  host.append(wrap);
}

function renderKVGrid(host, data) {
  const wrap = h('div', 'p-kv');
  const row = (title, values, kind) => {
    const line = h('div', `p-kv-row ${kind}`);
    line.append(h('span', 'p-kv-label', title));
    const cells = h('div', 'p-kv-cells');
    list(values).forEach((value, index) => {
      const cell = h('div', 'p-kv-cell', String(value));
      cell.dataset.focus = `${kind}-${index}`;
      cell.style.setProperty('--enter', index);
      if (list(data.hit).includes(index)) cell.classList.add('is-hit');
      if (kind === 'physical') cell.dataset.caption = `物理块 ${value}`;
      cells.append(cell);
    });
    line.append(cells);
    return line;
  };
  wrap.append(row('逻辑位置', data.logical, 'logical'), h('div', 'p-kv-table', 'block table'), row('物理块', data.physical, 'physical'));
  if (data.note) wrap.append(h('p', 'p-scene-note', data.note));
  host.append(wrap);
}

function renderQueue(host, data) {
  const wrap = h('div', 'p-queue');
  const rounds = list(data.rounds);
  rounds.forEach((round, r) => {
    const row = h('div', 'p-queue-row');
    row.dataset.focus = `round-${r}`;
    row.style.setProperty('--enter', r);
    row.dataset.caption = round.caption || `第 ${r + 1} 轮：${round.running} 个运行，${round.waiting} 个等待`;
    row.append(h('span', 'p-queue-label', `R${r + 1}`));
    const slots = h('div', 'p-queue-slots');
    for (let i = 0; i < (data.capacity || 3); i += 1) {
      const slot = h('i', i < (round.running || 0) ? 'is-running' : '');
      slot.append(h('b', '', i < (round.running || 0) ? 'RUN' : '—'));
      slots.append(slot);
    }
    row.append(slots, h('span', 'p-queue-wait', `等待 ${round.waiting ?? 0}`));
    wrap.append(row);
  });
  host.append(wrap);
}

function renderOrbit(host, data) {
  const wrap = h('div', 'p-orbit');
  wrap.dataset.count = String(list(data.items).length);
  const center = h('div', 'p-orbit-center');
  center.append(h('span', '', data.kicker || '本页'), h('strong', '', data.center || '核心'));
  wrap.append(center);
  const items = list(data.items);
  items.forEach((item, index) => {
    const node = h('div', `p-orbit-node orbit-${index}`);
    node.dataset.focus = `orbit-${index}`;
    node.style.setProperty('--enter', index);
    node.dataset.caption = noteOf(item) || labelOf(item);
    const angle = (-90 + index * (360 / Math.max(items.length, 1))) * Math.PI / 180;
    const radiusX = items.length === 4 ? 39 : 32;
    const radiusY = items.length <= 4 ? 34 : 32;
    node.style.left = `${50 + Math.cos(angle) * radiusX}%`;
    node.style.top = `${50 + Math.sin(angle) * radiusY}%`;
    node.style.right = 'auto';
    node.style.bottom = 'auto';
    node.append(h('b', '', String(index + 1).padStart(2, '0')), h('span', '', labelOf(item)));
    wrap.append(node);
  });
  host.append(wrap);
}

function renderLayers(host, data) {
  const wrap = h('div', 'p-layers');
  list(data.layers).forEach((item, index) => {
    const layer = h('div', 'p-layer');
    layer.dataset.focus = `layer-${index}`;
    layer.style.setProperty('--enter', index);
    layer.dataset.caption = noteOf(item) || labelOf(item);
    layer.append(h('span', 'p-layer-index', String(index + 1).padStart(2, '0')), h('strong', '', labelOf(item)), h('small', '', noteOf(item)));
    wrap.append(layer);
  });
  host.append(wrap);
}

function renderMatrix(host, data) {
  const wrap = h('div', 'p-matrix');
  const head = h('div', 'p-matrix-row p-matrix-head');
  head.append(h('span', ''));
  list(data.columns).forEach(column => head.append(h('strong', '', column)));
  wrap.append(head);
  list(data.rows).forEach((row, index) => {
    const line = h('div', 'p-matrix-row');
    line.dataset.focus = row.accent ? 'accent' : `row-${index}`;
    line.style.setProperty('--enter', index);
    line.dataset.caption = `${row.label}：${list(row.cells).join('；')}`;
    line.append(h('strong', '', row.label));
    list(row.cells).forEach(cell => line.append(h('span', '', cell)));
    if (row.accent) line.classList.add('is-accent');
    wrap.append(line);
  });
  host.append(wrap);
}

function renderNumberline(host, data) {
  const wrap = h('div', 'p-numberline');
  const min = Number(data.min ?? 0), max = Number(data.max ?? 1);
  const span = max - min || 1;
  const line = h('div', 'p-nl-line');
  const bands = h('div', 'p-nl-bands');
  list(data.bands).forEach(band => {
    const from = ((Number(band.from) - min) / span) * 100;
    const to = ((Number(band.to) - min) / span) * 100;
    const node = h('span', `p-nl-band ${band.tone || ''}`, band.label || '');
    node.style.left = `${clamp(Math.min(from, to), 0, 100)}%`;
    node.style.width = `${clamp(Math.abs(to - from), 0, 100)}%`;
    bands.append(node);
  });
  line.append(bands);
  const marks = list(data.marks);
  marks.forEach((mark, index) => {
    const at = ((Number(mark.value) - min) / span) * 100;
    const node = h('div', `p-nl-mark ${mark.tone || ''}`);
    node.style.left = `${clamp(at, 6, 94)}%`;
    node.dataset.focus = `mark-${index}`;
    node.style.setProperty('--enter', index);
    node.dataset.caption = mark.caption || `${mark.label} = ${mark.value}`;
    node.append(h('b', '', mark.label), h('span', '', mark.value));
    line.append(node);
  });
  if (data.zero !== undefined) {
    const zero = h('div', 'p-nl-zero');
    zero.style.left = `${clamp(((Number(data.zero) - min) / span) * 100, 4, 96)}%`;
    zero.append(h('span', '', `0 点 @ ${data.zero}`));
    line.append(zero);
  }
  wrap.append(h('div', 'p-nl-axis', `${min}`), line, h('div', 'p-nl-axis end', `${max}`));
  if (data.note) wrap.append(h('p', 'p-scene-note', data.note));
  host.append(wrap);
}

function renderLanes(host, data) {
  const wrap = h('div', 'p-lanes');
  const count = Number(data.lanes || 32);
  const groups = list(data.groups);
  const lanes = h('div', 'p-lane-grid');
  for (let i = 0; i < count; i += 1) {
    const lane = h('i', 'p-lane');
    const group = groups.find(g => i >= g.from && i <= g.to);
    if (group) {
      lane.classList.add(group.tone || 'accent');
      lane.dataset.focus = `lane-${groups.indexOf(group)}`;
      lane.style.setProperty('--enter', groups.indexOf(group));
      lane.dataset.caption = group.label || '';
    }
    lane.append(h('span', '', String(i).padStart(2, '0')));
    lanes.append(lane);
  }
  wrap.append(lanes);
  const legend = h('div', 'p-lane-legend');
  groups.forEach(group => legend.append(h('span', `legend-dot ${group.tone || 'accent'}`, group.label || '')));
  wrap.append(legend);
  if (data.note) wrap.append(h('p', 'p-scene-note', data.note));
  host.append(wrap);
}

function renderMemory(host, data) {
  const wrap = h('div', 'p-memory');
  const rows = Number(data.rows || 4), cols = Number(data.cols || 8);
  const grid = h('div', 'p-memory-grid');
  grid.style.setProperty('--cols', cols);
  for (let i = 0; i < rows * cols; i += 1) {
    const cell = h('i', 'p-mem-cell');
    cell.style.setProperty('--enter', i);
    const thread = Math.floor(i / cols) * cols + (i % cols);
    cell.append(h('span', '', data.addresses ? data.addresses[i] : String(thread)));
    if (data.hit?.includes(i)) cell.classList.add('is-hit');
    if (data.miss?.includes(i)) cell.classList.add('is-miss');
    if (thread < 32) {
      cell.dataset.focus = data.focusMode === 'threads' ? 'threads' : 'row';
      cell.dataset.caption = data.caption || '';
    }
    grid.append(cell);
  }
  wrap.append(grid);
  if (data.note) wrap.append(h('p', 'p-scene-note', data.note));
  host.append(wrap);
}

function renderFormula(host, data) {
  const wrap = h('div', 'p-formula');
  wrap.append(h('div', 'p-formula-main', data.formula || ''));
  const terms = h('div', 'p-formula-terms');
  list(data.terms).forEach((item, index) => {
    const node = h('div', 'p-formula-term');
    node.dataset.focus = `term-${index}`;
    node.style.setProperty('--enter', index);
    node.dataset.caption = noteOf(item) || labelOf(item);
    node.append(h('b', '', item.symbol || ''), h('span', '', labelOf(item)));
    terms.append(node);
  });
  wrap.append(terms);
  if (data.result) wrap.append(h('div', 'p-formula-result', data.result));
  host.append(wrap);
}

function renderQuote(host, data) {
  const wrap = h('div', 'p-quote');
  wrap.append(h('span', 'p-quote-mark', '“'));
  wrap.append(h('p', '', data.text || ''));
  if (data.by) wrap.append(h('small', '', data.by));
  host.append(wrap);
}

function renderOptionBoard(host, data) {
  const wrap = h('div', 'p-options');
  list(data.options).forEach((option, index) => {
    const row = h('div', `p-option ${option.id === data.correctId ? 'is-correct' : 'is-wrong'}`);
    row.dataset.focus = `option-${index}`;
    row.style.setProperty('--enter', index);
    row.dataset.caption = option.note || option.text;
    row.append(h('span', 'p-option-key', option.id), h('strong', '', option.text));
    wrap.append(row);
  });
  host.append(wrap);
}

export const PRESETS = {
  flow: renderFlow,
  compare: renderCompare,
  'kv-grid': renderKVGrid,
  queue: renderQueue,
  orbit: renderOrbit,
  layers: renderLayers,
  matrix: renderMatrix,
  numberline: renderNumberline,
  lanes: renderLanes,
  memory: renderMemory,
  formula: renderFormula,
  quote: renderQuote,
  'option-board': renderOptionBoard,
};

/* ---------------------------------------------------------------- mounting */

function normalizeBeats(visual, host) {
  const beats = list(visual.beats).filter(beat => beat && Number.isFinite(Number(beat.at)));
  if (beats.length) return beats.map(beat => ({ ...beat, at: Number(beat.at) }));
  const focuses = [...host.querySelectorAll('[data-focus]')];
  return focuses.map((node, index) => ({
    at: index * 2200,
    focus: node.dataset.focus,
    caption: node.dataset.caption || '',
  }));
}

export function resolvePreset(name) {
  return PRESETS[name] || PRESETS.quote;
}

export function mountScene(host, visual, { reducedMotion = false } = {}) {
  const spec = visual && typeof visual === 'object' ? visual : {};
  const duration = clamp(Number(spec.duration) || 9000, 4000, 20000);
  const root = h('div', `scene-root scene-${spec.preset || 'quote'}`);
  root.dataset.camera = spec.camera || 'push';
  root.append(h('div', 'scene-grid'));
  const art = h('div', 'scene-art');
  const renderer = resolvePreset(spec.preset);
  try {
    renderer(art, spec.data || {}, spec);
  } catch {
    renderQuote(art, { text: spec.headline || '这一页的图解暂时没有加载。' });
  }
  const caption = h('div', 'scene-caption');
  caption.append(h('span', 'scene-caption-index', '01'), h('p', '', ''));
  const progress = h('div', 'scene-progress');
  progress.append(h('i'));
  root.append(art, caption, progress);
  host.append(root);

  const beats = normalizeBeats(spec, art);
  const captionText = caption.querySelector('p');
  const captionIndex = caption.querySelector('.scene-caption-index');
  const progressFill = progress.querySelector('i');
  let timers = [];
  let frame = 0;
  let started = performance.now();

  const setBeat = index => {
    const beat = beats[index];
    if (!beat) return;
    art.querySelectorAll('[data-focus]').forEach(node => {
      node.classList.toggle('is-focus', node.dataset.focus === beat.focus || beat.focus === '*');
    });
    captionText.textContent = beat.caption || '';
    captionIndex.textContent = String(Math.min(index + 1, Math.max(beats.length, 1))).padStart(2, '0');
  };
  const tick = () => {
    const ratio = clamp((performance.now() - started) / duration, 0, 1);
    progressFill.style.width = `${ratio * 100}%`;
    if (ratio < 1) frame = requestAnimationFrame(tick);
  };
  const start = () => {
    started = performance.now();
    timers.forEach(timer => clearTimeout(timer));
    timers = beats.map((beat, index) => setTimeout(() => setBeat(index), Math.max(0, beat.at)));
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  };

  setBeat(0);
  if (!reducedMotion) start();
  else {
    setBeat(0);
    progressFill.style.width = '100%';
  }

  return {
    duration,
    destroy() {
      timers.forEach(timer => clearTimeout(timer));
      cancelAnimationFrame(frame);
      root.remove();
    },
  };
}

/* ------------------------------------------------------- auto variations */

const CAMERAS = ['push', 'pull', 'track', 'pan', 'tilt', 'drift'];
const pick = (items, seed) => items[Math.abs(seed) % items.length];

function hash(text) {
  let value = 2166136261;
  const source = String(text || '');
  for (let index = 0; index < source.length; index += 1) {
    value ^= source.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

const normalizeText = text => String(text ?? '').replace(/\s+/g, ' ').trim();

function clip(text, max) {
  const value = normalizeText(text);
  return value.length > max ? `${value.slice(0, Math.max(1, max - 1))}…` : value;
}

function firstClause(text, max = 22) {
  const value = normalizeText(text);
  const head = value.split(/[，,；;。：:！？!?]/)[0].trim();
  return clip(head || value, max);
}

function sentences(text) {
  return normalizeText(text)
    .split(/(?<=[。！？!?])\s*/)
    .map(value => value.trim())
    .filter(Boolean);
}

function paragraphs(text) {
  return String(text ?? '')
    .split(/\n{2,}/)
    .map(value => normalizeText(value))
    .filter(Boolean);
}

function beatList(items, focus, step = 2200) {
  return items.map((item, index) => ({
    at: index * step,
    focus: typeof focus === 'function' ? focus(index) : `${focus}-${index}`,
    caption: clip(item, 76),
  }));
}

function pointNodes(points) {
  return points.map(point => {
    const value = normalizeText(point);
    const [head, ...rest] = value.split(/[，,；;。]/);
    const hasTail = rest.join('').trim().length > 0;
    return { label: firstClause(head || value, 18), note: hasTail ? clip(value, 52) : '' };
  });
}

function explainPresetFor(q) {
  const candidates = ['flow', 'compare', 'layers', 'quote'];
  return pick(candidates, hash(`${q.id}:explain`));
}

function autoSummary(q) {
  const points = list(q.answer.keyPoints);
  const nodes = pointNodes(points);
  const headlines = ['答案与理由，分开记', '先给结论，再补理由', '把答案拆成一条链', '记住这三步就够', '答案不是点，是关系'];
  if (hash(`${q.id}:summary`) % 3 === 0) {
    const layers = points.map(point => ({
      label: firstClause(point, 18),
      note: clip(point, 46),
    }));
    return {
      preset: 'layers',
      duration: 10000,
      camera: pick(['pull', 'tilt'], hash(`${q.id}:summary:camera`)),
      headline: pick(headlines, hash(`${q.id}:summary:headline`)),
      data: { layers },
      beats: beatList(points, 'layer', 2100),
    };
  }
  return {
    preset: 'flow',
    duration: 9500,
    camera: pick(['pan', 'track'], hash(`${q.id}:summary:camera`)),
    headline: pick(headlines, hash(`${q.id}:summary:headline`)),
    data: { nodes },
    beats: nodes.map((node, index) => ({ at: index * 2200, focus: `node-${index}`, caption: node.note || node.label })),
  };
}

function autoTerms(q) {
  const terms = list(q.answer.terms);
  const useLayers = hash(`${q.id}:terms`) % 2 === 0;
  const headlines = ['术语是理解的坐标', '先把名字拆开', '术语围成一圈', '每个词都要能复述', '先对齐词，再谈机制'];
  if (useLayers) {
    return {
      preset: 'layers',
      duration: 11000,
      camera: pick(['pull', 'push', 'tilt'], hash(`${q.id}:terms:camera`)),
      headline: pick(headlines, hash(`${q.id}:terms:headline`)),
      data: {
        layers: terms.map(term => ({ label: term.term, note: clip(firstClause(term.plain, 34), 34) })),
      },
      beats: terms.map((term, index) => ({ at: index * 2100, focus: `layer-${index}`, caption: term.plain })),
    };
  }
  return {
    preset: 'orbit',
    duration: 10500,
    camera: pick(['drift', 'push', 'track'], hash(`${q.id}:terms:camera`)),
    headline: pick(headlines, hash(`${q.id}:terms:headline`)),
    data: { center: '术语', kicker: 'TERMS', items: terms.map(term => term.term) },
    beats: terms.map((term, index) => ({ at: index * 2100, focus: `orbit-${index}`, caption: term.plain })),
  };
}

function autoOptions(q) {
  const headlines = ['每个干扰项都有来由', '错项也有它的逻辑', '先排除，再确认', '四个选项，四种误区', '看清每个选项的边界'];
  return {
    preset: 'option-board',
    duration: 9500,
    camera: pick(['track', 'pan', 'tilt', 'drift'], hash(`${q.id}:options`)),
    headline: pick(headlines, hash(`${q.id}:options:headline`)),
    data: { options: q.options, correctId: q.answer.optionId },
    beats: q.options.map((option, index) => ({
      at: index * 1900,
      focus: `option-${index}`,
      caption: q.answer.optionNotes?.[option.id] || '',
    })),
  };
}

function autoExplain(q) {
  const preset = explainPresetFor(q);
  const points = list(q.answer.keyPoints);
  const pitfalls = list(q.answer.pitfalls);
  const terms = list(q.answer.terms);
  const seed = hash(`${q.id}:explain:camera`);

  if (preset === 'compare') {
    const left = points.slice(0, 3).map(point => clip(point, 28));
    const right = pitfalls.slice(0, 3).map(point => clip(point, 28));
    return {
      preset: 'compare',
      duration: 10000,
      camera: pick(['drift', 'tilt', 'push'], seed),
      headline: '先看它为什么成立，再看哪里会错',
      data: {
        left: { kicker: 'WHY', title: '机制成立', items: left, caption: points[0] || '' },
        right: { kicker: 'TRAP', title: '容易答错', items: right, caption: pitfalls[0] || '' },
        vs: 'VS',
      },
      beats: [
        { at: 0, focus: 'left', caption: clip(points[0] || left[0] || '', 76) },
        { at: 3200, focus: 'right', caption: clip(pitfalls[0] || right[0] || '', 76) },
      ],
    };
  }
  if (preset === 'layers') {
    return {
      preset: 'layers',
      duration: 11000,
      camera: pick(['pull', 'push', 'tilt'], seed),
      headline: '一层一层，把机制拆开',
      data: {
        layers: terms.map(term => ({
          label: term.term,
          note: clip(firstClause(term.plain, 30), 32),
        })),
      },
      beats: terms.map((term, index) => ({ at: index * 2100, focus: `layer-${index}`, caption: term.plain })),
    };
  }
  if (preset === 'quote') {
    const stance = sentences(q.answer.explanation)[0] || q.answer.explanation;
    const text = clip(stance, 92);
    return {
      preset: 'quote',
      duration: 8200,
      camera: pick(['push', 'pull'], seed),
      headline: '一句话，先记住判断',
      data: { text, by: `${q.topic} · 机制的一句话` },
      beats: [{ at: 0, focus: '*', caption: text }],
    };
  }
  const nodes = pointNodes(points);
  return {
    preset: 'flow',
    duration: 9500,
    camera: pick(['pan', 'track'], seed),
    headline: '把机制拆成几步，答案就稳了',
    data: { nodes },
    beats: nodes.map((node, index) => ({ at: index * 2200, focus: `node-${index}`, caption: node.note || node.label })),
  };
}

function autoDeep(q) {
  const explain = q.visual?.preset || explainPresetFor(q);
  const candidates = ['compare', 'quote', 'flow', 'layers'].filter(preset => preset !== explain);
  const preset = pick(candidates, hash(`${q.id}:deep`));
  const seed = hash(`${q.id}:deep:camera`);
  const pitfalls = list(q.answer.pitfalls);
  const points = list(q.answer.keyPoints);
  const terms = list(q.answer.terms);
  const deepSentences = sentences(q.answer.deepDive);
  const deepParagraphs = paragraphs(q.answer.deepDive);

  if (preset === 'compare') {
    const left = (deepSentences.length ? deepSentences : [q.answer.deepDive]).slice(0, 3).map(item => clip(item, 28));
    const right = pitfalls.slice(0, 3).map(item => clip(item, 28));
    return {
      preset: 'compare',
      duration: 10500,
      camera: pick(['drift', 'tilt'], seed),
      headline: '多讲一层，边界也要讲清楚',
      data: {
        left: { kicker: 'DEEPER', title: '再深一层', items: left, caption: deepSentences[0] || '' },
        right: { kicker: 'BOUNDARY', title: '边界与代价', items: right, caption: pitfalls[0] || '' },
        vs: 'VS',
      },
      beats: [
        { at: 0, focus: 'left', caption: clip(deepSentences[0] || q.answer.deepDive, 76) },
        { at: 3400, focus: 'right', caption: clip(pitfalls[0] || right[0] || '', 76) },
      ],
    };
  }
  if (preset === 'quote') {
    const pool = deepSentences.filter(item => item.length >= 18);
    const text = clip(pick(pool.length ? pool : [q.answer.deepDive], seed), 96);
    return {
      preset: 'quote',
      duration: 8600,
      camera: pick(['push', 'pull'], seed),
      headline: '面试时，用一句话收尾',
      data: { text, by: `再深一层 · ${q.topic}` },
      beats: [{ at: 0, focus: '*', caption: text }],
    };
  }
  if (preset === 'layers') {
    const depth = deepSentences.length >= 3 ? deepSentences.slice(0, 4) : [];
    const layers = depth.length
      ? depth.map(item => ({ label: firstClause(item, 18), note: clip(item, 42) }))
      : terms.map(term => ({ label: term.term, note: clip(firstClause(term.plain, 30), 32) }));
    return {
      preset: 'layers',
      duration: 11000,
      camera: pick(['pull', 'tilt', 'push'], seed),
      headline: '顺着因果，再往下拆一层',
      data: { layers },
      beats: depth.length
        ? depth.map((item, index) => ({ at: index * 2200, focus: `layer-${index}`, caption: clip(item, 76) }))
        : terms.map((term, index) => ({ at: index * 2100, focus: `layer-${index}`, caption: term.plain })),
    };
  }
  const source = deepParagraphs.length >= 2
    ? deepParagraphs.slice(0, 4)
    : (deepSentences.length ? deepSentences.slice(0, 4) : [q.answer.deepDive]);
  const nodes = source.map((item, index) => ({
    label: firstClause(item, 18) || `第 ${index + 1} 层`,
    note: clip(item, 52),
  }));
  return {
    preset: 'flow',
    duration: 10000,
    camera: pick(['pan', 'track'], seed),
    headline: '顺着因果，再往下走一层',
    data: { nodes },
    beats: nodes.map((node, index) => ({ at: index * 2300, focus: `node-${index}`, caption: node.note || node.label })),
  };
}

export function autoVisual(q, kind) {
  if (!q?.answer) return null;
  if (kind === 'summary') return autoSummary(q);
  if (kind === 'terms') return autoTerms(q);
  if (kind === 'explain') return autoExplain(q);
  if (kind === 'deep') return autoDeep(q);
  if (kind === 'options' && list(q.options).length) return autoOptions(q);
  return null;
}

export function visualFor(q, kind) {
  if (kind === 'explain' && q.visual) return q.visual;
  if (kind === 'deep' && q.visual?.deep) return { ...q.visual, ...q.visual.deep };
  return autoVisual(q, kind);
}
