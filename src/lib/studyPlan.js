'use client';

/**
 * 학습 계획표 — 순수 로직 (v2-D R1, #1077 설계 §1).
 *
 * ── 삼중 진실 문제
 *
 * 계획표가 정본의 **손복사본**이었다. `StudyPlanPanel`의 PLAN 상수에 중국어 119·프랑스어
 * 104 항목이 하드코딩돼 있었는데, 항목이 `[1, '한어병음']` 꼴이라 **slug가 없어 정본과
 * 대조조차 안 됐다**. 실측하면 정본은 중국어 79·프랑스어 87챕터다 — 이미 어긋나 있었고,
 * 정본이 개편될 때마다 더 벌어질 수밖에 없는 구조였다.
 *
 * 진도도 따로 놀았다. 실제 학습 진도는 `user_ref_progress`(읽음·통과)에 쌓이는데,
 * 계획표는 별도의 수동 체크(localStorage + study_plan_progress)를 세고 있었다. 손으로
 * 누른 체크는 실제로 읽었는지와 무관하다 — 표가 학습을 반영하지 못한다.
 *
 * ── 해법: 계획은 정본에서 유도하고, 진도는 서버 한 곳에서만 읽는다
 *
 * 그러면 계획표가 곧 진도표가 되고, 정본 챕터가 개편되면 표가 저절로 따라온다.
 * 이 파일은 그 유도·대조만 맡는다(조회·렌더는 호출자 몫).
 */
import { normalizeSlug } from './world/storageSchema.js';

/** 진도 판정 — 통과가 우선, 확인 문제를 안 봤으면 읽음으로(설계 §4 계약 3). */
export function isChapterDone(row) {
  if (!row) return false;
  return !!(row.passed ?? row.read);
}

/**
 * 정본 manifest에서 한 언어의 계획을 유도한다.
 *
 * `upto`는 목표 레벨(HSK5·B2처럼 거기까지가 계획)이다. R2에서 `profiles.goal_level`이
 * 생기면 그 값이 그대로 여기로 들어온다 — 그때 바뀌는 건 인자의 출처뿐이다.
 *
 * @param {object} manifest REF_GRAMMAR_MANIFEST
 * @param {string} lang 'Chinese' | 'French' | 'Japanese' | 'English'
 * @param {{upto?: string}} [opts] upto: 마지막으로 포함할 레벨 키(없거나 못 찾으면 전부)
 * @returns {object|null} 언어가 없으면 null
 */
export function buildPlan(manifest, lang, { upto } = {}) {
  const L = manifest?.languages?.[lang];
  if (!L || !Array.isArray(L.levels)) return null;
  const labelOf = new Map((L.levelMeta || []).map((m) => [m.key, m.label || m.key]));

  const cut = L.levels.findIndex((lv) => lv.key === upto);
  const inScope = cut >= 0 ? L.levels.slice(0, cut + 1) : L.levels;

  let seq = 0;
  const levels = inScope
    // 챕터가 없는 레벨은 계획에 서지 않는다(중국어 LIFE = 생활 어휘 전용). 진도의 단위가
    // 챕터라 0/0 칸이 되고, 어휘 축은 R3에서 따로 합류한다.
    .filter((lv) => (lv.chapters || []).length > 0)
    .map((lv) => ({
      key: lv.key,
      label: labelOf.get(lv.key) || lv.key,
      vocabCount: lv.vocabCount || 0,
      // 문형은 레벨 단위 화면(/bunkei/<레벨>)이라 패턴 수만 센다 — 챕터처럼 slug별 진도가
      // 아니다. manifest의 이 배열은 패턴마다 소속 챕터 slug를 담아 중복이 있다.
      bunkeiCount: (lv.bunkeiChapterSlugs || []).length,
      bunkeiHref: lv.bunkeiAvailable ? `${L.base}/bunkei/${lv.key}` : null,
      vocabHref: lv.vocabCount ? `${L.base}/vocab/${lv.key}` : null,
      chapters: (lv.chapters || []).map((c) => ({
        slug: c.slug,
        // 레벨 안 순서(order)와 별개로 계획 전체를 관통하는 번호 — "다음 #37"이 성립한다.
        seq: (seq += 1),
        order: c.order,
        title: c.title,
        topic: c.topic || c.title,
        href: `${L.base}/grammar/${c.slug}`,
      })),
    }));

  return {
    lang,
    langCode: L.langCode,
    flag: L.flag,
    name: L.name,
    base: L.base,
    levels,
    totalChapters: seq,
  };
}

/**
 * 계획에 서버 진도를 겹친다.
 * rows는 `user_ref_progress` 행. 계획에 없는 slug는 그냥 무시되므로 독해 트랙의
 * 'rt:' 행이 섞여 들어와도 완주율이 오염되지 않는다(같은 테이블을 쓰는 구조).
 * @param {object} plan buildPlan 산출
 * @param {Array} rows [{ lang, slug, read, passed }]
 */
export function markProgress(plan, rows) {
  if (!plan) return null;
  const byslug = new Map();
  for (const r of rows || []) {
    if (!r?.slug) continue;
    if (r.lang && r.lang !== plan.lang) continue;   // 남의 언어 진도를 세지 않는다
    // 챕터 slug rename은 별칭으로 이어져 있다(storageSchema.slugAliases) — 정규화하지
    // 않으면 옛 slug로 남은 진도가 통째로 사라진다. 옛·새 행이 둘 다 있으면 '한 쪽이라도
    // 했으면 했다'로 합친다(먼저 온 행이 이기는 실수 방지).
    const key = normalizeSlug(r.slug);
    const prev = byslug.get(key);
    if (!prev || (!isChapterDone(prev) && isChapterDone(r))) byslug.set(key, r);
  }

  let done = 0;
  let next = null;
  const levels = plan.levels.map((lv) => {
    let lvDone = 0;
    const chapters = lv.chapters.map((c) => {
      const isDone = isChapterDone(byslug.get(c.slug));
      if (isDone) { done += 1; lvDone += 1; }
      else if (!next) next = c;                      // 본문 순서대로 첫 미완이 '다음'
      return { ...c, done: isDone };
    });
    return { ...lv, chapters, done: lvDone, total: chapters.length };
  });

  const total = plan.totalChapters;
  return {
    ...plan,
    levels,
    done,
    total,
    remaining: Math.max(0, total - done),
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
    next,
  };
}
