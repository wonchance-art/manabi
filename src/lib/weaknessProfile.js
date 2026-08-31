/**
 * 약점 프로파일 — 이벤트[] → 약한 축 상위 N (v2-A R1, #1077 설계 §2).
 *
 * ── 왜 유형 단위인가
 *
 * 단어 단위 약점은 이미 있다(`confusedQueue` — 14일·오답 가중·최소 표본 2). 없던 건
 * **유형 단위**다: "이 단어를 자꾸 틀린다"는 아는데 "듣고 쓰기에서만 무너진다"는
 * 아무 데서도 말해 주지 않았다. 앞의 것은 단어를 더 외우게 하고, 뒤의 것은 **연습 방식**을
 * 바꾸게 한다 — 처방이 달라진다.
 *
 * ── 점수는 새로 만들지 않는다
 *
 * 집계는 `skillRung.computeWeakness` **정본만** 쓴다. 이벤트를 태그 축으로 투영해
 * 넘기면 점수식((wrong/total)·ln(total+1))도 최소 표본(total≥2)도 정본 그대로다.
 * 여기서 따로 세면 "헷갈린 단어"와 "약한 유형"이 서로 다른 헷갈림을 말하게 된다
 * (confusedQueue가 신규 카운터를 금지한 것과 같은 이유).
 *
 * 조회는 소비 화면 몫이다(weeklyReport·goalPace 관례). 이 모듈은 서버를 모른다.
 */

import { computeWeakness } from './skillRung';
import { errorTags, isWeaknessEvent, splitTag, tagLabel } from './errorTags';

/** 집계 창 — 헷갈린 단어 큐와 같은 14일(두 화면이 같은 '헷갈림'을 말해야 한다). */
export const WEAKNESS_SINCE_DAYS = 14;
/** 상위 몇 축까지 — 화면은 보통 1~3줄만 쓴다. */
export const WEAKNESS_CAP = 8;

/**
 * 약한 축 상위 N.
 *
 * @param {Array} events review_events 행들
 * @param {object} [opts]
 * @param {(itemKey: string) => (string|null)} [opts.chapterOf] 문법 item_key → 챕터 slug
 * @param {number} [opts.sinceMs] 이 시각 이후만 (기본: 14일)
 * @param {number} [opts.cap]
 * @param {number} [opts.now]
 * @returns {Array<{tag, wrong, total, score}>} score 내림차순 — 오답이 있는 축만
 */
export function weaknessProfile(events, {
  chapterOf, sinceMs, cap = WEAKNESS_CAP, now = Date.now(),
} = {}) {
  const since = sinceMs ?? now - WEAKNESS_SINCE_DAYS * 86400000;

  // 한 이벤트가 축 둘(회상 방식·문법 챕터)에 동시에 든다 — 축마다 그 축이 붙은
  // 이벤트만 분모가 되므로 축별 비율은 정확하다.
  const projected = [];
  for (const e of events || []) {
    if (!isWeaknessEvent(e)) continue;
    for (const tag of errorTags(e, { chapterOf })) {
      projected.push({ source: 'tag', item_key: tag, correct: e.correct, created_at: e.created_at });
    }
  }

  return computeWeakness(projected, { sinceMs: since, cap })
    // 한 번도 안 틀린 축은 약점이 아니다 — 점수 0이 목록 꼬리에 남으면 "약한 곳"이 거짓말이 된다.
    .filter((w) => w.wrong > 0)
    .map(({ item_key: tag, wrong, total, score }) => ({ tag, wrong, total, score }));
}

/**
 * 화면이 말할 수 있는 축 중 1위.
 *
 * 라벨을 못 내는 축(챕터 제목을 모르는 화면의 `pattern:`)은 건너뛴다 — 사용자에게
 * `pattern:ba-sentence 6/9`는 아무 말도 아니다. 말할 수 있는 것만 말한다.
 *
 * @returns {{tag, label, wrong, total}|null} 표본이 없으면 null(§3 P3 — 미달이면 침묵)
 */
export function topLabeledWeakness(profile, labelOpts) {
  for (const w of profile || []) {
    const label = tagLabel(w.tag, labelOpts);
    if (label) return { tag: w.tag, label, wrong: w.wrong, total: w.total };
  }
  return null;
}

/**
 * 약한 문법 챕터 slug 집합 (v2-A → v2-G 결합점).
 *
 * 뷰어의 '약한 것' 필터가 쓰는 축. 여기(v2-A)가 정본을 갖고 문형 쪽(patternIndex)은
 * **집합을 받아 쓰기만** 한다 — 스캔 층이 오답 이벤트를 알기 시작하면 두 축의 정본이 갈린다.
 *
 * 상한을 걸지 않는다(cap 0): 본문에 어느 챕터가 나올지 모르므로 "상위 8개"로 잘라 두면
 * 9번째로 약한 문법이 눈앞에 있어도 밑줄이 안 붙는다. 14일 창에 챕터 약점이 수십을
 * 넘지 않아 값이 싸다.
 *
 * **드릴 약점은 해석기를 줘야 잡힌다.** 문법 이벤트의 item_key는 챕터 slug일 수도
 * 드릴 id일 수도 있는데, 드릴 id를 챕터로 되돌리려면 챕터 레지스트리(6MB)가 필요하다.
 * 뷰어는 그걸 안 든다 — 챕터 단위 복습에서 나온 약점만 잡고 드릴분은 조용히 빠진다.
 * 놓치는 쪽이 안전한 방향이다(없는 밑줄 < 엉뚱한 밑줄).
 *
 * @returns {Set<string>} 챕터 slug
 */
export function weakChapterSet(events, opts = {}) {
  const weak = new Set();
  for (const w of weaknessProfile(events, { ...opts, cap: 0 })) {
    const parts = splitTag(w.tag);
    if (parts?.axis === 'pattern') weak.add(parts.value);
  }
  return weak;
}

/**
 * "듣고 쓰기 9번 중 6번 틀림" — 리포트 한 줄의 문구(설계 §3.1).
 * 설계 초안의 "6/9 실패"에서 고쳤다: 이 카드는 **거울이지 성적표가 아니라서**
 * (WeeklyReportCard 규약) 분수와 "실패"가 채점표처럼 읽힌다. 같은 수를 말로 편다.
 */
export function weaknessLine(top) {
  if (!top) return null;
  return `${top.label} ${top.total}번 중 ${top.wrong}번 틀림`;
}
