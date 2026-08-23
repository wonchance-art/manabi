// 🈁 우리 사전 '만남' 기록 — 월드에서 노출된 정본 어휘를 언어별로 남긴다 (rfc-vocab-encounter §4.2).
// npc-met(사람 만남)과 같은 계열의 로컬 우선 기록이다 — 이 모듈은 스토리지만 알고 서버를 모른다.
// 다기기 병합은 vocabEncounterSync(§4.5)가 별도로 맡는다(로컬이 원본, 실패 시 로컬 단독).
// 기록 대상은 저작 시점 refs 주석(§4.1)뿐이라 쓰기 시점 정본 대조는 하지 않는다 —
// refs ⊆ 정본은 계약 테스트(npcScriptRefs.test.js)가, 소비 시점 교집합은 소비처(R2)가 맡는다.

import { vocabEncounterStorageKey, vocabEncounterContextStorageKey } from '../../lib/world/storageSchema.js';

export { vocabEncounterStorageKey, vocabEncounterContextStorageKey };

// 출처 문맥 문장 상한 — DB CHECK(≤200자)와 동일 계약(rfc-adaptive-quiz R3).
export const ENCOUNTER_CONTEXT_MAX = 200;

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

/** 출처 문맥 로드 — 표기 → { t: 문장, s: 출처 }. 깨진 값은 빈 맵(로컬이 원본·안전 우선). */
export function loadVocabEncounterContexts(lang, storage = defaultStorage()) {
  if (!isEncounterLang(lang) || !storage) return {};
  try {
    const parsed = JSON.parse(storage.getItem(vocabEncounterContextStorageKey(lang)) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * 노출된 표기들을 합집합으로 기록한다. 전부 이미 있으면 재저장하지 않는다(멱등).
 * context({ text, source })가 있으면 **이번에 처음 만난 표기에만** 출처 문장을 남긴다
 * (rfc-adaptive-quiz R3 — first_met_at 보존과 같은 불변: 이후 만남은 문맥을 덮지 않는다).
 * 문맥 저장 실패는 조용히 — 만남 표기 기록과 독립이다(문맥은 부가 정보).
 */
export function recordVocabEncounters(lang, words, storage = defaultStorage(), context = null) {
  if (!isEncounterLang(lang) || !Array.isArray(words)) return false;
  const clean = words.filter((w) => typeof w === 'string' && w.length > 0);
  if (clean.length === 0) return true;
  const met = loadVocabEncounters(lang, storage);
  const fresh = [];
  for (const w of clean) {
    if (!met.has(w)) { met.add(w); fresh.push(w); }
  }
  if (fresh.length === 0) return true;
  const saved = saveVocabEncounters(lang, met, storage);
  const text = typeof context?.text === 'string' ? context.text.trim().slice(0, ENCOUNTER_CONTEXT_MAX) : '';
  if (saved && text && storage) {
    try {
      const contexts = loadVocabEncounterContexts(lang, storage);
      let changed = false;
      for (const w of fresh) {
        if (!contexts[w]) {
          contexts[w] = { t: text, ...(context.source ? { s: String(context.source) } : {}) };
          changed = true;
        }
      }
      if (changed) storage.setItem(vocabEncounterContextStorageKey(lang), JSON.stringify(contexts));
    } catch {
      // 부가 정보 — 조용히 생략.
    }
  }
  return saved;
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

/** 스텝의 출처 문맥 문장(R3) — say는 대사 원문, ask는 정답 선택지 원문. 없으면 null. */
export function stepEncounterContext(step) {
  const main = step?.ja ?? step?.fr ?? step?.zh ?? step?.en;
  if (typeof main === 'string' && main) return main;
  const correct = Array.isArray(step?.choices) ? step.choices.find((c) => c?.correct) : null;
  const answer = correct?.ja ?? correct?.fr ?? correct?.zh ?? correct?.en;
  return typeof answer === 'string' && answer ? answer : null;
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
