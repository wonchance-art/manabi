/**
 * 다시 만난 말 재료 조회(STATS-MAP-001) — 이번 주 창을 열 때만(WeeklyReportCard showWeakness 경로, 홈 첫 화면 비용 0).
 * 지난주 · 이번 주 두 창을 한 번에 받아 buildRemet을 두 번 돈다. 새 기록 · 새 테이블 없음.
 *  ① 다 읽은 글: reading_progress(completed_at — 이번 주 「완독」과 같은 출처) → 그 글들의 본문 토큰(sequence · dictionary)
 *  ② 대화: 최근 대화 자료 50개(이번 주 카드 대화 줄과 같은 범위)의 턴 시각으로 두 주에 말한 자료만 고른 뒤 그 토큰
 *  ③ 담은 말(word_text · base_form) · ④ 그 말들의 복습(review_events source 'vocab', 지금까지)
 * 실패한 조회는 그 축이 빌 뿐 — 줄이 없으면 이번 주 창에 「다시 만난 말」 줄도 없다(0 무표기).
 */
import { supabase } from './supabase';
import { readCompleteLegacyRows } from './legacyReviewSync';
import { materialContentWords } from './materialFit';
import { buildRemet, conversationWordsBetween } from './remetWords';

const DAY = 86400000;
const CHUNK = 100;
const chunks = (list, n = CHUNK) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
const settle = (promise, fallback) => Promise.resolve().then(() => promise).then(r => r?.data ?? r ?? fallback, () => fallback);

export async function fetchRemetWeeks(userId, { weekStartMs, now = Date.now(), vocabRows: knownVocab = null } = {}) {
  const prevStartMs = weekStartMs - 7 * DAY;
  const sinceIso = new Date(prevStartMs).toISOString();
  const [reads, convList, vocabRows] = await Promise.all([
    settle(supabase.from('reading_progress').select('material_id, completed_at')
      .eq('user_id', userId).eq('is_completed', true).gte('completed_at', sinceIso), []),
    settle(supabase.from('reading_materials')
      .select('id,title,turns:processed_json->metadata->conversation->turns')
      .eq('owner_id', userId).not('processed_json->metadata->conversation', 'is', null)
      .order('id', { ascending: false }).limit(50), []),
    // 현황이 이미 받은 학습 snapshot 행(word_text · base_form 포함)을 넘기면 다시 받지 않는다.
    Array.isArray(knownVocab) ? knownVocab : settle(readCompleteLegacyRows(() => supabase.from('user_vocabulary').select('id, word_text, base_form', { count: 'exact' })
      .eq('user_id', userId)), []),
  ]);
  const convIds = (convList || []).filter(c => (Array.isArray(c.turns) ? c.turns : []).some(t => Number(t?.at) >= prevStartMs)).map(c => c.id);
  const convIdSet = new Set(convIds.map(String));
  const readIds = [...new Set((reads || []).map(r => r.material_id).filter(id => id != null && !convIdSet.has(String(id))))];
  const bodies = new Map();
  for (const ids of chunks([...readIds, ...convIds])) {
    const rows = await settle(supabase.from('reading_materials')
      .select('id,title,sequence:processed_json->sequence,dictionary:processed_json->dictionary').in('id', ids), []);
    for (const row of rows || []) bodies.set(String(row.id), row);
  }
  // 두 주 창별 글 · 대화 — 단어마다 만난 시각(글 = 다 읽은 때, 대화 = 그 줄이 붙은 때).
  const windows = [[prevStartMs, weekStartMs], [weekStartMs, Math.max(now, weekStartMs) + 1]];
  const sourcesFor = ([from, until]) => {
    const out = [];
    for (const r of reads || []) {
      const at = Date.parse(r.completed_at);
      const body = bodies.get(String(r.material_id));
      if (!body || !Number.isFinite(at) || at < from || at >= until || convIdSet.has(String(r.material_id))) continue;
      out.push({ kind: 'reading', id: body.id, title: body.title,
        words: materialContentWords({ sequence: body.sequence, dictionary: body.dictionary }).map(w => ({ ...w, at })) });
    }
    for (const id of convIds) {
      const body = bodies.get(String(id));
      if (!body) continue;
      const words = conversationWordsBetween({ sequence: body.sequence, dictionary: body.dictionary }, from, until);
      if (words.length) out.push({ kind: 'conversation', id: body.id, title: body.title, words });
    }
    return out;
  };
  const [prevSources, thisSources] = windows.map(sourcesFor);
  // 그 두 주에 나온 담은 말의 복습만 받는다(item_key = word_text).
  const surfaces = new Map((vocabRows || []).map(v => [v.word_text, v]));
  const bases = new Map((vocabRows || []).filter(v => v.base_form).map(v => [v.base_form, v]));
  const candidates = new Set();
  for (const source of [...prevSources, ...thisSources]) {
    for (const w of source.words) {
      const row = surfaces.get(w.text) || bases.get(w.base_form) || surfaces.get(w.base_form);
      if (row) candidates.add(row.word_text);
    }
  }
  const reviewRows = [];
  for (const keys of chunks([...candidates])) {
    const rows = await settle(readCompleteLegacyRows(() => supabase.from('review_events').select('id, item_key, created_at', { count: 'exact' })
      .eq('user_id', userId).eq('source', 'vocab').in('item_key', keys).lte('created_at', new Date(now).toISOString()),
    { orderBy: ['created_at', 'id'] }), []);
    reviewRows.push(...(rows || []));
  }
  return {
    week: buildRemet({ sources: thisSources, vocabRows, reviewRows }),
    prev: buildRemet({ sources: prevSources, vocabRows, reviewRows }),
  };
}
