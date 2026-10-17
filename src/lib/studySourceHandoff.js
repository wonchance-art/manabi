// 「내 글 · 이 글로 연습」 → /study?source=mine 넘겨주기(LOCAL-PROGRESS-ACCOUNT-001 ②, 2026-10-17 KST).
// 예전에는 `study_source_<lang>`에 본문만(최대 1500자 — 뷰어는 비공개 자료 본문도) 담고, 문단 생성이 성공했을 때만 지웠다. 실패 ·
// 한도 · 이탈로 남은 A의 본문을 같은 기기의 B가 /study?source=mine(뒤로 가기 · 새로고침)으로 받아 AI 소재로 보냈다.
// 이제 { owner, at, text }로 적고, 읽을 때 계정이 같고 30분 안일 때만 쓴다. 계정이 떠나면(AuthContext adoptUser) 모두 지운다.

export const STUDY_SOURCE_TTL_MS = 30 * 60 * 1000;
const PREFIX = 'study_source_';
const keyOf = (lang) => `${PREFIX}${lang}`;
const accountOf = (account) => (typeof account === 'string' && account ? account : null);
const storageOf = (storage) => {
  if (storage) return storage;
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
};

/** 넘겨줄 글을 적는다 — owner = 지금 계정(손님 null). */
export function writeStudySource(lang, text, owner, { now = Date.now(), storage } = {}) {
  try { storageOf(storage)?.setItem(keyOf(lang), JSON.stringify({ owner: accountOf(owner), at: now, text: String(text || '') })); } catch { /* 조용히 */ }
}

/** 이 계정(account)이 30분 안에 넘긴 글만 — 아니면 ''(옛 꼴 · 다른 계정 · 늦음은 버린다). */
export function readStudySource(lang, account, { now = Date.now(), storage } = {}) {
  let entry;
  try { entry = JSON.parse(storageOf(storage)?.getItem(keyOf(lang)) || 'null'); } catch { return ''; }
  if (!entry || typeof entry !== 'object' || typeof entry.text !== 'string') return '';
  if (entry.owner !== accountOf(account)) return '';
  if (!Number.isFinite(entry.at) || now - entry.at > STUDY_SOURCE_TTL_MS || now < entry.at - 60000) return '';
  return entry.text;
}

export function clearStudySource(lang, { storage } = {}) {
  try { storageOf(storage)?.removeItem(keyOf(lang)); } catch { /* 조용히 */ }
}

/** 모든 언어의 넘겨줄 글을 지운다 — 계정이 떠날 때. */
export function clearAllStudySources({ storage } = {}) {
  const store = storageOf(storage);
  if (!store) return 0;
  const keys = [];
  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => store.removeItem(key));
  } catch { /* 조용히 */ }
  return keys.length;
}
