// 담은 패턴(bk: 큐 행)의 문법 복습 문항 — [문장] 탭 패턴 ☆(patternSave)가 넣은 행을 /review/grammar가 낸다.
// 문항 모양은 세션이 이미 아는 「뜻 고르기」(meaning → cloze): 사전 예문에서 고정 글자를 비우고, 같은 급수 다른 문형의
// 고정 글자를 보기로 섞는다. 새 문항 유형 · 새 표 없음(rt: · drill: 분기와 같은 결).
import { exampleOf, parsePatternSlug, patternCells, patternLevelTag, patternListHref } from './sentencePattern.js';

// 콘텐츠 경로는 정적으로 적는다(번들러가 여섯 · 다섯 파일만 잡게).
const LOADERS = {
  Chinese: [
    () => import('../content/chinese/bunkei/h1.js'), () => import('../content/chinese/bunkei/h2.js'), () => import('../content/chinese/bunkei/h3.js'),
    () => import('../content/chinese/bunkei/h4.js'), () => import('../content/chinese/bunkei/h5.js'), () => import('../content/chinese/bunkei/h6.js'),
  ],
  Japanese: [
    () => import('../content/japanese/bunkei/n5.js'), () => import('../content/japanese/bunkei/n4.js'), () => import('../content/japanese/bunkei/n3.js'),
    () => import('../content/japanese/bunkei/n2.js'), () => import('../content/japanese/bunkei/n1.js'),
  ],
};

/** 문형 사전 → 평평한 항목 목록(레벨 · 공식 · 뜻 · 예문). 서버에서만 부른다(콘텐츠가 클라이언트 번들에 실리지 않게). */
export async function loadBunkeiEntries(lang) {
  const loaders = LOADERS[lang];
  if (!loaders) return [];
  const mods = await Promise.all(loaders.map((load) => load()));
  return mods.flatMap((mod) => {
    const data = mod?.default || mod;
    return (data?.themes || []).flatMap((theme) => (theme.items || []).map((item) => ({ ...item, level: data.level })));
  });
}

const fixedOf = (pattern) => patternCells(pattern).filter((c) => c.kind === 'fixed' && !c.optional);

/** 예문에서 첫 고정 글자를 비운다 — 못 찾으면 null(그 예문은 문항이 되지 않는다). */
export function blankExample(text, pattern) {
  for (const cell of fixedOf(pattern)) {
    for (const alt of cell.text.split(/[/・]/u).filter(Boolean)) {
      const at = text.indexOf(alt);
      if (at >= 0) return { prompt: `${text.slice(0, at)}＿＿${text.slice(at + alt.length)}`, answer: alt };
    }
  }
  return null;
}

/** 보기 — 같은 급수 다른 문형의 고정 글자 3개(정답과 겹치거나 서로 포함하는 것은 빼고, 사전 순서로 정답 다음부터 돈다). */
export function patternDistractors(entries, entry, answer, count = 3) {
  const same = entries.filter((e) => e.level === entry.level);
  const start = Math.max(0, same.findIndex((e) => e.pattern === entry.pattern));
  const out = [];
  for (let i = 1; i < same.length && out.length < count; i += 1) {
    const other = same[(start + i) % same.length];
    for (const cell of fixedOf(other.pattern)) {
      const alt = cell.text.split(/[/・]/u)[0];
      if (!alt || alt === answer || alt.includes(answer) || answer.includes(alt) || out.includes(alt)) continue;
      out.push(alt);
      break;
    }
  }
  return out;
}

/**
 * bk: 큐 행 → 세션 아이템. 사전에서 사라진 공식 · 문항을 못 만드는 항목은 null(건너뜀 — 챕터 행과 같다).
 * @param {{lang:string, slug:string}} row grammar_review 행
 * @param {Array<object>} entries loadBunkeiEntries(row.lang)
 */
export function buildPatternReviewItem(row, entries) {
  const key = parsePatternSlug(row?.slug);
  if (!key) return null;
  const entry = (entries || []).find((e) => e.level === key.level && e.pattern === key.pattern);
  if (!entry) return null;
  const meaning = [];
  for (const ex of [exampleOf(entry.ex), exampleOf(entry.ex2)].filter(Boolean)) {
    const blank = blankExample(ex.text, entry.pattern);
    if (!blank) continue;
    const distractors = patternDistractors(entries, entry, blank.answer);
    if (distractors.length < 2) continue;
    meaning.push({ sentence: blank.prompt, full: ex.text, ko: ex.ko, correct: blank.answer, distractors, pron: ex.reading || null });
  }
  if (!meaning.length) return null;
  const tag = patternLevelTag(entry.level);
  return {
    srs: {
      lang: row.lang, slug: row.slug, interval: row.interval, ease_factor: row.ease_factor,
      repetitions: row.repetitions, next_review_at: row.next_review_at,
    },
    lang: row.lang,
    langCode: row.lang === 'Japanese' ? 'ja' : 'zh',
    langName: '패턴',
    title: `${entry.pattern} · ${entry.ko}`,
    order: 0,
    level: tag || entry.level,
    href: patternListHref(entry),
    quiz: { meaning, apply: [], produce: [] },
  };
}

/** 예정 목록 한 줄 — 제목만(문항 조립 없이). */
export function patternUpcomingRow(row, entries) {
  const key = parsePatternSlug(row?.slug);
  const entry = key && (entries || []).find((e) => e.level === key.level && e.pattern === key.pattern);
  if (!entry) return null;
  return { langName: '패턴', level: patternLevelTag(entry.level) || entry.level, order: 0, title: `${entry.pattern} · ${entry.ko}`,
    href: patternListHref(entry), dueAt: row.next_review_at };
}
