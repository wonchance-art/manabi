// 🈁 만남 기록 서버 정본 동기화(user_vocab_encounters) — rfc-vocab-encounter §4.5.
// 로컬(localStorage)이 원본이라는 §4.2 철학은 그대로다: 게스트·오프라인은 이 파일이 불리지 않고,
// 로그인 시 학습 웹 진입점에서 쌍방 병합만 한다 — pull(서버 행을 로컬 합집합) + push(로컬 전용분).
// 만남은 불변이라 update 가 없다: push 는 ignoreDuplicates(ON CONFLICT DO NOTHING)로 서버
// first_met_at 을 보존하며, 이 방식이어야 UPDATE 권한 없는 테이블 GRANT(select/insert)와도 맞는다.
// 실패는 전부 조용히 — 마이그레이션 미적용이어도 로컬 단독으로 동작한다(무해성 계약).

import { isEncounterLang, loadVocabEncounters, recordVocabEncounters } from './vocabEncounters.js';

const PULL_THROTTLE_MS = 5 * 60 * 1000;

/** 언어별 pull 스로틀 마커(sessionStorage) — refProgress 의 ref_pull_at 선례를 언어 축만 더해 따른다. */
export function encounterPullThrottleKey(lang) {
  return `vocab_enc_pull_at:${lang}`;
}

function defaultLocalStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function defaultSessionStorage() {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * 서버 ↔ localStorage 쌍방 병합. 반환: 로컬에 새 표기가 들어왔으면 true(호출부가 metSet 재로딩).
 * push 만 있고 pull 이 빈 경우는 false — 화면이 다시 그릴 게 없다.
 * client·storage 들은 DI(테스트용) — 실사용은 supabase + 브라우저 스토리지 기본값.
 */
export async function syncVocabEncounters(client, userId, lang, {
  force = false,
  storage = defaultLocalStorage(),
  throttleStorage = defaultSessionStorage(),
} = {}) {
  if (!client || !userId || !isEncounterLang(lang) || !storage) return false;
  let changed = false;
  try {
    if (throttleStorage) {
      if (!force) {
        const last = Number(throttleStorage.getItem(encounterPullThrottleKey(lang)) || 0);
        if (Date.now() - last < PULL_THROTTLE_MS) return false;
      }
      throttleStorage.setItem(encounterPullThrottleKey(lang), String(Date.now()));
    }

    const { data, error } = await client
      .from('user_vocab_encounters')
      .select('word_text')
      .eq('user_id', userId)
      .eq('lang', lang);
    if (error) return false;

    const remote = new Set(
      (data || []).map((r) => r?.word_text).filter((w) => typeof w === 'string' && w.length > 0),
    );

    // pull — 합집합 기록은 §4.2 recordVocabEncounters 그대로(멱등·정렬 저장).
    const before = loadVocabEncounters(lang, storage);
    const hasNew = [...remote].some((w) => !before.has(w));
    changed = hasNew && recordVocabEncounters(lang, [...remote], storage);

    // push — 로컬 전용분만. DB CHECK(1~100자)를 여기서도 걸러 한 행이 배치 전체를 막지 않게 한다.
    const toPush = [...before]
      .filter((w) => !remote.has(w) && w.length <= 100)
      .map((word_text) => ({ user_id: userId, lang, word_text }));
    if (toPush.length > 0) {
      await client
        .from('user_vocab_encounters')
        .upsert(toPush, { onConflict: 'user_id,lang,word_text', ignoreDuplicates: true })
        .then(() => {}, () => {});
    }
    return changed;
  } catch {
    return changed;
  }
}
