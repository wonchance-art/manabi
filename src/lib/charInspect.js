// ④ 글자 탐색(오너 승인 2026-08-19) — 지정 단어의 한자를 하나씩 살펴본다.
// 데이터는 전부 기존 탑재분: 한자음 20,902자(간체·정체·신자체 커버 — 실측),
// 훈 8,700자(신자체 미수록 — 미등재는 조용히 생략, listHanjaHunEum 관례),
// 일본식 자형 2,890자. 병음은 카드가 이미 글자별로 갖고 있다(splitRuby).

import { hanjaHunEum } from './hanjaKo';

const HAN_RE = /\p{Script=Han}/u;

/** 탐색 대상 글자인가 — 한자만(가나·라틴·구두점은 탭 대상이 아니다). */
export function isInspectableChar(ch) {
  const s = String(ch || '');
  return [...s].length === 1 && HAN_RE.test(s);
}

/**
 * 글자 하나의 정보 — { hunEum, eum, ja }. 훈음('굳셀 강')이 있으면 그것이 대표,
 * 훈 미등재면 음만(eum), 일본식 자형은 상이할 때만(ja). 한자가 아니면 null.
 */
export function charDetail(ch, tables = {}) {
  if (!isInspectableChar(ch)) return null;
  const { koTable, hunTable, jaTable } = tables;
  const hunEum = koTable && hunTable ? hanjaHunEum(ch, koTable, hunTable) : null;
  const eum = !hunEum && koTable?.[ch] ? koTable[ch] : null;
  const jaForm = jaTable?.[ch];
  const ja = jaForm && jaForm !== ch ? jaForm : null;
  return { hunEum, eum, ja };
}

/**
 * 이 글자가 든 내 단어 — 같은 글자를 다른 단어에서 재인식하게 하는 앵커
 * (hanjaKo.js의 설계 철학과 동일). 같은 언어의 단어장 행에서 찾고, 지금 보고
 * 있는 단어는 제외, word_text 기준 중복 제거, 기본 6개 상한.
 */
export function wordsWithChar(ch, vocabRows, { language, excludeText, cap = 6 } = {}) {
  if (!isInspectableChar(ch)) return [];
  const out = [];
  const seen = new Set();
  for (const v of vocabRows || []) {
    if (language && v?.language !== language) continue;
    const w = v?.word_text || '';
    if (!w.includes(ch) || w === excludeText || seen.has(w)) continue;
    seen.add(w);
    out.push(v);
    if (out.length >= cap) break;
  }
  return out;
}
