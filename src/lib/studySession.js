/**
 * 공부 모드 세션 조립기 — 듀오링고(경로·세션) + Anki(FSRS) 하이브리드.
 * 서버가 조회한 재료(due 어휘·due 문법·다음 챕터·독해 예문)를 받아
 * ~10문항짜리 인터리브 세션 payload를 만든다. 순수 함수 — 셔플 없음(렌더 몫).
 *
 * 문항 타입:
 *  vocab-choice   단어→뜻 4지선다        vocab-typing  뜻→단어 입력
 *  vocab-listening TTS→단어 입력          grammar-cloze 예문 빈칸(refQuiz.meaning)
 *  grammar-order  어순 배열(refQuiz.apply) read-meaning 예문→뜻 4지선다
 *  teach          새 패턴 티칭 카드(문항 아님·집계 제외)
 */

import { vocabTypeForRung } from './skillRung';

const MAX_ITEMS = 10; // 예산제 하드캡 (기획 H3)

/**
 * 뜻 문자열에서 원어 병기 괄호 제거 — 보기 텍스트 정화.
 * user_vocabulary.meaning에 "일하다 (働く)"처럼 원어(가나·한자·라틴)를 병기해 저장한 데이터가
 * 4지선다 보기에 그대로 나오면 정답이 시각적으로 새므로, 사용 시점에 정리한다.
 * 판정: 괄호(반각 `()`·전각 `（）`) 안에 한글이 하나라도 있으면 보존("달리다 (과거형)"),
 *       없고 가나/한자/라틴문자가 있으면 원어 병기로 보고 괄호째 제거. 그 외(숫자·기호)는 보존.
 * 순수 함수·멱등. 남은 공백은 정리해 trim.
 */
const MEANING_HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
const MEANING_SOURCE_SCRIPT = /[ぁ-ゟゔァ-ヿーｦ-ﾟ々〆〤ヶ一-鿿a-zA-Z]/; // 가나·장음·반각가나·한자·라틴
export function stripSourceLangInMeaning(meaning) {
  if (typeof meaning !== 'string' || !meaning) return meaning;
  const out = meaning.replace(/\s*[（(]\s*([^（()）]*?)\s*[)）]/g, (m, inner) => {
    if (MEANING_HANGUL.test(inner)) return m;          // 한글 설명 괄호 → 보존
    if (MEANING_SOURCE_SCRIPT.test(inner)) return '';  // 원어(가나·한자·라틴)만 → 제거
    return m;                                          // 숫자·기호 등 → 보존
  });
  return out.replace(/\s{2,}/g, ' ').trim();
}

/** 타이핑 판정용 정규화 — 공백·구두점 제거, 소문자화 */
export function normalizeAnswer(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[。、．，.,!?！？'’\-–]/g, '');
}

/** 어휘 타이핑 정답 판정 — 표기 또는 발음(후리가나) 일치 */
export function gradeTyping(input, word) {
  const n = normalizeAnswer(input);
  if (!n) return false;
  return n === normalizeAnswer(word.word_text) || (!!word.furigana && n === normalizeAnswer(word.furigana));
}

/** 보기 채우기 — 정답 제외 중복 없는 오답 n개 */
function pickDistractors(pool, correct, n) {
  const seen = new Set([correct]);
  const out = [];
  for (const p of pool) {
    if (!p || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
    if (out.length >= n) break;
  }
  return out;
}

let uidSeq = 0;
const uid = prefix => `${prefix}-${++uidSeq}`;

/** 어휘 due → 문항 (rung + 다이얼로 타입 배정, 인덱스 로테이션 폐기) */
function buildVocabItems(vocab, meaningPool, vocabRungs = {}, dial = 'normal') {
  const cleanPool = (meaningPool || []).map(stripSourceLangInMeaning);
  return (vocab || []).slice(0, 3).map(w => {
    const meaning = stripSourceLangInMeaning(w.meaning); // 보기·정답·채점 기준을 정화된 값으로 통일
    let type = vocabTypeForRung(vocabRungs[w.word_text] ?? 1, dial);
    let options = null;
    if (type === 'vocab-choice') {
      const distractors = pickDistractors(cleanPool, meaning, 3);
      if (distractors.length < 2) type = 'vocab-typing';   // 보기 부족 → 타이핑으로
      else options = [meaning, ...distractors];
    }
    return {
      uid: uid('v'),
      type,
      word: { ...w, meaning },
      options,
      effect: { kind: 'vocab', wordId: w.id },
    };
  });
}

/** 문법 due 챕터 → 문항 (챕터당 최대 perChapter개, 전체 max개) */
function buildGrammarDueItems(grammarDue, { max = 2, perChapter = 2 } = {}) {
  const out = [];
  for (const g of grammarDue || []) {
    let n = 0;
    for (const q of g.items || []) {
      if (out.length >= max || n >= perChapter) break;
      out.push({
        uid: uid('g'),
        type: q.tokens ? 'grammar-order' : 'grammar-cloze',
        quiz: q,
        chapter: g.meta,
        effect: { kind: 'grammar-due', srs: g.srs },
      });
      n++;
    }
    if (out.length >= max) break;
  }
  return out;
}

/** 새 챕터 → 티칭 카드 + 문항 (최대 max개) */
function buildNewChapterItems(newChapter, max = 3) {
  if (!newChapter) return { teach: null, items: [] };
  const teach = newChapter.teach
    ? { uid: uid('t'), type: 'teach', chapter: newChapter.meta, ...newChapter.teach }
    : null;
  const items = (newChapter.items || []).slice(0, max).map(q => ({
    uid: uid('n'),
    type: q.tokens ? 'grammar-order' : 'grammar-cloze',
    quiz: q,
    chapter: newChapter.meta,
    effect: { kind: 'new-chapter', meta: newChapter.meta },
  }));
  return { teach, items };
}

/** 독해 — 예문→뜻 고르기 */
function buildReadingItems(reading, koPool, max) {
  const out = [];
  for (const r of reading || []) {
    if (out.length >= max) break;
    if (!r?.main || !r?.ko) continue;
    const distractors = pickDistractors(koPool || [], r.ko, 3);
    if (distractors.length < 2) continue;
    out.push({
      uid: uid('r'),
      type: 'read-meaning',
      sentence: { main: r.main, pron: r.pron || null },
      options: [r.ko, ...distractors],
      correct: r.ko,
      effect: { kind: 'reading', key: r.main },
    });
  }
  return out;
}

/**
 * 세션 조립 — 인터리브 배치.
 * 레시피: [티칭, 신규1, 어휘, 신규2, 문법due, 어휘, 신규3, 독해, 문법due, 어휘, 독해…]
 * @param {Object} p
 * @param {Object<string, number>} [p.vocabRungs] - word_text → rung(0~4). 어휘 문항 타입 배정에 사용.
 * @param {'easy'|'normal'|'hard'} [p.dial] - EWMA 난이도 다이얼.
 * @returns {{items: Array, gradedCount: number, newChapter: Object|null}}
 */
export function composeSession({ vocab, meaningPool, grammarDue, newChapter, reading, koPool, vocabRungs = {}, dial = 'normal' }) {
  const vocabItems = buildVocabItems(vocab, meaningPool, vocabRungs, dial);
  const dueItems = buildGrammarDueItems(grammarDue);
  // dial 'easy' — 신규 0(재조정 부담 방지). 슬롯은 독해로 채운다.
  // dial 'hard' — 신규 비중↑(상한 3→4). 예산은 독해 슬롯이 자동 상쇄(MAX_ITEMS - baseCount).
  const { teach, items: newItems } = dial === 'easy'
    ? { teach: null, items: [] }
    : buildNewChapterItems(newChapter, dial === 'hard' ? 4 : 3);

  // 목표 문항 수까지 독해로 채움 (티칭 카드는 집계 제외)
  const baseCount = vocabItems.length + dueItems.length + newItems.length;
  const readingItems = buildReadingItems(reading, koPool, Math.max(1, MAX_ITEMS - baseCount));

  // 인터리브 — 신규를 앞쪽에(가르친 직후 확인), 복습·독해를 사이사이에
  const lanes = [
    newItems[0], vocabItems[0], newItems[1], dueItems[0],
    vocabItems[1], newItems[2], readingItems[0], dueItems[1],
    vocabItems[2], newItems[3], ...readingItems.slice(1),
  ].filter(Boolean);

  const items = [];
  if (teach) items.push(teach);
  for (const it of lanes) {
    if (items.filter(i => i.type !== 'teach').length >= MAX_ITEMS) break;
    items.push(it);
  }

  return {
    items,
    gradedCount: items.filter(i => i.type !== 'teach').length,
    newChapter: newChapter?.meta || null,
  };
}

/** 신규 챕터 통과 판정 — 3문항 기준 2개 이상 (문항이 적으면 2/3 비율) */
export function isChapterPassed(right, total) {
  if (!total) return false;
  return right >= Math.ceil(total * (2 / 3));
}

/** 세션 문항 타입 → review_events qtype (약점 진단 축). 채점 문항이 아니면 null */
export function qtypeForItem(type) {
  switch (type) {
    case 'vocab-choice': return 'choice';
    case 'vocab-typing': return 'typing';
    case 'vocab-listening': return 'listening';
    case 'grammar-cloze': return 'cloze';
    case 'grammar-order': return 'order';
    case 'read-meaning': return 'read';
    default: return null;
  }
}

/**
 * 워밍업 문항 — AI 문단 생성 레이턴시를 가리는 즉시 시작용 인지형(vocab-choice) 2문항.
 * 최근(24~72h) 헷갈린(오답) 어휘를 우선 조기 복습하고, 부족분만 정답 어휘로 채우되,
 * 비예정 조기 복습이라 FSRS를 왜곡하지 않도록 effect.kind는 'warmup'으로 두어
 * 이벤트만 적재하고 user_vocabulary(SRS)는 절대 갱신하지 않는다.
 * 순수 함수 — 재료 조회는 호출자(studyMaterials)가 맡는다.
 * @param {Array} recentEvents - review_events (created_at desc). {source,item_key,correct,created_at}
 * @param {Array} vocabRows - 후보 단어의 user_vocabulary 행 {word_text,meaning,furigana}
 * @param {Array} meaningPool - 보기 오답 풀(뜻 문자열)
 * @param {Set<string>} dueSet - due 어휘 word_text (중복 제외)
 * @param {Array} fallbackWords - 콜드스타트 폴백 단어 [{word_text,meaning,furigana}]
 * @returns {Array} 워밍업 문항 (최대 2, 보기 부족 시 그보다 적을 수 있음)
 */
export function buildWarmupItems(recentEvents, vocabRows, meaningPool = [], dueSet = new Set(), fallbackWords = []) {
  const now = Date.now();
  const lo = now - 72 * 3600 * 1000;   // 72h 전
  const hi = now - 24 * 3600 * 1000;   // 24h 전
  const rowByWord = new Map((vocabRows || []).map(r => [r.word_text, r]));
  const chosen = [];
  const seen = new Set();
  // 24~72h 어휘 이벤트를 최신순으로 훑어 최대 2개 — wantCorrect로 오답/정답 패스를 나눈다.
  const collect = wantCorrect => {
    for (const e of recentEvents || []) {
      if (chosen.length >= 2) break;
      if (!e || e.source !== 'vocab' || !e.item_key) continue;
      if (!!e.correct !== wantCorrect) continue;
      const t = new Date(e.created_at).getTime();
      if (!(t >= lo && t <= hi)) continue;
      const word = e.item_key;
      if (seen.has(word) || (dueSet && dueSet.has(word))) continue;
      const row = rowByWord.get(word);
      if (!row || !row.meaning) continue;
      seen.add(word);
      chosen.push(row);
    }
  };
  // 오답(헷갈린 것) 최신순 우선 → 부족하면 정답 최신순으로 채운다.
  collect(false);
  collect(true);
  // 콜드스타트 폴백 — 해당 이력이 없으면 레벨 사전 단어로 채운다
  if (chosen.length === 0) {
    for (const w of fallbackWords || []) {
      if (chosen.length >= 2) break;
      if (!w || !w.word_text || !w.meaning) continue;
      if (seen.has(w.word_text) || (dueSet && dueSet.has(w.word_text))) continue;
      seen.add(w.word_text);
      chosen.push(w);
    }
  }
  // 인지형(뜻 고르기) 문항으로 — 보기 오답 2개 미만이면 제외
  const cleanPool = (meaningPool || []).map(stripSourceLangInMeaning);
  return chosen.map(row => {
    const meaning = stripSourceLangInMeaning(row.meaning); // 보기·정답·채점 기준 통일
    const distractors = pickDistractors(cleanPool, meaning, 3);
    if (distractors.length < 2) return null;
    return {
      uid: uid('w'),
      type: 'vocab-choice',
      word: { word_text: row.word_text, meaning, furigana: row.furigana || null },
      options: [meaning, ...distractors],
      warmup: true,
      effect: { kind: 'warmup', key: row.word_text },
    };
  }).filter(Boolean);
}

/**
 * 문법 due 챕터별 문항 수 집계 → { slug: count }.
 * settle 시점에 "이 챕터의 마지막 문항"을 판정해 챕터 정답률로 재스케줄하기 위한 것.
 * 재출제(-r) 문항은 첫 시도가 아니므로 호출자가 제외해 넘긴다.
 */
export function grammarDueChapterCounts(items) {
  const counts = {};
  for (const it of items || []) {
    if (it?.effect?.kind === 'grammar-due' && it.effect.srs?.slug) {
      const slug = it.effect.srs.slug;
      counts[slug] = (counts[slug] || 0) + 1;
    }
  }
  return counts;
}
