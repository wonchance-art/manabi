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
