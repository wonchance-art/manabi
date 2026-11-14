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

  // SEC-HEADERS-001 → SEC-CSP-002(2026-11-07) → SEC-CSP-003(2026-11-14 KST 오케스트레이터 승인) — 1단계 네 지시어만 **강제**, 출처 허용 목록(fetch 계열)은
  // 계속 Report-Only. 2단계 강제와 nonce 기반 엄격한 script-src는 다음 집계 뒤 판단 — 이 계약은 그 둘이 몰래 들어오지 않게 막는다.
  // 정책 정본은 src/lib/cspPolicy.js, 근거는 docs/security-csp.md.
  const directivesOf = (value) => Object.fromEntries(value.split(';').map((part) => {
    const [name, ...values] = part.trim().split(/\s+/);
    return [name, values.join(' ')];
  }));
  it('앱 본편 — 강제 CSP는 1단계 네 지시어 + 보고처뿐(스크립트 · 스타일 · 출처 목록 없음)', () => {
    const h = headerMap(rules.find((rule) => rule.source === '/((?!embed/).*)'));
    const enforced = directivesOf(h['Content-Security-Policy']);
    expect(Object.keys(enforced)).toEqual(['object-src', 'base-uri', 'frame-ancestors', 'form-action', 'report-uri', 'report-to']);
    expect(enforced).toMatchObject({ 'base-uri': "'self'", 'frame-ancestors': "'self'", 'form-action': "'self'", 'report-uri': '/api/csp-report', 'report-to': 'csp' });
    expect(h['Content-Security-Policy']).not.toMatch(/script-src|style-src|default-src|connect-src|img-src|'unsafe-|'nonce-/);
    expect(h['X-Frame-Options']).toBe('SAMEORIGIN'); // frame-ancestors 'self'와 같은 뜻 — 옛 브라우저용으로 둔다
  });
  it('object-src는 저장소 출처(https)만 — PDF 보기 기본 경로가 서명 URL을 <embed>로 띄운다(\'none\'이면 막힘, 실측)', async () => {
    const { cspEnforced, objectSrc } = await import('../cspPolicy');
    expect(objectSrc({ NEXT_PUBLIC_SUPABASE_URL: 'https://abcd.supabase.co' })).toBe('https://abcd.supabase.co');
    expect(objectSrc({})).toBe("'none'");
    expect(cspEnforced({ NEXT_PUBLIC_SUPABASE_URL: 'https://abcd.supabase.co' })).toMatch(/^object-src https:\/\/abcd\.supabase\.co; base-uri 'self'; frame-ancestors 'self'; form-action 'self';/);
    expect(fs.readFileSync('src/components/PdfDocument.jsx', 'utf8')).toContain('type="application/pdf"');
    expect(fs.readFileSync('src/views/PdfViewerPage.jsx', 'utf8')).toContain("createSignedUrl(");
  });
  it('외부로 보내는 form이 없다 — form-action \'self\'가 막을 것이 없다(<form>은 action · method 없이 JS로 처리)', () => {
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(`${dir}/${d.name}`) : /\.(jsx?|tsx?)$/.test(d.name) && !/\.test\./.test(d.name) ? [`${dir}/${d.name}`] : []);
    const forms = walk('src').flatMap((file) => (fs.readFileSync(file, 'utf8').match(/<form\b[^>]*>/g) || []).map((tag) => ({ file, tag })));
    expect(forms.length).toBeGreaterThan(10); // 공허 통과 방지
    expect(forms.filter(({ tag }) => /\baction=|\bmethod=|formAction/.test(tag))).toEqual([]);
  });
  it('앱 본편 — Report-Only는 출처 허용 목록(강제로 옮긴 셋은 뺌) · nonce 없음 · COOP same-origin-allow-popups', () => {
    const h = headerMap(rules.find((rule) => rule.source === '/((?!embed/).*)'));
    const directives = directivesOf(h['Content-Security-Policy-Report-Only']);
    expect(directives['base-uri']).toBeUndefined();
    expect(directives['frame-ancestors']).toBeUndefined();
    expect(directives['form-action']).toBeUndefined();
    expect(directives['object-src']).toBe(directivesOf(h['Content-Security-Policy'])['object-src']); // 빠지면 default-src 'self'가 대신 걸린다
    expect(directives).toMatchObject({
      'default-src': "'self'",
      'script-src': "'self' 'unsafe-inline'",
      'style-src': "'self' 'unsafe-inline'",
      'img-src': "'self' data: blob: https://i.ytimg.com",
      'font-src': "'self' data:",
      'media-src': "'self' blob: data:",
      'frame-src': 'https://www.youtube-nocookie.com',
      'worker-src': "'self' blob:",
      'manifest-src': "'self'",
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
