export const assessments = ['未掌握', '部分掌握', '已掌握'];
export const topics = ['AI Infra', 'vLLM', 'SGLang', 'Motor', '面经', 'TensorRT-LLM', '量化', 'CUDA/GPU', '昇腾'];
export const difficulties = ['基础', '进阶'];
export const visualPresets = ['flow','compare','kv-grid','queue','orbit','layers','matrix','numberline','lanes','memory','formula','quote','option-board'];
export const visualCameras = ['push','pull','track','pan','tilt','drift'];
const visualSlides = ['summary','terms','explain','deep','options'];
const visualRequirements = {
  flow: d => Array.isArray(d.nodes) && d.nodes.length >= 2,
  compare: d => d.left && typeof d.left === 'object' && d.right && typeof d.right === 'object',
  'kv-grid': d => Array.isArray(d.logical) && d.logical.length > 0 && Array.isArray(d.physical) && d.physical.length > 0,
  queue: d => Array.isArray(d.rounds) && d.rounds.length > 0,
  orbit: d => Array.isArray(d.items) && d.items.length > 0,
  layers: d => Array.isArray(d.layers) && d.layers.length > 0,
  matrix: d => Array.isArray(d.columns) && d.columns.length === 3 && Array.isArray(d.rows) && d.rows.length > 0
    && d.rows.every(row => row && Array.isArray(row.cells) && row.cells.length === 3),
  numberline: d => Number.isFinite(d.min) && Number.isFinite(d.max) && d.max > d.min && Array.isArray(d.marks) && d.marks.length > 0,
  lanes: d => Number.isFinite(d.lanes) && d.lanes > 0,
  memory: d => Number.isFinite(d.rows) && d.rows > 0 && Number.isFinite(d.cols) && d.cols > 0,
  formula: d => typeof d.formula === 'string' && d.formula.trim().length > 0,
  quote: d => typeof d.text === 'string' && d.text.trim().length > 0,
  'option-board': d => Array.isArray(d.options) && d.options.length > 0,
};
function validateVisual(q, visual, label, inheritedPreset) {
  const where = label ? `${q.id}: 视觉 ${label}` : `${q.id}: 视觉`;
  if (!visual || typeof visual !== 'object' || Array.isArray(visual)) throw Error(`${where} 必须是对象`);
  const preset = visual.preset ?? inheritedPreset;
  if (label && visual.preset === undefined && !inheritedPreset) throw Error(`${where} 缺少 preset`);
  if (!visualPresets.includes(preset)) throw Error(`${where} 未知 preset ${preset}`);
  if (visual.duration !== undefined && (!Number.isFinite(visual.duration) || visual.duration < 4000 || visual.duration > 20000)) throw Error(`${where} duration 必须在 4000–20000ms`);
  if (visual.camera !== undefined && !visualCameras.includes(visual.camera)) throw Error(`${where} 未知 camera ${visual.camera}`);
  if (visual.headline !== undefined && (typeof visual.headline !== 'string' || !visual.headline.trim())) throw Error(`${where} headline 无效`);
  if (visual.headlines !== undefined) {
    if (!visual.headlines || typeof visual.headlines !== 'object' || Array.isArray(visual.headlines)) throw Error(`${where} headlines 无效`);
    for (const [key, value] of Object.entries(visual.headlines)) {
      if (!visualSlides.includes(key) || typeof value !== 'string' || !value.trim()) throw Error(`${where} headlines.${key} 无效`);
    }
  }
  if (visual.data !== undefined) {
    if (!visual.data || typeof visual.data !== 'object' || Array.isArray(visual.data)) throw Error(`${where} data 必须是对象`);
    if (!visualRequirements[preset](visual.data)) throw Error(`${where} data 不满足 ${preset} 的结构要求`);
  } else if (!label) throw Error(`${where} 缺少 data`);
  if (visual.beats !== undefined) {
    if (!Array.isArray(visual.beats)) throw Error(`${where} beats 必须是数组`);
    visual.beats.forEach((beat, index) => {
      if (!beat || !Number.isFinite(beat.at) || beat.at < 0) throw Error(`${where} beats[${index}].at 无效`);
      if (typeof beat.focus !== 'string' || !beat.focus.trim()) throw Error(`${where} beats[${index}].focus 无效`);
      if (beat.caption !== undefined && typeof beat.caption !== 'string') throw Error(`${where} beats[${index}].caption 无效`);
    });
  }
  if (visual.deep !== undefined) {
    if (label) throw Error(`${where} 不应嵌套 deep`);
    if (visual.deep && typeof visual.deep === 'object' && visual.deep.preset === undefined) validateVisual(q, visual.deep, 'deep', preset);
    else validateVisual(q, visual.deep, 'deep');
  }
}
export function validateBank(bank) {
  if(bank?.schemaVersion!==1||!Array.isArray(bank.questions)||!bank.questions.length||!Array.isArray(bank.sources)||!bank.sources.length)throw Error('题库版本或结构无效');
  const sources=new Set(),ids=new Set();
  for(const s of bank.sources){
    if(!s.id||sources.has(s.id)||typeof s.title!=='string'||!s.title.trim()||typeof s.kind!=='string'||!s.kind.trim())throw Error('来源身份或标题无效');
    let url;try{url=new URL(s.url);}catch{throw Error(`来源地址无效：${s.id}`);}
    if(!['http:','https:'].includes(url.protocol))throw Error(`来源地址无效：${s.id}`);
    sources.add(s.id);
  }
  for(const q of bank.questions){
    if(!q.id||ids.has(q.id)||!Number.isInteger(q.revision)||!['single','short'].includes(q.type))throw Error('题目身份或类型无效');ids.add(q.id);
    for(const k of ['topic','difficulty','title','prompt'])if(typeof q[k]!=='string'||!q[k].trim())throw Error(`${q.id}: 缺少${k}`);
    if(!topics.includes(q.topic))throw Error(`${q.id}: 未知专题 ${q.topic}`);
    if(!difficulties.includes(q.difficulty))throw Error(`${q.id}: 未知难度 ${q.difficulty}`);
    if(!Array.isArray(q.tags)||!q.tags.length||q.tags.some(t=>typeof t!=='string'||!t.trim()))throw Error(`${q.id}: 标签无效`);
    for(const k of ['reference','explanation','analogy'])if(typeof q.answer?.[k]!=='string'||!q.answer[k].trim())throw Error(`${q.id}: 缺少解析${k}`);
    for(const k of ['keyPoints','pitfalls','followUps'])if(!Array.isArray(q.answer[k])||!q.answer[k].length||q.answer[k].some(x=>typeof x!=='string'||!x.trim()))throw Error(`${q.id}: 解析列表无效`);
    if(!Array.isArray(q.answer.terms)||q.answer.terms.length<3||q.answer.terms.length>5)throw Error(`${q.id}: 名词解释数量无效`);
    for(const t of q.answer.terms){
      if(!t||typeof t.term!=='string'||!t.term.trim()||typeof t.plain!=='string'||!t.plain.trim())throw Error(`${q.id}: 名词解释无效`);
      if(t.sourceId!==undefined&&(!sources.has(t.sourceId)||!q.sourceIds.includes(t.sourceId)))throw Error(`${q.id}: 名词来源无效`);
    }
    if(typeof q.answer.deepDive!=='string'||!q.answer.deepDive.trim())throw Error(`${q.id}: 深入讲解无效`);
    if(!Array.isArray(q.sourceIds)||!q.sourceIds.length||new Set(q.sourceIds).size!==q.sourceIds.length||q.sourceIds.some(id=>!sources.has(id)))throw Error(`${q.id}: 来源无效`);
    if(!['adapted','original'].includes(q.origin?.kind)||typeof q.origin.note!=='string'||!q.origin.note.trim())throw Error(`${q.id}: 来源属性无效`);
    if(q.visual!==undefined) validateVisual(q, q.visual, '');
    if(q.type==='single'){
      if(!Array.isArray(q.options)||q.options.length<2||new Set(q.options.map(o=>o.id)).size!==q.options.length||q.options.some(o=>typeof o.id!=='string'||!o.id.trim()||typeof o.text!=='string'||!o.text.trim())||!q.options.some(o=>o.id===q.answer.optionId))throw Error(`${q.id}: 选项与答案不匹配`);
      const notes=q.answer.optionNotes;
      if(!notes||typeof notes!=='object'||Array.isArray(notes)||Object.keys(notes).length!==q.options.length||q.options.some(o=>typeof notes[o.id]!=='string'||!notes[o.id].trim()))throw Error(`${q.id}: 选项讲解无效`);
    }else if(q.options!==undefined||q.answer.optionId!==undefined)throw Error(`${q.id}: 简答题不应包含选项`);
    else if(q.answer.optionNotes!==undefined)throw Error(`${q.id}: 简答题不应包含选项讲解`);
  }
  return bank;
}
export function fresh(q) { return {revision:q.revision,selected:null,submitted:false,revealed:false,text:'',selfAssessment:null,bookmarked:false}; }
export function restore(q,value) {
  const base=fresh(q);
  if(!value || value.revision!==q.revision) return base;
  const selected=q.options?.some(o=>o.id===value.selected)?value.selected:null;
  return {...base,selected,submitted:q.type==='single'&&value.submitted===true&&selected!==null,
    revealed:value.revealed===true,text:typeof value.text==='string'?value.text:'',
    selfAssessment:q.type==='short'&&value.revealed===true&&assessments.includes(value.selfAssessment)?value.selfAssessment:null,
    bookmarked:value.bookmarked===true};
}
export function isCorrect(q,s) { return q.type==='single'&&s.submitted&&s.selected===q.answer.optionId; }
export function isWrong(q,s) { return q.type==='single'?s.submitted&&!isCorrect(q,s):s.selfAssessment!==null&&s.selfAssessment!=='已掌握'; }
export function completed(q,s) { return q.type==='single'?s.submitted:s.selfAssessment!==null; }
export function filterQuestions(bank,states,f) {
  const query=(f.search||'').trim().toLocaleLowerCase();
  return bank.filter(q=>(!f.topic||q.topic===f.topic)&&(!f.difficulty||q.difficulty===f.difficulty)&&(!f.type||q.type===f.type)
    &&(!query||[q.title,q.prompt,...q.tags].join(' ').toLocaleLowerCase().includes(query))
    &&(f.mode==='wrong'?isWrong(q,states[q.id]):f.mode==='bookmarked'?states[q.id].bookmarked:true));
}
export function statistics(bank,states) {
  const singles=bank.filter(q=>q.type==='single'), attempted=singles.filter(q=>states[q.id].submitted), correct=attempted.filter(q=>isCorrect(q,states[q.id]));
  const shorts=bank.filter(q=>q.type==='short'), selfRated=shorts.filter(q=>states[q.id].selfAssessment!==null);
  return {total:bank.length,done:bank.filter(q=>completed(q,states[q.id])).length,attempted:attempted.length,correct:correct.length,
    accuracy:attempted.length?Math.round(correct.length/attempted.length*100):null,
    shortTotal:shorts.length,selfRated:selfRated.length,mastered:selfRated.filter(q=>states[q.id].selfAssessment==='已掌握').length,
    wrong:bank.filter(q=>isWrong(q,states[q.id])).length,bookmarked:bank.filter(q=>states[q.id].bookmarked).length};
}
