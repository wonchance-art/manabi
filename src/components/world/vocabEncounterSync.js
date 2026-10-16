// 🈁 만남 기록 서버 정본 동기화(user_vocab_encounters) — rfc-vocab-encounter §4.5.
// 로컬(localStorage)이 원본이라는 §4.2 철학은 그대로다: 게스트·오프라인은 이 파일이 불리지 않고,
// 로그인 시 학습 웹 진입점에서 쌍방 병합만 한다 — pull(서버 행을 로컬 합집합) + push(로컬 전용분).
// 만남은 불변이라 update 가 없다: push 는 ignoreDuplicates(ON CONFLICT DO NOTHING)로 서버
// first_met_at 을 보존하며, 이 방식이어야 UPDATE 권한 없는 테이블 GRANT(select/insert)와도 맞는다.
// 실패는 전부 조용히 — 마이그레이션 미적용이어도 로컬 단독으로 동작한다(무해성 계약).

import { isEncounterLang, loadVocabEncounters, loadVocabEncounterContexts, recordVocabEncounters } from './vocabEncounters.js';

const PULL_THROTTLE_MS = 5 * 60 * 1000;
// PostgREST 최대 행 수(1000)에 맞춘 페이지(ROW-CAP-SWEEP-001, 2026-10-17 KST) — 한 번에 받으면 1000행에서 말없이 잘려,
// 그 언어 만남이 1000개를 넘으면 새 기기로 끌어오는 몫이 빠졌다(빠진 단어는 push 쪽에서 다시 보내는 헛걸음도 생긴다).
// 표는 PK(user_id, lang, word_text) — id가 없어 정본 완전 조회(readCompleteLegacyRows, id 정렬 필수)를 쓸 수 없고,
// 같은 표의 유일 키 word_text로 정렬해 아는 단어 로더(knownWords.loadKnownWords)와 같은 순차 페이지로 읽는다.
export const ENCOUNTER_PULL_PAGE = 1000;

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

    const remote = new Set();
    for (let from = 0; ; from += ENCOUNTER_PULL_PAGE) {
      const { data, error } = await client
        .from('user_vocab_encounters')
        .select('word_text')
        .eq('user_id', userId)
        .eq('lang', lang)
        .order('word_text', { ascending: true })
        .range(from, from + ENCOUNTER_PULL_PAGE - 1);
      if (error) return false; // 한 페이지라도 실패면 로컬 무변경 · push 없음(부분 집합으로 판단하지 않는다)
      for (const r of data || []) if (typeof r?.word_text === 'string' && r.word_text.length > 0) remote.add(r.word_text);
      if ((data || []).length < ENCOUNTER_PULL_PAGE) break;
    }

    // pull — 합집합 기록은 §4.2 recordVocabEncounters 그대로(멱등·정렬 저장).
    const before = loadVocabEncounters(lang, storage);
    const hasNew = [...remote].some((w) => !before.has(w));
    changed = hasNew && recordVocabEncounters(lang, [...remote], storage);

    // push — 로컬 전용분만. DB CHECK(1~100자)를 여기서도 걸러 한 행이 배치 전체를 막지 않게 한다.
    // 출처 문맥(R3)이 있으면 동봉 — insert 시 1회만 실리고 이후 불변(ignoreDuplicates·무 UPDATE).
    const contexts = loadVocabEncounterContexts(lang, storage);
    const toPush = [...before]
      .filter((w) => !remote.has(w) && w.length <= 100)
      .map((word_text) => {
        const ctx = contexts[word_text];
        return {
          user_id: userId, lang, word_text,
          ...(typeof ctx?.t === 'string' && ctx.t ? { context: ctx.t.slice(0, 200) } : {}),
          ...(typeof ctx?.s === 'string' && ctx.s ? { context_source: ctx.s.slice(0, 20) } : {}),
        };
      });
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
