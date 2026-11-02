/**
 * 직접 쓴 말 재료 조회(STATS-MAP-001) — 이번 주 창을 열 때만(다시 만난 말과 같은 자리 · 홈 첫 화면 비용 0).
 *  ① 작문: writing_practice의 내 문장(작문 화면 · 오늘 학습 쓰기 문항 — 둘 다 여기에 남는다). 「처음 씀」 판정에 지난 기록도 본다.
 *  ② 대화: 최근 대화 자료 50개(이번 주 카드 대화 줄과 같은 범위)의 내 말(턴 who 'me', 음성 포함)과 시각.
 *  ③ 담은 말: 현황 snapshot 행(word_text · base_form · created_at) — 다시 받지 않는다.
 * 실패한 조회는 그 축이 빌 뿐 — 줄이 없으면 이번 주 창에 「직접 쓴 말」 줄도 없다(0 무표기).
 */
import { supabase } from './supabase';
import { readCompleteLegacyRows } from './legacyReviewSync';
import { buildOutput } from './usedWords';

const DAY = 86400000;
const settle = (promise, fallback) => Promise.resolve().then(() => promise).then(r => r?.data ?? r ?? fallback, () => fallback);
const titleOf = row => (row.prompt && String(row.prompt).trim()) || String(row.sentence || '').trim().slice(0, 24);

export async function fetchOutputWeeks(userId, { weekStartMs, now = Date.now(), vocabRows = [] } = {}) {
  const [writings, convs] = await Promise.all([
    settle(readCompleteLegacyRows(() => supabase.from('writing_practice').select('id, created_at, sentence, prompt', { count: 'exact' })
      .eq('user_id', userId), { orderBy: ['created_at', 'id'] }), []),
    settle(supabase.from('reading_materials')
      .select('id,title,turns:processed_json->metadata->conversation->turns')
      .eq('owner_id', userId).not('processed_json->metadata->conversation', 'is', null)
      .order('id', { ascending: false }).limit(50), []),
  ]);
  const sources = [
    ...(writings || []).map(w => ({ kind: 'writing', id: w.id, title: titleOf(w), texts: [{ text: String(w.sentence || ''), at: Date.parse(w.created_at) }] })),
    ...(convs || []).map(c => ({ kind: 'conversation', id: c.id, title: c.title,
      texts: (Array.isArray(c.turns) ? c.turns : []).filter(t => t?.who === 'me' && t.text).map(t => ({ text: String(t.text), at: Number(t.at) })) })),
  ];
  const until = Math.max(now, weekStartMs) + 1;
  return {
    week: buildOutput({ sources, vocabRows, fromMs: weekStartMs, untilMs: until }),
    prev: buildOutput({ sources, vocabRows, fromMs: weekStartMs - 7 * DAY, untilMs: weekStartMs }),
  };
}
