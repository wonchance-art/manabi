import { noteEntries, TEAM_KEY_RE } from './classBoard';
import { replaceViewerAnalysis } from './reanalysisPreservation';

export const CLASS_LANG = {
  Japanese: { code: 'ja', label: '일본어', glyph: 'あ' }, Chinese: { code: 'zh', label: '중국어', glyph: '学' },
  French: { code: 'fr', label: '프랑스어', glyph: 'à' }, English: { code: 'en', label: '영어', glyph: 'Aa' },
};
export const classLanguage = lang => CLASS_LANG[lang] || CLASS_LANG.Japanese;
export const classroomScope = (owner, key, day) => JSON.stringify([owner, key, day]);
export function classroomEntries(note) {
  const meta = note?.processed_json?.metadata || {};
  return noteEntries(note).map(entry => {
    const anchor = meta.classEntries?.find(a => a.idx === entry.idx && a.text === entry.text);
    const id = anchor?.id || `legacy:${entry.idx}:${entry.text}`;
    const edit = meta.classMeanings?.[id];
    const content = entry.tokens.filter(t => !['기호','개행','미분석'].includes(t.pos));
    // Multiple token glosses are explanations, never a sentence translation.
    const primary = edit?.text === entry.text ? edit.meaning : content.length === 1 && entry.analyzed ? content[0].meaning || '' : '';
    return { ...entry, id, primary, manual: edit?.text === entry.text,
      reading: ['Japanese','Chinese'].includes(meta.language || 'Japanese') ? entry.reading : '' };
  });
}
export function classViewerHref(id, team, day) {
  const back = `/class/${encodeURIComponent(team)}/live${day ? `?day=${day}` : ''}`;
  return `/viewer/${id}?returnTo=${encodeURIComponent(back)}`;
}
export function classLinkPath(value, origin) {
  const text = String(value || '').trim();
  if (TEAM_KEY_RE.test(text)) return `/class/${text}`;
  try {
    const url = new URL(text, origin);
    if (url.origin !== origin || url.username || url.password) return null;
    const match = /^\/class\/([a-z0-9][a-z0-9-]{0,15})\/?$/.exec(url.pathname);
    return match ? `/class/${match[1]}` : null;
  } catch { return null; }
}
export function classroomError(error) {
  if (error?.code === 'PGRST202') return '안전한 수업 저장 기능을 준비 중이에요. 입력은 이 기기에 보관되어 있어요.';
  if (error?.code === '40001') return '다른 창에서 내용이 바뀌었어요. 최신 내용을 확인한 뒤 다시 저장해 주세요.';
  return error?.message || '연결을 확인한 뒤 다시 시도해 주세요.';
}
export async function appendClassroomEntry(client, operation) {
  const { data, error } = await client.rpc('classroom_append_entry', {
    p_root: String(operation.rootId), p_day: operation.day, p_text: operation.text, p_operation: operation.id,
  });
  if (error) throw error;
  if (!data?.material?.id) throw new Error('저장 응답을 확인하지 못했어요. 같은 요청으로 다시 확인해 주세요.');
  return data.material;
}
export async function saveClassroomMetadata(client, note, patch) {
  const attempt = crypto.randomUUID();
  const json = { ...note.processed_json, metadata: { ...note.processed_json?.metadata, ...patch, viewerRevision: attempt, updated_at: new Date().toISOString() } };
  return replaceViewerAnalysis(client, note, note.raw_text, json, attempt);
}
export function classMeaningPatch(note, entry, meaning) {
  const latest = classroomEntries(note).find(e => e.id === entry.id && e.text === entry.text);
  if (!latest) throw new Error('원문이 바뀌었어요. 항목을 다시 열어 주세요.');
  return { classMeanings: { ...note.processed_json?.metadata?.classMeanings, [entry.id]: { text: entry.text, meaning: meaning.trim() } } };
}
export function classroomPlainText(note) {
  return [note.title, '', ...classroomEntries(note).map(e => [e.text,e.reading,e.primary].filter(Boolean).join(' — '))].join('\n');
}
