// MIC-POLICY-001 — 공통 보안 헤더 계약(next.config.mjs headers()를 실제로 불러 본다).
// 2026-11-06 KST 운영 감사: Permissions-Policy `microphone=()`가 대화 모드 말하기(ConversationThread — SpeechRecognition · getUserMedia)와
// 월드 음성(lib/world/voice.js getUserMedia)을 권한 창 없이 막았다. 마이크만 같은 출처(self)로 열고 나머지 보안 헤더는 그대로 둔다.
import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import nextConfig from '../../../next.config.mjs';

const headerMap = (rule) => Object.fromEntries(rule.headers.map(({ key, value }) => [key, value]));
const policy = (value) => Object.fromEntries(value.split(',').map((part) => part.trim().split('=')));

let rules;
beforeAll(async () => { rules = await nextConfig.headers(); });

describe('공통 보안 헤더', () => {
  it('앱 본편(/embed 밖) — HSTS · nosniff · SAMEORIGIN · Referrer-Policy · Permissions-Policy', () => {
    const app = rules.find((rule) => rule.source === '/((?!embed/).*)');
    const h = headerMap(app);
    expect(h['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains; preload');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(policy(h['Permissions-Policy'])).toEqual({ camera: '()', microphone: '(self)', geolocation: '()', 'interest-cohort': '()' });
  });

  // SEC-HEADERS-001 → SEC-CSP-002(2026-11-07 KST 오케스트레이터 승인) — CSP는 **보고만**: 출처 허용 목록(fetch 계열 지시어)은 Report-Only 헤더에만 있고,
  // 강제 헤더(Content-Security-Policy)는 앱 본편에 없다. 강제 전환과 nonce 기반 엄격한 script-src는 오너 결정 항목이다(정적/ISR 판 · 막힌 기능 노출) —
  // 이 계약은 그 둘이 몰래 들어오지 않게 막는다. 정책 정본은 src/lib/cspPolicy.js, 근거는 docs/security-csp.md.
  it('앱 본편 — CSP는 Report-Only만(출처 허용 목록 + 보고처) · 강제 CSP 없음 · nonce 없음 · COOP same-origin-allow-popups', () => {
    const h = headerMap(rules.find((rule) => rule.source === '/((?!embed/).*)'));
    expect(h['Content-Security-Policy']).toBeUndefined(); // 강제 전환은 오너 결정
    const directives = Object.fromEntries(h['Content-Security-Policy-Report-Only'].split(';').map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values.join(' ')];
    }));
    expect(directives).toMatchObject({
      'default-src': "'self'",
      'script-src': "'self' 'unsafe-inline'",
      'style-src': "'self' 'unsafe-inline'",
      'img-src': "'self' data: blob:",
      'font-src': "'self' data:",
      'media-src': "'self' blob: data:",
      'frame-src': 'https://www.youtube-nocookie.com',
      'worker-src': "'self' blob:",
      'manifest-src': "'self'",
      'object-src': "'none'", 'base-uri': "'self'", 'frame-ancestors': "'self'", 'form-action': "'self'",
      'report-uri': '/api/csp-report', 'report-to': 'csp',
    });
    expect(directives['connect-src'].split(' ')[0]).toBe("'self'");
    expect(h['Content-Security-Policy-Report-Only']).not.toMatch(/'nonce-|'strict-dynamic'|'unsafe-eval'/); // nonce · 엄격 판은 오너 결정
    expect(h['Reporting-Endpoints']).toBe('csp="/api/csp-report"');
    expect(h['Cross-Origin-Opener-Policy']).toBe('same-origin-allow-popups');
  });

  it('connect-src는 Supabase 공개 URL에서 https · wss를 만든다 — 주소를 직접 적지 않는다', async () => {
    const { cspReportOnly, supabaseOrigins } = await import('../cspPolicy');
    expect(supabaseOrigins('https://abcd.supabase.co')).toEqual(['https://abcd.supabase.co', 'wss://abcd.supabase.co']);
    expect(supabaseOrigins('not a url')).toEqual([]);
    expect(supabaseOrigins('http://insecure.example')).toEqual([]);
    expect(cspReportOnly({ NEXT_PUBLIC_SUPABASE_URL: 'https://abcd.supabase.co' })).toContain("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co;");
    expect(cspReportOnly({})).toContain("connect-src 'self';");
    expect(fs.readFileSync('next.config.mjs', 'utf8')).not.toMatch(/supabase\.co/);
  });

  it('CSP 보고 수신 경로가 있고, 정리기가 정책의 지시어를 모두 안다(세분 이름 -elem · -attr 포함)', async () => {
    const { CSP_DIRECTIVES } = await import('../cspReport');
    const h = headerMap(rules.find((rule) => rule.source === '/((?!embed/).*)'));
    const sent = h['Content-Security-Policy-Report-Only'].split(';').map((part) => part.trim().split(/\s+/)[0]).filter((name) => !name.startsWith('report-'));
    for (const name of sent) expect(CSP_DIRECTIVES, name).toContain(name);
    for (const name of ['script-src-elem', 'script-src-attr', 'style-src-elem', 'style-src-attr']) expect(CSP_DIRECTIVES).toContain(name);
    expect(fs.existsSync('src/app/api/csp-report/route.js')).toBe(true);
  });

  it('보고가 쏟아져도 막힌다 — 수신 경로 클라이언트 · 인스턴스 분당 한도 · 본문당 상한 · DB 시간 칸 합치기와 하루 상한', () => {
    const route = fs.readFileSync('src/app/api/csp-report/route.js', 'utf8');
    expect(route).toContain('const PER_CLIENT = { limit: 20, windowMs: 60_000 };');
    expect(route).toContain('const PER_INSTANCE = { limit: 120, windowMs: 60_000 };');
    expect(fs.readFileSync('src/lib/cspReport.js', 'utf8')).toContain('export const MAX_REPORTS_PER_BODY = 5;');
    const sql = fs.readFileSync('supabase/migrations/20261106180000_error_events.sql', 'utf8');
    expect(sql).toMatch(/분당 30 · 하루 1000/); // 새 줄 상한(ERROR-OBSERVE-001)
    expect(sql).toContain('CONSTRAINT error_events_fingerprint_bucket_key UNIQUE (fingerprint, bucket)'); // 같은 위반은 한 시간 한 줄(hits만 오름)
  });

  it('임베드(/embed/*) — 같은 공통 헤더 + 어디서나 프레이밍(frame-ancestors *), X-Frame-Options 없음', () => {
    const embed = rules.find((rule) => rule.source === '/embed/:path*');
    const h = headerMap(embed);
    expect(h['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains; preload');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Content-Security-Policy']).toBe('frame-ancestors *');
    expect(h['X-Frame-Options']).toBeUndefined();
    // 임베드는 남의 페이지 안에서 뜬다 — 본편의 Report-Only(frame-ancestors 'self')를 싣지 않는다(싣으면 임베드마다 위반 보고).
    expect(h['Content-Security-Policy-Report-Only']).toBeUndefined();
    expect(policy(h['Permissions-Policy']).microphone).toBe('(self)');
    expect(policy(h['Permissions-Policy']).camera).toBe('()');
  });

  it('마이크를 쓰는 화면이 실제로 있다(정책을 연 이유) — 사라지면 이 허용도 다시 본다', () => {
    expect(fs.readFileSync('src/components/conversation/ConversationThread.jsx', 'utf8')).toMatch(/SpeechRecognition/);
    expect(fs.readFileSync('src/lib/world/voice.js', 'utf8')).toMatch(/getUserMedia\(\{ audio: true \}\)/);
  });
});
