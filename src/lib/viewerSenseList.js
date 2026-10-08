// 단어창 사전 뜻 목록(VIEWER-V2-ROUNDS-001 §2.1 B안 · AE-R1 설계서 §3.2) — 순수 함수.
// 재료는 이미 카드에 온다: morpheme_dictionary.meanings(≤3, 뜻별 pos)와 refVocab(ko·pos·ex).
// 같은 뜻은 정규화 비교로 합친다 — 지금 카드가 「웅장하다, 장관이다」(토큰 뜻)와
// 「장관이다, 웅장하다」(refVocab)를 문자열 완전 일치로 비교해 「사전의 다른 뜻」으로 다는 결함
// (referenceMatchesContext, 설계서 §3.1 실측)을 이 규칙이 고친다. 그 함수의 기존 계약(병음이
// 다르면 다른 뜻)은 그대로 두고, 여기서도 병음이 다른 refVocab 뜻은 합치지도 칠하지도 않는다.
// 사전 뜻끼리의 중복 제거는 buildMeaningOptions(교정 후보)와 같은 트림·완전 일치 규칙이다 —
// 목록의 줄과 교정 후보가 어긋나지 않아야 PR ③의 「줄을 누르면 이 자리 뜻으로 교정」이 성립한다.
// PR ①에서는 화면에 연결하지 않는다.

import { splitPosParts } from './server/posCanon.js';
import { contextualMeaning } from './viewerReliability.js';

/**
 * 뜻 정규화 — NFC → 괄호 보충 (…)·（…） 제거 → , ; 、 ， / ； 로 나눈 조각 집합(공백 정리·소문자).
 * 집합이 같아야 같은 뜻이다. 부분 겹침은 다른 뜻이다(오합 방지).
 * @returns {string[]} 정렬한 조각 배열(빈 뜻이면 [])
 */
export function senseKey(meaning) {
  const text = String(meaning ?? '').normalize('NFC')
    .replace(/\([^()]*\)|（[^（）]*）/gu, ' ');
  const pieces = text.split(/[,;、，/；]/u)
    .map((piece) => piece.replace(/\s+/gu, ' ').trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(pieces)].sort();
}

/** 두 뜻이 정규화 집합으로 같은가. 빈 뜻은 무엇과도 같지 않다. */
export function sameSense(a, b) {
  const x = senseKey(a), y = senseKey(b);
  return x.length > 0 && x.length === y.length && x.every((piece, i) => piece === y[i]);
}

const normalizeReading = (value) => String(value ?? '').normalize('NFC').replace(/\s/gu, '').toLowerCase();

/**
 * 사전 뜻 목록.
 * @param {{dictEntry?:{meanings?:Array<{meaning:string,pos?:string}>, pos?:string}|null,
 *          refWord?:{ko?:string,pos?:string,pinyin?:string,ex?:{zh?:string,pinyin?:string,ko?:string}}|null,
 *          token?:{meaning?:string,furigana?:string,reading?:string}|null,
 *          language?:string, reading?:string|null}} input
 *   reading = 표제어 읽기(기본형이면 사전 reading). 없으면 토큰 읽기. refVocab 병음과 비교한다.
 * @returns {Array<{pos:string|null, items:Array<{n:number, meaning:string, pos:string|null,
 *   current:boolean, source:'dict'|'ref'|'dict+ref', example?:object}>}>}
 *   품사 묶음 순서 = 처음 나온 순서, 번호 n은 묶음을 넘어 이어 센다. 이 문장 뜻(토큰 뜻)과 같은 줄이
 *   current(최대 1줄 — 완전 일치 우선, 없으면 첫 정규화 일치). 예문은 그 뜻 줄의 example.
 */
export function buildSenseList({ dictEntry = null, refWord = null, token = null, language, reading } = {}) {
  if (language === 'Korean') return [];
  const rowPos = splitPosParts(dictEntry?.pos)[0] || null;
  const items = [];
  const seen = new Set();
  // ① 사전 뜻 — buildMeaningOptions와 같은 트림·완전 일치 중복 제거
  for (const m of Array.isArray(dictEntry?.meanings) ? dictEntry.meanings : []) {
    const meaning = String(m?.meaning || '').trim();
    if (!meaning || seen.has(meaning)) continue;
    seen.add(meaning);
    const pos = (m?.pos ? String(m.pos).trim() : '') || rowPos;
    items.push({ meaning, pos, source: 'dict' });
  }
  // ② refVocab — 정규화가 같은 사전 뜻에 예문을 붙이고, 없으면 refVocab 품사 묶음 끝에 한 줄
  const refMeaning = String(refWord?.ko || '').trim();
  const headReading = reading ?? token?.furigana ?? token?.reading ?? null;
  const refReadingOk = !refWord?.pinyin || !headReading
    || normalizeReading(refWord.pinyin) === normalizeReading(headReading);
  const example = refWord?.ex?.zh ? refWord.ex : null;
  if (refMeaning) {
    const twin = refReadingOk ? items.find((item) => item.source === 'dict' && sameSense(item.meaning, refMeaning)) : null;
    if (twin) {
      twin.source = 'dict+ref';
      if (example) twin.example = example;
    } else {
      const pos = splitPosParts(refWord?.pos)[0] || rowPos;
      items.push({ meaning: refMeaning, pos, source: 'ref', ...(example ? { example } : {}), ...(refReadingOk ? {} : { otherReading: true }) });
    }
  }
  // ③ 이 문장 뜻 = 칠한 줄(병음이 다른 refVocab 뜻은 칠하지 않는다)
  const contextual = contextualMeaning(token).trim();
  if (contextual) {
    const eligible = items.filter((item) => !item.otherReading);
    const hit = eligible.find((item) => item.meaning === contextual)
      || eligible.find((item) => sameSense(item.meaning, contextual));
    if (hit) hit.current = true;
  }
  // ④ 품사 묶음 + 이어 세는 번호
  const groups = [];
  for (const item of items) {
    let group = groups.find((g) => g.pos === item.pos);
    if (!group) { group = { pos: item.pos, items: [] }; groups.push(group); }
    group.items.push(item);
  }
  let n = 0;
  return groups.map((group) => ({
    pos: group.pos,
    items: group.items.map(({ otherReading, ...item }) => ({ n: ++n, ...item, current: item.current === true })),
  }));
}

/** 목록의 줄 수 — 「사전 뜻 · {n}개」 머리용. */
export function senseListCount(groups) {
  return (groups || []).reduce((sum, group) => sum + (group.items?.length || 0), 0);
}
