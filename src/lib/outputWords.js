/**
 * 산출 연동 — 오늘 복습 단어 선정 엔진 (#1077 제안 16+17 — 발주 5386789708 회수분,
 * Claude 직접 수행). 순수 모듈: 오늘 복습한 단어를 작문·회화에 주입할 후보로 고른다
 * (산출 가설 — 배선·프롬프트 카피는 별도 라운드).
 * 오늘 경계는 growthStats, 채점 판정은 weeklyReport 정본 재사용(중복 신설 금지).
 */
import { kstDayStartMs } from './growthStats';
import { isGradedReviewEvent } from './weeklyReport';

const DAY_MS = 86400000;

/**
 * 오늘(KST) 복습한 단어 중 산출 주입 후보 — 오답 있었던 단어 우선(약점 우선),
 * 그 안에서 최근 복습순, 상위 cap.
 * 이벤트↔단어 연결은 detail.word_id, 오늘 이벤트 매칭이 전무하면 last_reviewed_at이
 * 오늘인 단어로 폴백. language 불일치 행은 제외. 뜻 없는 행도 word_text로 포함.
 * @returns {Array<{ id, word_text, meaning }>}
 */
export function pickOutputWords({ vocabRows, events, language, now = Date.now(), cap = 3 } = {}) {
  const dayStart = kstDayStartMs(now);
  const inToday = (ts) => {
    const t = new Date(ts).getTime();
    return Number.isFinite(t) && t >= dayStart && t < dayStart + DAY_MS;
  };

  const byId = new Map();
  for (const v of vocabRows || []) if (v?.id != null) byId.set(v.id, v);

  // 오늘 채점 이벤트 → 단어별 { wrong(오답 있었나), lastTs(마지막 접촉) }
  const touched = new Map();
  for (const e of events || []) {
    if (!isGradedReviewEvent(e) || !e?.created_at || !inToday(e.created_at)) continue;
    const wid = e?.detail?.word_id;
    if (wid == null || !byId.has(wid)) continue;
    const cur = touched.get(wid) || { wrong: false, lastTs: 0 };
    if (e.correct === false) cur.wrong = true;
    const t = new Date(e.created_at).getTime();
    if (t > cur.lastTs) cur.lastTs = t;
    touched.set(wid, cur);
  }

  let pool;
  if (touched.size > 0) {
    pool = [...touched.entries()].map(([wid, m]) => ({ v: byId.get(wid), ...m }));
  } else {
    pool = (vocabRows || [])
      .filter((v) => v?.last_reviewed_at && inToday(v.last_reviewed_at))
      .map((v) => ({ v, wrong: false, lastTs: new Date(v.last_reviewed_at).getTime() }));
  }

  return pool
    .filter(({ v }) => v && (!language || v.language === language))
    .sort((a, b) => (b.wrong - a.wrong) || (b.lastTs - a.lastTs))
    .slice(0, cap)
    .map(({ v }) => ({ id: v.id, word_text: v.word_text, meaning: v.meaning ?? null }));
}
