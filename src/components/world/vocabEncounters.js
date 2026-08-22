// 🈁 우리 사전 '만남' 기록 — 월드에서 노출된 정본 어휘를 언어별로 남긴다 (rfc-vocab-encounter §4.2).
// npc-met(사람 만남)과 같은 계열의 로컬 단독 기록이며, 서버·DB에는 연결하지 않는다(§4.5는 owner-gate).
// 기록 대상은 저작 시점 refs 주석(§4.1)뿐이라 쓰기 시점 정본 대조는 하지 않는다 —
// refs ⊆ 정본은 계약 테스트(npcScriptRefs.test.js)가, 소비 시점 교집합은 소비처(R2)가 맡는다.

import { vocabEncounterStorageKey } from '../../lib/world/storageSchema.js';

export { vocabEncounterStorageKey };

export function isEncounterLang(lang) {
  return typeof lang === 'string' && /^[a-z]{2}$/.test(lang);
}

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadVocabEncounters(lang, storage = defaultStorage()) {
  if (!isEncounterLang(lang) || !storage) return new Set();
  try {
    const parsed = JSON.parse(storage.getItem(vocabEncounterStorageKey(lang)) ?? '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((w) => typeof w === 'string' && w.length > 0));
  } catch {
    return new Set();
  }
}

export function saveVocabEncounters(lang, words, storage = defaultStorage()) {
  if (!isEncounterLang(lang) || !(words instanceof Set) || !storage) return false;
  try {
    storage.setItem(
      vocabEncounterStorageKey(lang),
      JSON.stringify([...words]
        .filter((w) => typeof w === 'string' && w.length > 0)
        .sort()),
    );
    return true;
  } catch {
    return false;
  }
}

/** 노출된 표기들을 합집합으로 기록한다. 전부 이미 있으면 재저장하지 않는다(멱등). */
export function recordVocabEncounters(lang, words, storage = defaultStorage()) {
  if (!isEncounterLang(lang) || !Array.isArray(words)) return false;
  const clean = words.filter((w) => typeof w === 'string' && w.length > 0);
  if (clean.length === 0) return true;
  const met = loadVocabEncounters(lang, storage);
  let changed = false;
  for (const w of clean) {
    if (!met.has(w)) { met.add(w); changed = true; }
  }
  if (!changed) return true;
  return saveVocabEncounters(lang, met, storage);
}

/** 스텝 하나가 노출하는 표기 — refs(일반 노출) ∪ answerRefs(정답 발화 요구, §4.1 계약 2 대상). */
export function stepEncounterRefs(step) {
  const out = [];
  for (const list of [step?.refs, step?.answerRefs]) {
    if (!Array.isArray(list)) continue;
    for (const w of list) {
      if (typeof w === 'string' && w.length > 0 && !out.includes(w)) out.push(w);
    }
  }
  return out;
}

/** 스크립트 전체가 노출하는 표기 — 첫 노출 순서를 보존한 합집합(완주 요약 카드가 소비). */
export function scriptEncounterRefs(script) {
  const out = [];
  for (const step of script?.steps || []) {
    for (const w of stepEncounterRefs(step)) {
      if (!out.includes(w)) out.push(w);
    }
  }
  return out;
}
