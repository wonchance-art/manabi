// ④ 글자 탐색(오너 승인 2026-08-19) — 지정 단어의 한자를 하나씩 살펴본다.
// 데이터는 전부 기존 탑재분: 한자음 20,902자(간체·정체·신자체 커버 — 실측),
// 훈 8,700자(신자체 미수록 — 미등재는 조용히 생략, listHanjaHunEum 관례),
// 일본식 자형 2,890자. 병음은 카드가 이미 글자별로 갖고 있다(splitRuby).
// 증강 R1~R3(오너 승인 2026-08-28): 자원 블록(charEtym — hanjaEtym.json: 획수·부수·
// 1단 분해·간번체)과 자료 재등장 스캔(materialWordsWithChar — 신규 데이터 0)을 더한다.

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

// 성분·부수의 라벨 — 훈음('마음 심')이 대표, 훈 미등재면 음만(charDetail과 같은 관례).
function charLabel(ch, koTable, hunTable) {
  const hunEum = koTable && hunTable ? hanjaHunEum(ch, koTable, hunTable) : null;
  return hunEum || koTable?.[ch] || '';
}

/**
 * 자원(字源) 블록 — hanjaEtym.json 항목([획수, 부수, 성분들, 번체, 간체, 구자체])을
 * 카드가 그릴 형태로 푼다. 성분은 전부 URO(빌드 규칙)라 최소한 음 라벨이 성립하고,
 * 성분·자형 칩 탭 → 그 글자 카드(재귀)는 호출부가 잇는다. 부수는 성분 배지(isRadical)와
 * 메타 한 줄로만 드러난다 — 별도 설명 없음(설계 확정: "부수는 설명하지 않는다").
 * kyu(R5) = 신자체의 정자(구자체) — 간체는 빌드에서 배제돼 正 칩이 거짓말하지 않는다.
 * jaOfTrad(R5) = 자형 삼각형 사슬: 자기 항목에 일본 자형이 없어도 번체를 경유해
 * 잇는다(乐 → 樂 → 楽). 테이블 미로드·미등재·비한자는 null(조용히 생략 관례).
 */
export function charEtym(ch, etymTable, { koTable, hunTable, jaTable } = {}) {
  if (!isInspectableChar(ch) || !etymTable) return null;
  const e = etymTable[ch];
  if (!e) return null;
  const [s, r, c, t, p, k] = [e[0] || 0, e[1] || '', e[2] || '', e[3] || '', e[4] || '', e[5] || ''];
  const jaOfTrad = jaTable
    ? [...t].map((x) => jaTable[x]).find((f) => f && f !== ch) || null
    : null;
  return {
    strokes: s,
    radical: r,
    radicalHun: r ? charLabel(r, koTable, hunTable) : '',
    comps: [...c].map((x) => ({ ch: x, label: charLabel(x, koTable, hunTable), isRadical: x === r })),
    trad: [...t],
    simp: [...p],
    kyu: [...k],
    jaOfTrad,
  };
}

/**
 * 이 자료에서 이 글자가 든 다른 단어 — 읽기 순환의 재등장 앵커(R1: 신규 데이터 0).
 * 분석 사전(processed_json)을 본문 등장 순서(sequence)로 스캔: 실패·개행 토큰 제외,
 * 지금 단어 제외, 표기(text) 기준 중복 제거, 기본 6개 상한.
 */
export function materialWordsWithChar(ch, json, { excludeText, cap = 6 } = {}) {
  if (!isInspectableChar(ch) || !json?.sequence || !json?.dictionary) return [];
  const out = [];
  const seen = new Set();
  for (const id of json.sequence) {
    const t = json.dictionary[id];
    if (!t || t.failed || t.pos === '개행') continue;
    const w = t.text || '';
    if (!w.includes(ch) || w === excludeText || seen.has(w)) continue;
    seen.add(w);
    out.push(t);
    if (out.length >= cap) break;
  }
  return out;
}
