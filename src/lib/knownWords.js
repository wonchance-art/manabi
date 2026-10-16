/**
 * 아는 단어 표시 — 커버리지와 복습 제외가 같은 표기를 읽는다(2026-10-02 오너 정정).
 * 표시/해제의 DB 트리거가 복습 보호 상태를 동기화하고 원래 단어·SRS·이력은 보존한다.
 * 합류 지점은 materialFit 호출부의 인덱스 합집합뿐(엔진 시그니처 무변경).
 * 실패·게스트·마이그레이션 미적용은 조용히(버튼·정밀화만 비활성 — 무해성).
 */
import { supabase } from './supabase';
import { encounterLookupLang } from './refVocabLookup';

/** 표기 언어 코드 — 만남 기록과 같은 매핑('Japanese'→'ja' 등). 미지원 언어는 null. */
export function knownWordsLang(materialLang, koreanStorageSupported = false) {
  if (materialLang === 'Korean') return koreanStorageSupported === true ? 'ko' : null;
  return encounterLookupLang(materialLang);
}

/** 내 '이미 앎' 표기 전체(언어 무관 — 서재 커버리지용) 또는 한 언어. */
export async function fetchKnownWords(userId, langCode) {
  return loadKnownWords(supabase, userId, langCode);
}
const KNOWN_WORDS_PAGE = 1000;
export async function loadKnownWords(client, userId, langCode) {
  const rows = [];
  // PostgREST 기본 최대 행 수(1000)에 맞춘 페이지 — 순차 루프라 실패한 페이지를 숨기지 않는다.
  for (let offset = 0; ; offset += KNOWN_WORDS_PAGE) {
    let query = client.from('user_known_words').select('word_text, lang').eq('user_id', userId);
    if (langCode) query = query.eq('lang', langCode);
    const { data, error } = await query.order('lang').order('word_text').range(offset, offset + KNOWN_WORDS_PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < KNOWN_WORDS_PAGE) return rows;
  }
}

/**
 * 담김 인덱스({surfaces, bases})에 '이미 앎' 표기를 합집합 — materialFit 호출부용
 * 순수 함수. 원본 Set은 변경하지 않는다. 표기는 surfaces·bases 양쪽에 넣는다
 * (known은 표기 단위 등록이라 base 대조도 같은 문자열로 커버).
 */
export function mergeKnownIntoIndex(saved, knownRows) {
  const surfaces = new Set(saved?.surfaces || []);
  const bases = new Set(saved?.bases || []);
  for (const r of knownRows || []) {
    const w = r?.word_text;
    if (!w) continue;
    surfaces.add(w);
    bases.add(w);
  }
  return { surfaces, bases };
}

export async function markKnown(userId, langCode, wordText) {
  const { error } = await supabase
    .from('user_known_words')
    .upsert({ user_id: userId, lang: langCode, word_text: wordText }, {
      onConflict: 'user_id,lang,word_text',
      ignoreDuplicates: true,
    });
  if (error) throw error;
}

export async function unmarkKnown(userId, langCode, wordText) {
  const keys = Array.isArray(wordText) ? wordText : [wordText];
  if (!keys.length) return;
  const { error } = await supabase
    .from('user_known_words')
    .delete()
    .eq('user_id', userId)
    .eq('lang', langCode)
    .in('word_text', keys);
  if (error) throw error;
}

const knownKeyOf = (accountId, lang, word) => `${accountId}:${lang}:${word}`;
/** 이 쓰기가 건드리는 단어 키 — 표시는 그 표기, 해제는 지우는 키 전부. */
const knownWriteKeys = body => (body.known ? [body.wordText] : body.removeKeys || []).map(word => knownKeyOf(body.accountId, body.lang, word));
// PostgREST in.(…) 값 — 따옴표로 감싸 쉼표 · 괄호가 든 표기도 한 값으로 간다.
const postgrestQuote = value => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * 탭이 닫히는 순간(pagehide)의 아는 단어 쓰기 — markKnown · unmarkKnown과 같은 PostgREST 요청을 keepalive fetch로 보낸다.
 * supabase-js는 요청마다 keepalive를 줄 수 없고 인증 헤더를 비동기로 붙여, 닫히는 탭에서는 요청이 나가기 전에 끊긴다.
 * 둘 다 다시 보내도 같은 결과다: 표시는 upsert(on_conflict user_id,lang,word_text · ignore-duplicates), 해제는 키로 지우기.
 * best-effort — 다른 출처 요청이라 사전 요청(preflight)이 붙는 keepalive를 거절하는 브라우저도 있다(그때는 false).
 * @param {{accountId:string, lang:string, wordText:string, known:boolean, removeKeys?:string[]}} body mutation 본문
 * @returns {Promise<boolean>}
 */
export function sendKnownWordKeepalive(body, {
  accessToken,
  url = process.env.NEXT_PUBLIC_SUPABASE_URL, apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  fetchImpl = typeof fetch === 'function' ? fetch : null,
} = {}) {
  if (!body?.accountId || !body?.lang || !accessToken || !url || !apiKey || !fetchImpl) return Promise.resolve(false);
  const headers = { apikey: apiKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  let request;
  if (body.known) {
    if (!body.wordText) return Promise.resolve(false);
    request = [`${url}/rest/v1/user_known_words?${new URLSearchParams({ on_conflict: 'user_id,lang,word_text' })}`, {
      method: 'POST', keepalive: true, headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: body.accountId, lang: body.lang, word_text: body.wordText }),
    }];
  } else {
    const keys = body.removeKeys || [];
    if (!keys.length) return Promise.resolve(false);
    const params = new URLSearchParams({ user_id: `eq.${body.accountId}`, lang: `eq.${body.lang}`, word_text: `in.(${keys.map(postgrestQuote).join(',')})` });
    request = [`${url}/rest/v1/user_known_words?${params}`, { method: 'DELETE', keepalive: true, headers: { ...headers, Prefer: 'return=minimal' } }];
  }
  try { return Promise.resolve(fetchImpl(...request)).then(res => !!res?.ok, () => false); }
  catch { return Promise.resolve(false); }
}

/** 지금 로그인한 세션이 그 계정일 때만 토큰을 준다 — 다른 계정의 토큰으로 이 계정의 쓰기를 보내지 않는다. */
async function sessionTokenFor(accountId) {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  return session?.access_token && session.user?.id === accountId ? session.access_token : null;
}

/**
 * 응답을 기다리는 아는 단어 쓰기 목록 — 낙관 갱신(누른 순간 화면 반영)은 서버가 받기 전에 끝난 것처럼 보이므로, 그 사이
 * 새로 고침 · 다른 사이트로 이동 · 탭 닫기가 오면 쓰기가 말없이 사라질 수 있었다. 쓰기가 나가 있는 동안만 track해 두고,
 * pagehide에서 남은 것을 sendKnownWordKeepalive로 한 번 더 보낸다(같은 요청이라 원래 요청과 겹쳐도 결과는 같다).
 * 같은 단어(계정 · 언어 · 표기 — 해제는 지우는 키 각각)에 새 쓰기가 오면 앞의 것은 빠진다 — 마지막 쓰기만 보낸다
 * (먼저 한 표시가 나중의 해제를 되살리지 않게). 앱 안 이동은 캐시와 요청이 그대로 살아 있어 따로 할 일이 없다.
 * 영구 큐(reviewOutbox · fsrsOperationOutbox)는 어휘 이벤트 · 어휘 FSRS 작업 형식이라 이 쓰기를 싣지 않는다.
 */
export function createKnownWordBeacon({
  send = sendKnownWordKeepalive, getToken = sessionTokenFor,
  target = typeof window !== 'undefined' ? window : null,
} = {}) {
  const pending = new Set(); // { body, keys, token }
  let listening = false;
  const flush = () => {
    for (const entry of pending) if (entry.token) send(entry.body, { accessToken: entry.token }).catch(() => {});
  };
  return {
    /** 쓰기를 보내기 직전에 부른다. 돌려준 함수를 응답(성공 · 실패) 뒤에 부르면 목록에서 빠진다. */
    track(body) {
      const entry = { body, keys: knownWriteKeys(body), token: null };
      for (const earlier of [...pending]) {
        if (earlier.keys.some(key => entry.keys.includes(key))) pending.delete(earlier); // 같은 단어의 앞선 쓰기 — 이번 것이 정본
      }
      pending.add(entry);
      if (!listening && target) { listening = true; target.addEventListener('pagehide', flush); }
      Promise.resolve().then(() => getToken(body.accountId))
        .then(token => { if (pending.has(entry)) entry.token = token || null; }, () => {});
      return () => { pending.delete(entry); };
    },
    flush,
    size: () => pending.size,
  };
}
