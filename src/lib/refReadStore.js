// 레퍼런스 진도(읽음 · 확인 점수) 기기 저장 — 계정별(LOCAL-PROGRESS-ACCOUNT-001, 2026-10-17 KST).
// 예전 키(ja_read_chapters · ja_read_chapters_check 등)는 계정을 몰라, 같은 기기에서 B가 로그인하면 pullProgress(force)의 합집합이
// 「로컬 전용은 서버로」 A의 진도를 B의 user_ref_progress에 올렸다(계정을 넘는 서버 쓰기). 로그인 계정의 진도는 계정을 붙인 키
// (`…:<accountId>`)에 두고, 계정을 모르는 옛 키는 손님 몫으로 남긴다. 손님 몫은 「그 기기의 첫 로그인 계정」에만 한 번 합친 뒤
// 비운다(claimGuestRefProgress — 이미 다른 계정이 합쳤으면 합치지 않는다). A의 진도는 지우지 않는다 — A 키에 남아 A가 다시 들어오면 그대로.
// /study · /learn(레퍼런스 · 강의 목록 · 코스) · /home 진도 표시와 쓰기는 모두 이 모듈의 키 · 읽기 함수를 쓴다(새 이음새 금지).

/** 언어 → 옛(손님) 키 바탕. 계정 키는 refReadKey · refCheckKey로 만든다. */
export const REF_READ_KEYS = Object.freeze({
  Japanese: 'ja_read_chapters',
  English: 'en_read_chapters',
  French: 'fr_read_chapters',
  Chinese: 'zh_read_chapters',
});
/** 손님 몫을 이미 합친 계정(기기당 한 번). */
export const GUEST_PROGRESS_CLAIM_KEY = 'ref_progress_guest_claimed';

const accountOf = (account) => (typeof account === 'string' && account ? account : null);
const storageOf = (storage) => {
  if (storage) return storage;
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
};

/** 계정이면 `key:<계정>`, 손님이면 key 그대로(옛 자리). */
export function accountScopedKey(key, accountId) {
  const who = accountOf(accountId);
  return who ? `${key}:${who}` : key;
}
/** 읽음 Set 키 — 바탕은 REF_READ_KEYS 값(ref.readKey). */
export const refReadKey = (base, accountId) => accountScopedKey(base, accountId);
/** 확인 점수 맵 키(`<바탕>_check`). */
export const refCheckKey = (base, accountId) => accountScopedKey(`${base}_check`, accountId);
/** 읽은 날짜 맵 키(`<바탕>_dates`). */
export const refDatesKey = (base, accountId) => accountScopedKey(`${base}_dates`, accountId);

function readJson(storage, key, fallback) {
  try {
    const value = JSON.parse(storage?.getItem(key) || 'null');
    return value ?? fallback;
  } catch { return fallback; }
}
function writeJson(storage, key, value) {
  try { storage?.setItem(key, JSON.stringify(value)); } catch { /* 용량 · 사생활 모드 — 조용히 */ }
}

/** 이 계정(손님 null)의 읽음 Set. */
export function readRefRead(base, accountId, storage) {
  const value = readJson(storageOf(storage), refReadKey(base, accountId), []);
  return new Set(Array.isArray(value) ? value : []);
}
/** 이 계정의 확인 점수 맵(slug → { right, total, passed, at }). */
export function readRefChecks(base, accountId, storage) {
  const value = readJson(storageOf(storage), refCheckKey(base, accountId), {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
export function writeRefRead(base, accountId, slugs, storage) {
  writeJson(storageOf(storage), refReadKey(base, accountId), [...slugs]);
}
export function writeRefChecks(base, accountId, map, storage) {
  writeJson(storageOf(storage), refCheckKey(base, accountId), map);
}
/** 읽음 하나 더하기(이미 있으면 쓰지 않음). @returns {boolean} 새로 더했나 */
export function addRefRead(base, accountId, slug, storage) {
  const reads = readRefRead(base, accountId, storage);
  if (!slug || reads.has(slug)) return false;
  reads.add(slug);
  writeRefRead(base, accountId, reads, storage);
  return true;
}
/** 확인 점수 하나 쓰기. */
export function setRefCheck(base, accountId, slug, result, storage) {
  if (!slug) return;
  const map = readRefChecks(base, accountId, storage);
  map[slug] = result;
  writeRefChecks(base, accountId, map, storage);
}

/**
 * 손님 몫(옛 무계정 키)을 이 기기의 첫 로그인 계정에 한 번 합친다 — 읽음은 합집합, 확인 점수는 더 최근(at) 것, 날짜는 이른 것.
 * 합친 뒤 옛 키를 비우고 그 계정을 적는다. 이미 다른 계정(또는 같은 계정)이 합쳤으면 아무것도 하지 않는다 — 그 뒤 손님이 쌓은 것은
 * 다음 사람에게 가지 않는다. AuthContext adoptUser가 새 user로 그리기 전에 부른다(화면이 합친 값을 바로 읽게).
 * @returns {boolean} 합쳤나
 */
export function claimGuestRefProgress(accountId, storage) {
  const who = accountOf(accountId);
  const store = storageOf(storage);
  if (!who || !store) return false;
  try {
    if (store.getItem(GUEST_PROGRESS_CLAIM_KEY)) return false;
    for (const base of Object.values(REF_READ_KEYS)) {
      const guestRead = readRefRead(base, null, store);
      if (guestRead.size) writeRefRead(base, who, new Set([...readRefRead(base, who, store), ...guestRead]), store);
      const guestChecks = readRefChecks(base, null, store);
      if (Object.keys(guestChecks).length) {
        const mine = readRefChecks(base, who, store);
        for (const [slug, result] of Object.entries(guestChecks)) {
          if (!mine[slug] || (result?.at || 0) > (mine[slug]?.at || 0)) mine[slug] = result;
        }
        writeRefChecks(base, who, mine, store);
      }
      const guestDates = readJson(store, refDatesKey(base, null), {});
      if (guestDates && typeof guestDates === 'object' && Object.keys(guestDates).length) {
        const mine = readJson(store, refDatesKey(base, who), {});
        for (const [slug, at] of Object.entries(guestDates)) if (!mine[slug] || at < mine[slug]) mine[slug] = at;
        writeJson(store, refDatesKey(base, who), mine);
      }
      store.removeItem(refReadKey(base, null));
      store.removeItem(refCheckKey(base, null));
      store.removeItem(refDatesKey(base, null));
    }
    store.setItem(GUEST_PROGRESS_CLAIM_KEY, who);
    return true;
  } catch { return false; }
}
