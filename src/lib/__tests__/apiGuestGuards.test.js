import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 계약(API-ABUSE-001 · 2026-11-08 KST, 오케스트레이터 14:30 「손님이 부를 수 있는 API 남용 방어 점검」):
 * 로그인 없이 부를 수 있는 /api/** 경로는 아래 표에 **이름을 올리고**, 표에 적은 방어를 코드에 지닌다.
 *  · 쓰기(POST) 손님 경로 — 분당 상한(rateLimit) + 본문 상한(readLimited · content-length · MAX_)
 *  · 비용이 드는 손님 경로(TTS 등) — 분당 상한 + 하루 상한(consumeDailyQuota)
 *  · 읽기(GET) 손님 경로 — 정적(force-static) 또는 공개 CDN 캐시, 아니면 표에 이유를 적은 예외
 * 표에 없는 손님 경로가 생기면 이 시험이 깨진다 — 새 경로는 방어를 정하고 표에 올린다.
 * 「손님 경로」 판정 = 인증 관문(requireUser · requireAdmin · getUser · CRON_SECRET · 팀/노트/중계 인증 · 관리자 출판 헬퍼)이 소스에 없음.
 */
const API_DIR = 'src/app/api';
const AUTH = /requireUser|requireAdmin|isAdminUser|auth\.getUser|CRON_SECRET|authorizeTeamRequest|noteAuth|identifyRelayAgent|createBookPublishHandlers|from '@\/app\/api\/admin\//;

function routes(dir = API_DIR) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return routes(p);
    return e.name === 'route.js' ? [p] : [];
  });
}
const routeKey = (file) => file.slice(API_DIR.length).replace(/\/route\.js$/, '') || '/';

const RL = /rateLimit\(|isRateLimited\(|rateLimitMap/;
const CAP = /readLimited\(|content-length|MAX_[A-Z_]+/;
const QUOTA = /consumeDailyQuota|dailyQuotaGate/;
const STATIC = /dynamic = 'force-static'/;
const PUBLIC_CACHE = /public, (s-)?max-age|PUBLIC_[A-Z_]*CACHE|_CACHE\b/;

/** 손님 경로 표 — guard: post(분당 + 본문) · cost(분당 + 하루) · static · cache · delegated(같은 방어를 지닌 정본 경로에 위임) · exempt(이유). */
const GUEST = {
  '/auth/password-check': { guard: 'post', why: 'HIBP 범위 조회(무료) — IP 분당 20' },
  '/client-error': { guard: 'post', why: '오류 기록 — DB 쪽 분당 30 · 하루 1000' },
  '/csp-report': { guard: 'post', why: 'CSP 보고 — DB 쪽 상한' },
  '/vitals': { guard: 'post', why: 'CLS 0.1 초과 방문만' },
  '/review/drills': { guard: 'post', why: '게스트 문법 복습 조립 — 공개 콘텐츠만, 행 60' },
  '/class/[team]/unlock': { guard: 'post', why: '팀 암호 — IP 분당 10, 해시 전에 본문 · 암호 길이 컷(운영은 SHARE_LINK_SECRET 없음 = 503)' },
  '/tts': { guard: 'cost', why: '음성 합성 — IP 분당 + IP 해시 하루 5000, 1년 immutable 캐시' },
  '/goal-catalog': { guard: 'static' },
  '/level-index/chinese': { guard: 'static' },
  '/level-index/japanese': { guard: 'static' },
  '/level-tiles/[lang]/[level]': { guard: 'static' },
  '/level-words/[lang]/[level]': { guard: 'static' },
  '/zh-ref/[shard]': { guard: 'static' },
  '/suggestions/[id]': { guard: 'cache' },
  '/suggestions/today': { guard: 'cache', why: '찾은 날만 CDN 60초(+ stale 300초), 빈 날은 no-store' },
  '/books/japanese-n5/[edition]/reading': { guard: 'cache' },
  '/books/japanese-n3/[edition]/reading': { guard: 'delegated', to: '/books/japanese-n5/[edition]/reading' },
  '/books/japanese-n4/[edition]/reading': { guard: 'delegated', to: '/books/japanese-n5/[edition]/reading' },
  '/books/japanese-n3/[edition]/asset': { guard: 'delegated', to: '/books/japanese-n5/[edition]/asset' },
  '/books/japanese-n4/[edition]/asset': { guard: 'delegated', to: '/books/japanese-n5/[edition]/asset' },
  '/version': { guard: 'exempt', why: '배포 판 확인 — 관리자 · 디버그 배지만 마운트 때 한 번(폴링 금지 계약)' },
  '/world/time': { guard: 'exempt', why: '서버 시각 한 줄 — DB · 외부 호출 없음' },
};

const files = routes();
const src = Object.fromEntries(files.map((f) => [routeKey(f), fs.readFileSync(f, 'utf8')]));
const guestKeys = Object.keys(src).filter((k) => !AUTH.test(src[k])).sort();

describe('API-ABUSE-001 손님 경로 표', () => {
  it('인증 관문이 없는 경로는 모두 표에 있고, 표의 경로는 모두 실제로 있다', () => {
    expect(guestKeys).toEqual(Object.keys(GUEST).sort());
  });

  for (const [key, rule] of Object.entries(GUEST)) {
    it(`${key} — ${rule.guard}${rule.why ? ` (${rule.why})` : ''}`, () => {
      const s = src[key];
      expect(s, key).toBeTruthy();
      if (rule.guard === 'post') { expect(s).toMatch(RL); expect(s).toMatch(CAP); }
      if (rule.guard === 'cost') { expect(s).toMatch(RL); expect(s).toMatch(QUOTA); }
      if (rule.guard === 'static') { expect(s).toMatch(STATIC); expect(s).toMatch(PUBLIC_CACHE); }
      if (rule.guard === 'cache') expect(s).toMatch(PUBLIC_CACHE);
      if (rule.guard === 'delegated') expect(s).toContain(`@/app/api${rule.to}/route`);
      if (rule.guard === 'exempt') expect(rule.why).toBeTruthy();
      // 손님 경로는 LLM · 외부 AI를 부르지 않는다(TTS는 표의 cost 방어로만).
      if (rule.guard !== 'cost') expect(s).not.toMatch(/@\/lib\/server\/llm|callLLM|generativelanguage|anthropic/);
    });
  }
});

describe('API-ABUSE-001 동작', () => {
  it('게스트 복습 화면은 서버가 쓰는 60행만 보낸다', () => {
    expect(fs.readFileSync('src/views/GuestGrammarReview.jsx', 'utf8')).toContain('JSON.stringify({ rows: due.slice(0, 60) })');
    expect(src['/review/drills']).toContain('const MAX_ROWS = 60;');
  });

  it('suggestions/today — 찾은 날만 공개 캐시, 빈 날(자정 수집 전 · 조회 실패)은 no-store', async () => {
    vi.resetModules();
    let rows = [{ id: 'a' }];
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));
    vi.doMock('@/lib/server/suggestionReading', () => ({ todaySuggestions: async () => rows }));
    const { GET } = await import('@/app/api/suggestions/today/route');
    const hit = await GET();
    expect(hit.headers.get('cache-control')).toBe('public, s-maxage=60, stale-while-revalidate=300');
    expect(await hit.json()).toEqual([{ id: 'a' }]);
    rows = [];
    expect((await GET()).headers.get('cache-control')).toBe('no-store');
    vi.doUnmock('@supabase/supabase-js');
    vi.doUnmock('@/lib/server/suggestionReading');
  });

  it('review/drills — 큰 본문(256KB 초과)은 413(선언 길이 · 실제 길이) · 밀린 큐 1,000행은 통과 · 같은 IP 분당 30을 넘으면 429', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/review/drills/route');
    const req = (body, headers = {}) => new Request('http://x/api/review/drills', {
      method: 'POST', body, headers: { 'content-type': 'application/json', 'x-forwarded-for': headers.ip || '203.0.113.7', ...headers },
    });
    const big = JSON.stringify({ rows: [], pad: 'x'.repeat(300 * 1024) });
    expect((await POST(req(big, { ip: '203.0.113.1' }))).status).toBe(413);
    // content-length를 거짓으로 작게 보내도 실제로 읽은 바이트로 자른다
    expect((await POST(req(big, { ip: '203.0.113.2', 'content-length': '10' }))).status).toBe(413);
    // 기기 큐에 밀린 복습 1,000행(약 200KB)도 막히지 않는다 — 서버는 앞 60행만 쓴다
    const backlog = Array.from({ length: 1000 }, (_, i) => ({ lang: 'ja', slug: `x-${i}`, interval: 1, ease_factor: 2.5, repetitions: 1, next_review_at: '2026-11-08T00:00:00.000Z' }));
    expect((await POST(req(JSON.stringify({ rows: backlog }), { ip: '203.0.113.4' }))).status).toBe(200);
    const ok = await POST(req(JSON.stringify({ rows: [] }), { ip: '203.0.113.3' }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ items: [] });
    let last;
    for (let i = 0; i < 31; i += 1) last = await POST(req(JSON.stringify({ rows: [] }), { ip: '203.0.113.9' }));
    expect(last.status).toBe(429);
  });
});
