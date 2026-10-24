// 패턴 담기(목업 U 4판 · 오너 10-24 「문법(패턴) 저장할 수 있게 별 표시」) — [문장] 탭 패턴 카드의 ☆.
// 새 표 · 새 환경 변수 없이 기존 문법 복습 큐(grammar_review)에 `bk:` 접두 행을 넣는다(rt: 독해 · drill: 드릴과 같은 결).
// 담은 패턴은 오늘 바로 문법 복습(/review/grammar)에 「뜻 고르기」 문항으로 나온다 — 단어장 ☆ → 「오늘」과 같은 약속.
import { supabase } from './supabase.js';
import { initialQueueRow } from './grammarSrs.js';
import { learningDay, schedulerTime } from './fsrsScheduler.js';
import { PATTERN_SLUG_PREFIX } from './sentencePattern.js';

/** 이 언어에서 담은 패턴 — slug → next_review_at. 실패는 빈 Map(☆만 보인다). */
export async function fetchSavedPatternRows(userId, lang) {
  if (!userId || !lang) return new Map();
  try {
    const { data, error } = await supabase
      .from('grammar_review')
      .select('slug, next_review_at')
      .eq('user_id', userId)
      .eq('lang', lang)
      .like('slug', `${PATTERN_SLUG_PREFIX}%`);
    if (error) throw error;
    return new Map((data || []).map((row) => [row.slug, row.next_review_at]));
  } catch {
    return new Map();
  }
}

/** 큐 행 — 첫 복습은 지금(담은 날 바로 「오늘」). 다른 칸은 챕터 큐와 같은 첫 값. */
export function patternQueueRow(userId, lang, slug, now = new Date()) {
  return { ...initialQueueRow(userId, lang, slug, now), next_review_at: new Date(now).toISOString() };
}

/** 담기 — 이미 있으면 그대로 둔다(일정 · 기록 보존). 실패는 던진다(화면이 알린다). */
export async function savePatternReview(userId, lang, slug) {
  const { error } = await supabase
    .from('grammar_review')
    .upsert(patternQueueRow(userId, lang, slug), { onConflict: 'user_id,lang,slug', ignoreDuplicates: true });
  if (error) throw error;
}

/**
 * 상태 칸 — 단어장과 같은 말(levelWordStatus): 담지 않음 'new'(☆) · 오늘 학습일(04시 경계) 안 'today' · 그 뒤 'review'.
 * @param {Map<string,string|null>|null} saved fetchSavedPatternRows 산출(아직 없으면 null — 자리만)
 */
export function patternStatus(saved, slug, at = Date.now()) {
  if (!saved) return null;
  if (!slug || !saved.has(slug)) return 'new';
  const next = saved.get(slug);
  if (next == null) return 'today';
  return learningDay(schedulerTime(next)) <= learningDay(schedulerTime(at)) ? 'today' : 'review';
}
