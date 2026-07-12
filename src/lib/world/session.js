// 학습 월드 세션·좌표 API 의 순수 헬퍼 — IP 추출/좌표 검증(라우트·WorldPage·테스트 공용).
// 부수효과 0(브라우저/서버 API 미의존)이라 유닛 테스트가 쉽다.

// x-forwarded-for(첫 항목)·x-real-ip 순으로 클라이언트 IP 를 고른다. 서버 라우트만 신뢰 가능한
// 값이므로(클라 위조 무의미) 라우트에서 request 헤더로 이 함수를 부른다. getHeader(name)=>value|null.
//   · x-forwarded-for: "client, proxy1, proxy2" — 첫 항목이 원 클라이언트.
//   · 없으면 x-real-ip, 그것도 없으면 null(→ RPC 에 NULL 전달 = IP 검사 생략).
export function extractClientIp(getHeader) {
  const get = typeof getHeader === 'function' ? getHeader : () => null;
  const xff = get('x-forwarded-for');
  if (xff) {
    const first = String(xff).split(',')[0].trim();
    if (first) return first;
  }
  const real = get('x-real-ip');
  if (real) {
    const v = String(real).trim();
    if (v) return v;
  }
  return null;
}

// 저장/조회한 좌표 payload 를 정수 타일좌표로 정규화한다. 유효하지 않으면 null.
//   scene 은 'plaza' | 'airport' 만 허용(그 외는 'plaza' 로 강제 — 알 수 없는 씬 방어).
//   x·y 는 유한 정수(음수 불가). 반올림해 정수로 만든다.
export function normalizePosition(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const x = Number(raw.x);
  const y = Number(raw.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0) return null;
  const scene = raw.scene === 'airport' ? 'airport' : 'plaza';
  return { scene, x: xi, y: yi };
}

// 스폰 타일이 맵 안이고 걸을 수 있는지(순수). isWalkable(tx,ty)=>bool 은 호출부가 주입
// (GameCanvas 는 씬의 tileCode/blocked 로, 테스트는 페이크로). 범위 밖·비보행이면 false.
export function isSpawnTileValid(tx, ty, cols, rows, isWalkable) {
  if (!Number.isInteger(tx) || !Number.isInteger(ty)) return false;
  if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return false;
  return typeof isWalkable === 'function' ? !!isWalkable(tx, ty) : true;
}
