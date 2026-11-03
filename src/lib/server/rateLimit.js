// 간단한 in-memory rate limiter (단일 인스턴스 기준).
// 다중 인스턴스/서버리스 배포 시엔 Redis/Upstash 기반으로 교체 필요.

const buckets = new Map(); // key → { count, resetAt }

/**
 * @param {string} key — identifier (e.g. user id, ip)
 * @param {object} opts — { limit, windowMs }
 * @returns {{ ok: boolean, remaining: number, resetIn: number }}
 */
export function rateLimit(key, { limit = 30, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetIn: windowMs };
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, resetIn: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, resetIn: bucket.resetAt - now };
}

/**
 * 앞서 rateLimit()으로 센 한 번을 되돌린다 — 「실패만 센다」가 필요한 곳(수업 해제: 맞는 암호는 예산을 쓰지 않는다).
 * 먼저 세고(동기 — 동시 요청이 한꺼번에 검사를 통과하지 못한다) 성공하면 돌려주는 순서라 무차별 대입 예산은 그대로다.
 */
export function releaseRateLimit(key) {
  const bucket = buckets.get(key);
  if (bucket && bucket.count > 0) bucket.count -= 1;
}

// 주기적 GC (10분마다 만료된 버킷 제거)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) {
      if (v.resetAt < now) buckets.delete(k);
    }
  }, 10 * 60_000).unref?.();
}

export function getClientKey(request, userId) {
  if (userId) return `u:${userId}`;
  const fwd = request.headers.get('x-forwarded-for') || '';
  const ip = fwd.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
  return `ip:${ip}`;
}
