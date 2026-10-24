'use client';

/**
 * 오프라인 학습 캐시 (v2-N R1, #1077 — 오너 착수 승인 2026-08-30 "N R1 ㄱㄱ").
 *
 * 서비스워커가 캐시하는 것은 앱 껍데기뿐이라, 비행기·지하철·로밍 없는 해외에서
 * "앱은 열리는데 단어장이 비어 있고 본문이 없다". 어학연수 앱의 실사용 맥락과
 * 정면으로 어긋나는 이 구멍을 IndexedDB 학습 데이터층으로 메운다.
 *   SW = 앱 껍데기 · IndexedDB = 학습 데이터 — 층이 다르다(설계 §6 위험표).
 *
 * pdfCache.js의 검증된 패턴(TTL·LRU·조용한 실패)을 그대로 복제한다. 다른 점은
 * 자료 본문(processed_json = 토큰 사전이라 크다)이 대상이라 상한을 3으로 조인 것뿐.
 * 읽기는 **네트워크 실패 시에만** 쓴다(계약 6: 온라인이면 항상 네트워크 우선) —
 * 그래서 스테일 위험이 구조적으로 성립하지 않는다.
 */

const DB_NAME = 'anatomy-offline-cache';
const STORE_MATERIALS = 'materials';
const STORE_SNAPSHOTS = 'snapshots';
/** 미전송 복습(v2-N R2). 같은 DB를 쓴다 — 두 번째 DB를 열면 버전·업그레이드가 갈린다. */
export const STORE_OUTBOX = 'outbox';
const DB_VERSION = 2;
export const TTL_MS = 7 * 24 * 60 * 60 * 1000;  // 7일 — pdfCache와 같은 값
export const MAX_MATERIALS = 3;                  // 설계 §2: 최근 연 자료 3개
/**
 * 받아둔 자료 상한(v2-N R3). 자동분(3)과 **별개**다 — 핀이 자동 상한을 먹으면
 * 3개를 받아두는 순간 "최근 연 자료" 캐시가 죽어 R1이 무력화된다.
 * 10인 근거: `processed_json`은 토큰별 사전이라 자료 하나가 대략 0.1~0.6MB이고,
 * IndexedDB 할당량은 보통 수십 MB 이상이라 10개(≈6MB 상한)는 여유 안이다.
 */
export const MAX_PINNED = 10;
const MAX_SNAPSHOTS = 4;                  // 사용자당 1행 — 기기 공유 여지만 남긴다

let _dbPromise = null;

/**
 * DB 하나를 공유한다(reviewOutbox도 이 함수를 쓴다) — 모듈마다 DB를 열면 버전이
 * 갈려 한쪽 업그레이드가 다른 쪽을 blocked 상태로 세운다. 스토어 추가는 여기서만.
 */
export function openDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    // 다른 탭이 옛 판 연결을 쥐고 있으면 판 올리기가 blocked에서 멈춘다 — 그대로 두면 이 약속이 끝나지 않아 캐시를 기다리는
    // 화면이 「불러오는 중」에 묶였다(a3ba 리뷰 ⑤). blocked면 실패로 끝내고(호출부는 원래 오류 경로 · 조용한 실패), 다음 호출이
    // 다시 열 수 있게 기억을 비운다. 막혔던 요청이 나중에 열리면 그 연결은 쓰지 않고 닫는다(다른 탭의 판 올리기를 또 막지 않게).
    let settled = false;
    req.onblocked = () => {
      if (settled) return;
      settled = true; _dbPromise = null;
      reject(new Error('IndexedDB blocked'));
    };
    req.onerror = () => { if (settled) return; settled = true; reject(req.error); };
    req.onsuccess = () => {
      if (settled) { req.result.close(); return; }
      settled = true; resolve(req.result);
    };
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_MATERIALS)) {
        db.createObjectStore(STORE_MATERIALS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'key' });
      }
      // v2 — 미전송 복습 큐. autoIncrement라 같은 단어를 여러 번 채점해도 각각 남는다
      // (복습 이력은 덮어쓰기가 아니라 append다).
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        db.createObjectStore(STORE_OUTBOX, { keyPath: 'seq', autoIncrement: true });
      }
    };
  });
  return _dbPromise;
}

/** 저장 — 실패는 전부 조용히 삼킨다(계약 4: 캐시 쓰기가 학습 흐름을 막지 않는다). */
async function put(store, entry, max) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put({ ...entry, savedAt: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = resolve;   // quota 초과 등 — 조용히
    });
    await cleanup(store, max);
  } catch { /* IndexedDB 자체 불가(사생활 모드 등) */ }
}

/** 조회 — 만료분은 없는 셈. 실패는 null(호출부가 원래 에러 경로로 간다). */
async function get(store, key) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => {
        const entry = req.result;
        if (!entry) return resolve(null);
        if (Date.now() - entry.savedAt > TTL_MS) return resolve(null);
        resolve(entry);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * 축출 대상 산정(순수) — ① TTL 만료분 전부 ② 남은 것이 상한을 넘으면 오래된 것부터.
 * 용량 폭주 금지(계약 1)가 이 함수 하나로 검증된다 — IndexedDB 트랜잭션과 분리해 둔
 * 이유이고, 저장 대상이 processed_json(토큰 사전)이라 상한이 실제로 물어야 한다.
 * @returns {Array} 삭제할 키 배열
 */
export function pickEvictions(entries, {
  now = Date.now(), ttl = TTL_MS, max, keyPath = 'id', maxPinned = MAX_PINNED,
} = {}) {
  const list = Array.isArray(entries) ? entries : [];
  // 사용자가 고른 것(v2-N R3)은 TTL·자동 상한 **양쪽에서 빠진다**. 자동 캐시는 "최근 연
  // 것"이라 낡으면 버리는 게 맞지만, 받아둔 자료는 "비행기에서 읽으려고 챙긴 것"이라
  // 7일 뒤에 사라지면 정확히 그 상황에서 없다. 대신 핀에도 개수 상한은 둔다.
  const pinned = list.filter((e) => e.pinned);
  const auto = list.filter((e) => !e.pinned);

  const expired = auto.filter((e) => now - e.savedAt > ttl);
  const toDelete = expired.map((e) => e[keyPath]);
  const alive = auto.filter((e) => now - e.savedAt <= ttl);
  if (Number.isFinite(max) && alive.length > max) {
    const oldestFirst = [...alive].sort((a, b) => a.savedAt - b.savedAt);
    toDelete.push(...oldestFirst.slice(0, alive.length - max).map((e) => e[keyPath]));
  }
  if (Number.isFinite(maxPinned) && pinned.length > maxPinned) {
    const oldestFirst = [...pinned].sort((a, b) => a.savedAt - b.savedAt);
    toDelete.push(...oldestFirst.slice(0, pinned.length - maxPinned).map((e) => e[keyPath]));
  }
  return toDelete;
}

/** TTL 만료분 제거 후, 상한 초과분을 오래된 것부터 제거(LRU — pdfCache 선례). */
async function cleanup(store, max) {
  try {
    const db = await openDb();
    const keyPath = store === STORE_MATERIALS ? 'id' : 'key';
    const entries = await new Promise((resolve) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    const toDelete = pickEvictions(entries, { max, keyPath });
    if (toDelete.length > 0) {
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      toDelete.forEach((k) => os.delete(k));
    }
  } catch { /* ignore */ }
}

/* ── 자료(본문 + processed_json) ── */

/** TTL을 적용하지 않는 원시 조회 — 핀 판정과 핀 항목 읽기에 쓴다. */
async function getRaw(store, key) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/* ── 계정 경계(OFFLINE-ACCOUNT-SCOPE-001, 2026-10-17 KST) ──
 * 자료 기록은 계정을 몰랐다 — B가 오프라인일 때 같은 기기에서 A가 받아 둔 비공개 자료가 폴백(getCachedMaterial)으로 열렸다.
 * 로그인 계정의 기록은 계정을 붙인 키(`acct:<계정>:<id>`)로 따로 둔다(팀 사본 저장소와 같은 방식) — A · B가 같은 자료를 각자
 * 받아 두고 열어도 서로 덮지 않는다. 읽을 때 지금 계정과 비교한다. 키 경로(id) · 저장소 판(2)은 그대로다(판 올림 없음 —
 * onblocked 경로와 무관). 손님 기록(owner null)은 자료 id 키에 공개 자료만 담고 누구에게나 열린다. 이 판 이전 기록(id 키 · owner 없음)은
 * 누가 받았는지 모르므로 자료가 스스로 말해 주는 것만 연다: 공개 자료 · 지금 계정이 만든 자료(owner_id).
 * 대기 연산(outbox — 복습 · FSRS)은 이미 userId · accountId로 묶여 읽고 보낸다 — 계정이 바뀌어도 지우지 않는다(A가 다시 로그인하면 보냄).
 */
const own = (entry) => Object.prototype.hasOwnProperty.call(entry || {}, 'owner');
const isPublicMaterial = (material) => material?.visibility === 'public';
const accountOf = (account) => (typeof account === 'string' && account ? account : null); // 모르는 값(쿼리 문맥 객체 등)은 손님

/** 저장 키 — 로그인 계정이면 계정을 붙이고, 손님이면 자료 id 그대로(이전 판과 같은 자리). */
export const materialKey = (id, owner) => (accountOf(owner) ? `acct:${accountOf(owner)}:${id}` : id);
/** 기록이 담은 자료 id(계정 키 기록은 materialId, 이전 판 · 손님은 키 그대로). */
const materialIdOf = (entry) => (entry && Object.prototype.hasOwnProperty.call(entry, 'materialId') ? entry.materialId : entry?.id);

/** 이 자료 기록을 지금 계정(account: id · null/undefined=손님)이 열어도 되나. */
export function materialEntryVisible(entry, account) {
  const material = entry?.material;
  if (!material) return false;
  const who = accountOf(account);
  if (own(entry)) return entry.owner === null ? isPublicMaterial(material) : entry.owner === who;
  return isPublicMaterial(material) || (who !== null && material.owner_id === who);
}

/** 지금 계정이 열 수 있는 이 자료의 기록 — 자기 키가 먼저, 없으면 자료 id 자리(손님 · 이전 판). TTL은 보지 않는다. */
async function visibleRaw(id, account) {
  const who = accountOf(account);
  for (const key of who ? [materialKey(id, who), id] : [id]) {
    const raw = await getRaw(STORE_MATERIALS, key);
    if (materialEntryVisible(raw, who)) return { key, raw };
  }
  return null;
}

/** 뷰어가 받은 자료를 남긴다. owner = 그 조회를 보낸 계정(요청 시점에 잡은 값 — 늦게 읽으면 로그아웃 뒤 손님으로 적힌다). */
export async function cacheMaterial(material, { owner = null } = {}) {
  if (!material?.id) return;
  const who = accountOf(owner);
  // 손님 기록은 누구에게나 열리므로 공개 자료만 담는다(계정을 모르는 비공개 행을 손님 몫으로 남기지 않는다).
  if (who === null && !isPublicMaterial(material)) return;
  // 핀을 보존한다 — 받아둔 자료를 뷰어에서 열면 자동 캐시가 같은 키를 덮어쓰는데,
  // 그때 pinned가 떨어지면 사용자가 챙긴 자료가 조용히 자동 축출 대상이 된다. 키가 계정별이라 남의 핀과는 겹치지 않는다.
  const key = materialKey(material.id, who);
  const prev = await getRaw(STORE_MATERIALS, key);
  await put(
    STORE_MATERIALS,
    { id: key, materialId: material.id, material, owner: who, ...(prev?.pinned ? { pinned: true } : {}) },
    MAX_MATERIALS,
  );
}

/** 오프라인 폴백 읽기 — 지금 계정(account)이 열 수 있는 기록만. 빠뜨리면 손님으로 본다(공개분만). */
export async function getCachedMaterial(id, { account = null } = {}) {
  const found = await visibleRaw(id, account);
  if (!found) return null;
  // 핀은 TTL 밖이다 — 7일 지난 '받아둔 자료'가 안 열리면 받아둔 의미가 없다.
  if (found.raw.pinned) return found.raw.material || null;
  const entry = await get(STORE_MATERIALS, found.key);
  return entry?.material || null;
}

/* ── 받아두기(v2-N R3) — 사용자가 고른 자료를 자동 축출에서 지킨다 ── */

/**
 * 자료 하나를 받아둔다. `material`은 **뷰어가 읽는 필드를 다 갖춘 행**이어야 한다
 * (실측: 자료실 목록 조회에는 `raw_text`·`source_pdf_id`·`page_start`·`page_end`·
 * `status`가 없다 — 목록 행을 그대로 넣으면 오프라인 뷰어에 빈 칸이 생긴다).
 * owner = 받아 두는 계정 — 그 계정 키에 둔다(같은 기기의 다른 계정이 같은 자료를 받아 둬도 각자).
 */
export async function pinMaterial(material, { owner = null } = {}) {
  if (!material?.id) return false;
  const who = accountOf(owner);
  if (who === null && !isPublicMaterial(material)) return false;
  await put(STORE_MATERIALS, { id: materialKey(material.id, who), materialId: material.id, material, owner: who, pinned: true }, MAX_MATERIALS);
  return true;
}

/** 받아두기 해제 — 본문은 남기되 자동 축출 대상으로 되돌린다. 지금 계정이 열 수 있는 기록만(이전 판 핀 포함, 찾은 자리 그대로). */
export async function unpinMaterial(id, { owner = null } = {}) {
  if (!id) return false;
  const found = await visibleRaw(id, owner);
  if (!found) return false;
  const { pinned: _pinned, savedAt: _savedAt, ...rest } = found.raw;
  await put(STORE_MATERIALS, rest, MAX_MATERIALS);
  return true;
}

async function getAllEntries(store) {
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

/** 받아둔 자료 id 집합 — 자료실이 배지·필터에 쓴다. 지금 계정(account)이 열 수 있는 것만. */
export async function pinnedMaterialIds(account = null) {
  try {
    const all = await getAllEntries(STORE_MATERIALS);
    return new Set(all.filter((e) => e.pinned && materialEntryVisible(e, account)).map(materialIdOf));
  } catch {
    return new Set();
  }
}

/**
 * 끊긴 서재의 「이 기기에 받아 둔 자료」(OFFLINE-SWEEP-001 P1, 2026-10-24 KST) — 지금 계정(account)이 이 기기에 남긴 자료 중
 * 뷰어 폴백(getCachedMaterial)이 실제로 여는 것만 고른다. 계정 경계(OFFLINE-ACCOUNT-SCOPE-001)는 읽기 판정보다 좁힌다:
 *  · 계정 키 기록은 그 계정 것만 — 다른 계정의 기록은 숨김(materialEntryVisible)이고, 손님 기록(owner null · 공개 자료)은 열 수는 있어도
 *    이 계정이 받아 둔 것이 아니라 목록에 올리지 않는다.
 *  · 이 판 이전 기록(계정 없음)은 자료가 스스로 말해 주는 이 계정의 자료(owner_id)만.
 *  · 같은 자료에 계정 키 기록이 있으면 그것이 먼저다(visibleRaw 순서) — 자동 기록은 7일(TTL) 안, 받아 둔 자료는 TTL 밖(핀 계약 그대로).
 * 손님(account 없음)은 빈 목록. 받아 둔 자료가 먼저, 그다음 최근에 남긴 순. 본문은 싣지 않는다(목록 한 줄에 필요한 것만).
 * @returns {Promise<Array<{id, title: string, language: string|null, pinned: boolean, savedAt: number}>>}
 */
export async function listDeviceMaterials(account, { now = Date.now() } = {}) {
  const who = accountOf(account);
  if (who === null) return [];
  try {
    const all = await getAllEntries(STORE_MATERIALS);
    const byKey = new Map(all.map((e) => [e.id, e]));
    const rows = [];
    for (const entry of all) {
      if (!materialEntryVisible(entry, who)) continue;
      const mine = own(entry) ? entry.owner === who : entry.material.owner_id === who;
      if (!mine) continue;
      const id = materialIdOf(entry), accountKey = materialKey(id, who);
      if (entry.id !== accountKey && materialEntryVisible(byKey.get(accountKey), who)) continue; // 계정 키 기록이 먼저 열린다
      if (!entry.pinned && !(now - entry.savedAt <= TTL_MS)) continue; // 지난 자동 기록은 폴백도 열지 않는다
      const { material } = entry;
      rows.push({
        id, title: material.title || '', pinned: !!entry.pinned, savedAt: entry.savedAt || 0,
        language: material.document_json?.language || material.processed_json?.metadata?.language || null,
      });
    }
    return rows.sort((a, b) => (b.pinned - a.pinned) || (b.savedAt - a.savedAt));
  } catch {
    return [];
  }
}

/**
 * 계정이 바뀌면(AuthContext — accountQueryCache와 같은 판정) 다시 받으면 되는 「뷰어 자동 캐시」 중 새 계정(next: id · null=손님)이
 * 열 수 없는 기록만 지운다. 사용자가 직접 받아 둔 자료(핀)와 단어장 스냅샷은 지우지 않고 숨긴다 — 읽기 판정(materialEntryVisible ·
 * 계정 키 스냅샷)이 B · 손님에게 막고, A가 다시 로그인하면 그대로 보인다(데이터 보존 — 오너 결정 2026-10-17 KST).
 * 대기 연산(outbox)도 건드리지 않는다 — A가 안 보낸 채점은 A가 다시 로그인하면 보낸다(B에게는 읽기 · 보내기 모두 계정 필터).
 * @returns {Promise<{ materials: number }>}
 */
export async function purgeOfflineForAccount(next) {
  const who = accountOf(next);
  let materials = 0;
  try {
    const db = await openDb();
    const stale = (await getAllEntries(STORE_MATERIALS)).filter((e) => !e.pinned && !materialEntryVisible(e, who)).map((e) => e.id);
    if (stale.length) {
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_MATERIALS, 'readwrite');
        stale.forEach((k) => tx.objectStore(STORE_MATERIALS).delete(k));
        tx.oncomplete = resolve;
        tx.onerror = resolve;
        tx.onabort = resolve;
      });
    }
    materials = stale.length;
  } catch { /* IndexedDB 불가 · blocked — 조용히(읽기 판정이 그대로 막는다) */ }
  return { materials };
}

/* ── 단어장 스냅샷 — next_review_at을 포함한 전체 행이라 '오늘 due'가 여기서 파생된다
      (별도 due 캐시를 두지 않는 이유 — 중복 신설 금지). ── */

export async function cacheVocabSnapshot(userId, rows) {
  if (!userId || !Array.isArray(rows)) return;
  await put(STORE_SNAPSHOTS, { key: `vocab:${userId}`, rows }, MAX_SNAPSHOTS);
}

export async function getCachedVocabSnapshot(userId) {
  if (!userId) return null;
  const entry = await get(STORE_SNAPSHOTS, `vocab:${userId}`);
  return entry?.rows || null;
}

/** 캐시가 담긴 시각(오프라인 안내 문구용) — 없으면 null. */
export async function cachedVocabSavedAt(userId) {
  if (!userId) return null;
  const entry = await get(STORE_SNAPSHOTS, `vocab:${userId}`);
  return entry?.savedAt || null;
}
