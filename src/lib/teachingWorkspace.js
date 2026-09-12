// Short-lived workspace preferences never become textbook or student records.
export const DEFAULT_BOARD_WORKSPACE = {layout:'split', ratio:60, input:'', reading:'', meaning:''};
export function normalizeBoardWorkspace(value = {}) {
  return {layout:['split','board','reader'].includes(value.layout)?value.layout:'split',
    ratio:Number.isFinite(value.ratio)?Math.max(40,Math.min(72,value.ratio)):60,
    ...Object.fromEntries(['input','reading','meaning'].map(key=>[key,String(value[key] || '').slice(0,500)]))};
}
export function readBoardWorkspace(scope) {
  try { return normalizeBoardWorkspace(JSON.parse(sessionStorage.getItem(`board-workspace:${scope}`) || '{}')); }
  catch { return {...DEFAULT_BOARD_WORKSPACE}; }
}
export function writeBoardWorkspace(scope, value) {
  try { sessionStorage.setItem(`board-workspace:${scope}`,JSON.stringify(normalizeBoardWorkspace(value))); } catch { /* The board itself still uses IndexedDB. */ }
}
export function boardSearch(query, entries, limit = 6) {
  const q=query.trim().toLocaleLowerCase();if(!q)return [];
  const seen=new Set();
  return entries.filter(row=>{
    if(!row.text?.trim() || ![row.text,row.reading,row.meaning].some(s=>String(s||'').toLocaleLowerCase().includes(q)))return false;
    const key=JSON.stringify([row.text,row.reading,row.meaning]);if(seen.has(key))return false;seen.add(key);return true;
  }).sort((a,b)=>Number(b.text.toLocaleLowerCase()===q)-Number(a.text.toLocaleLowerCase()===q)).slice(0,limit);
}
// A presentation is a disposable view. Hiding readings must not rewrite cards.
export function presentationElements(elements, {reading=null,meaning=null} = {}) {
  return elements.filter(el=>!el.isDeleted).map(el=>({...el,
    opacity:el.customData?.manabiField==='reading'&&reading!==null ? (reading?100:0) : el.customData?.manabiField==='meaning'&&meaning!==null ? (meaning?100:0) : el.opacity,
  }));
}
