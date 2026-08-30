/**
 * 버전 배지 순수 로직 (v2-J, #1077 — 오너 발안·확정 2026-08-27).
 * 배지는 표시기가 아니라 **비교기**다: 번들에 굳은 빌드 SHA와 /api/version이 답한
 * 서버 SHA를 맞대어 "이 커밋이 배포됐나"(Q1)와 "내가 그 배포를 보고 있나"(Q2)를
 * 동시에 답한다 — Q2가 곧 '비로그인 옛 버전' 버그(SW 캐시)의 상시 감시 장치다.
 * UI·네트워크는 VersionBadge.jsx 몫, 여기는 순수 판정만(dictation 선례).
 */

/** 노출 게이트(계약 2) — 관리자 · ?v=1 · localStorage.debug_version 중 하나뿐. */
export function shouldShowVersionBadge({ isAdmin = false, search = '', debugFlag = null } = {}) {
  if (isAdmin) return true;
  if (debugFlag) return true;
  // '?v=1' 또는 '?a=b&v=1' — 값이 있는 v 파라미터면 켠다(v=0·빈 값은 꺼짐).
  try {
    const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
    const v = params.get('v');
    return !!v && v !== '0' && v !== 'false';
  } catch {
    return false;
  }
}

/** 빌드 시각 → KST 표기(규약: 사람이 읽는 시각은 항상 KST, 'Z' 금지). */
export function kstBuildLabel(iso) {
  const ms = Date.parse(iso || '');
  if (!Number.isFinite(ms)) return null;
  const kst = new Date(ms + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${kst.getUTCFullYear()}-${p(kst.getUTCMonth() + 1)}-${p(kst.getUTCDate())} `
    + `${p(kst.getUTCHours())}:${p(kst.getUTCMinutes())}`;
}

/** 상대 시각 — 배지 한 줄에 들어갈 짧은 한국어 표기. */
export function relativeKo(iso, nowMs = Date.now()) {
  const ms = Date.parse(iso || '');
  if (!Number.isFinite(ms)) return null;
  const diffMin = Math.floor((nowMs - ms) / 60000);
  if (diffMin < 0) return '방금';        // 시계 어긋남은 미래로 보이지 않게 접는다
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

/**
 * 배지 상태 조립.
 * @returns {{status:'local'|'stale'|'ok', sha, serverSha, ref, relative, builtAt}}
 *   local  빌드 SHA가 없다(로컬·미배포) — 비교 자체가 무의미, 경고하지 않는다(계약 4)
 *   stale  번들 SHA ≠ 서버 SHA — 옛 번들을 보고 있다(Q2)
 *   ok     일치하거나 아직 서버 응답 전
 */
export function buildVersionView({ buildSha, buildRef, buildAt, serverSha, nowMs = Date.now() } = {}) {
  const sha = buildSha || 'dev';
  const isLocal = sha === 'dev' || !sha;
  const status = isLocal ? 'local'
    : (serverSha && serverSha !== 'dev' && serverSha !== sha) ? 'stale'
      : 'ok';
  return {
    status,
    sha,
    serverSha: serverSha || null,
    ref: buildRef || 'local',
    relative: relativeKo(buildAt, nowMs),
    builtAt: kstBuildLabel(buildAt),
  };
}
