'use client';

/**
 * 서비스워커 캐시 진단·비우기 (v2-J R2, #1077 — 오너 발안 2026-08-27).
 * '비로그인인데 옛 버전이 뜬다'는 버그의 **자가 수리 도구**다: 배지가 구버전을
 * 알려주면(R1의 SHA 비교) 여기서 앱 껍데기 캐시를 비우고 새로 받는다.
 *
 * ⚠ 층 분리(v2-N 설계 §6): **CacheStorage = 앱 껍데기, IndexedDB = 학습 데이터.**
 * 이 모듈은 CacheStorage와 SW 등록만 건드린다. IndexedDB(오프라인 자료·단어장
 * 스냅샷)는 절대 지우지 않는다 — 지하철에서 캐시를 비웠다고 단어장이 사라지면
 * 그건 진단 도구가 아니라 사고다. 계약이 이를 강제한다.
 */

/** 짧게 — 캐시명은 콘텐츠 해시가 붙어 길다(anatomy-studio-vebbf66b965be201d). */
export function shortenCacheName(name, keep = 20) {
  const s = String(name || '');
  return s.length > keep ? `${s.slice(0, keep)}…` : s;
}

/** 현재 CacheStorage 이름들. 조회 실패·미지원은 빈 배열(진단이 화면을 깨지 않게). */
export async function readCacheNames() {
  try {
    if (typeof caches === 'undefined') return [];
    return await caches.keys();
  } catch {
    return [];
  }
}

/**
 * 앱 껍데기 캐시를 비우고 서비스워커 등록을 해제한다.
 * 호출부가 이어서 새로고침하면 새 번들을 서버에서 받는다.
 * @returns {Promise<number>} 지운 캐시 수(실패는 0 — 조용히)
 */
export async function clearAppShellCaches() {
  let cleared = 0;
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      const results = await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
      cleared = results.filter(Boolean).length;
    }
  } catch { /* 미지원·거부 — 조용히 */ }
  try {
    // 등록을 남겨 두면 다음 로드에서 옛 워커가 다시 캐시를 채운다.
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    await Promise.all((regs || []).map((r) => r.unregister().catch(() => false)));
  } catch { /* 조용히 */ }
  return cleared;
}
