/**
 * 다시 만난 말(STATS-MAP-001 · 오너 「ㅇㅋ 진행해」 2026-11-01 KST) — 복습한 담은 말이 그 뒤 다 읽은 글 · 대화에 다시 나온 수.
 * 자료 읽기 순환에서 비어 있던 「본문 귀환」 정거장의 첫 숫자. 새 기록 · 새 테이블 없이 이미 있는 기록에서 유도만 한다.
 *
 * 셈 규칙(목업 「셈 규칙」 표 그대로):
 * - 읽은 글 = 그 주에 다 읽은 글(reading_progress.completed_at — 이번 주 「완독」과 같은 출처) + 대화(대화 자료의 그 주 줄).
 * - 복습한 말 = 그 글을 다 읽은 때(대화는 그 줄이 붙은 때) **이전에** 한 번이라도 복습(review_events source 'vocab')한 담은 말.
 *   막 담은 말이 같은 글에서 바로 세지지 않는다.
 * - 같은 말 = 뷰어 대조 관용구(표면형 = word_text, 기본형 = base_form) — materialContentWords(내용어, 조사 · 기호 제외) 재사용.
 * - 큰 숫자 = 서로 다른 말 수(두 곳에 나와도 1). 「복습 N번」 = 그 말들을 처음 다시 만나기 전까지 복습한 횟수의 합.
 * 순수 모듈 — 조회는 remetRows.js.
 */
import { materialContentWords } from './materialFit';

/** 대화 토큰 id(`id_{줄}_{k}_{ts}` · `failed_{줄}_{ts}`)의 시각 — 줄이 붙은 때. 없으면 null. */
export function conversationTokenTime(tokenId) {
  const m = /_(\d{12,})$/.exec(String(tokenId || ''));
  return m ? Number(m[1]) : null;
}

/** 대화 자료에서 [sinceMs, untilMs) 사이에 붙은 줄의 내용어 — 단어마다 처음 나온 시각. */
export function conversationWordsBetween(processedJson, sinceMs, untilMs) {
  const dict = processedJson?.dictionary;
  const sequence = processedJson?.sequence;
  if (!dict || !Array.isArray(sequence)) return [];
  const picked = [];
  for (const id of sequence) {
    const at = conversationTokenTime(id);
    if (at == null || at < sinceMs || at >= untilMs) continue;
    picked.push({ id, at });
  }
  if (!picked.length) return [];
  const words = materialContentWords({ dictionary: dict, sequence: picked.map(p => p.id) });
  // materialContentWords는 첫 등장 순서 · 타입당 하나 — 그 첫 등장 시각을 붙인다.
  const firstAt = new Map();
  for (const { id, at } of picked) {
    const t = dict[id];
    const key = t?.base_form || t?.text;
    if (key && !firstAt.has(key)) firstAt.set(key, at);
  }
  return words.map(w => ({ ...w, at: firstAt.get(w.key) }));
}

/** 담은 말 대조표 — 표면형 · 기본형 → 담은 말 행(뷰어 isSaved 관용구). */
function savedIndex(vocabRows) {
  const surfaces = new Map();
  const bases = new Map();
  for (const row of vocabRows || []) {
    if (!row?.word_text) continue;
    if (!surfaces.has(row.word_text)) surfaces.set(row.word_text, row);
    if (row.base_form && !bases.has(row.base_form)) bases.set(row.base_form, row);
  }
  return word => (word.text && surfaces.get(word.text)) || (word.base_form && (bases.get(word.base_form) || surfaces.get(word.base_form))) || null;
}

/** 담은 말(word_text)별 복습 시각 오름차순. */
function reviewTimes(reviewRows) {
  const byWord = new Map();
  for (const e of reviewRows || []) {
    const t = Date.parse(e?.created_at);
    if (!e?.item_key || !Number.isFinite(t)) continue;
    if (!byWord.has(e.item_key)) byWord.set(e.item_key, []);
    byWord.get(e.item_key).push(t);
  }
  for (const list of byWord.values()) list.sort((a, b) => a - b);
  return byWord;
}

const before = (times, at) => {
  let n = 0;
  for (const t of times || []) { if (t < at) n += 1; else break; }
  return n;
};

/**
 * 한 주의 다시 만난 말.
 * @param {object} p
 * @param {Array<{kind:'reading'|'conversation', id, title, words:Array<{key,text,base_form,at}>}>} p.sources - 그 주 글 · 대화(단어마다 만난 시각)
 * @param {Array<{word_text, base_form}>} p.vocabRows - 담은 말
 * @param {Array<{item_key, created_at}>} p.reviewRows - 담은 말 복습(source 'vocab')
 * @returns {{ total, reading, conversation, reviews, sources: Array<{kind,id,title,words:string[]}> }}
 */
export function buildRemet({ sources = [], vocabRows = [], reviewRows = [] } = {}) {
  const match = savedIndex(vocabRows);
  const reviews = reviewTimes(reviewRows);
  const firstMet = new Map(); // 담은 말 → 그 주에 처음 다시 만난 시각
  const out = [];
  for (const source of sources) {
    const words = [];
    const seen = new Set();
    for (const word of source.words || []) {
      const row = match(word);
      if (!row || seen.has(row.word_text)) continue;
      if (before(reviews.get(row.word_text), word.at) < 1) continue; // 그 전에 복습한 적 없는 말은 세지 않는다
      seen.add(row.word_text);
      words.push(row.word_text);
      const prev = firstMet.get(row.word_text);
      if (prev == null || word.at < prev) firstMet.set(row.word_text, word.at);
    }
    if (words.length) out.push({ kind: source.kind, id: source.id, title: source.title || '', words });
  }
  out.sort((a, b) => b.words.length - a.words.length);
  let reviewCount = 0;
  for (const [word, at] of firstMet) reviewCount += before(reviews.get(word), at);
  return {
    total: firstMet.size,
    reading: out.filter(s => s.kind === 'reading').length,
    conversation: out.filter(s => s.kind === 'conversation').length,
    reviews: reviewCount,
    sources: out,
  };
}
