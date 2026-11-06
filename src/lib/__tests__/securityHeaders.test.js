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

  // SEC-HEADERS-001 — 최소 CSP는 보고만(Report-Only) · 스크립트 지시어 없음(정적/ISR 판 보존) · 보고는 우리 수신 경로 · COOP는 팝업 허용판.
  it('앱 본편 — CSP Report-Only 네 지시어 + 보고처 · 강제 CSP 없음 · COOP same-origin-allow-popups', () => {
    const h = headerMap(rules.find((rule) => rule.source === '/((?!embed/).*)'));
    expect(h['Content-Security-Policy']).toBeUndefined();
    const directives = Object.fromEntries(h['Content-Security-Policy-Report-Only'].split(';').map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values.join(' ')];
    }));
    expect(directives).toEqual({
      'object-src': "'none'", 'base-uri': "'self'", 'frame-ancestors': "'self'", 'form-action': "'self'",
      'report-uri': '/api/csp-report', 'report-to': 'csp',
    });
    expect(Object.keys(directives).some((name) => /^(script|style|default|connect|img|font)-src/.test(name))).toBe(false);
    expect(h['Reporting-Endpoints']).toBe('csp="/api/csp-report"');
    expect(h['Cross-Origin-Opener-Policy']).toBe('same-origin-allow-popups');
  });

  it('CSP 보고 수신 경로가 있고, 정리기가 정책의 지시어를 그대로 안다', async () => {
    const { CSP_DIRECTIVES } = await import('../cspReport');
    const h = headerMap(rules.find((rule) => rule.source === '/((?!embed/).*)'));
    const sent = h['Content-Security-Policy-Report-Only'].split(';').map((part) => part.trim().split(/\s+/)[0]).filter((name) => !name.startsWith('report-'));
    expect([...CSP_DIRECTIVES].sort()).toEqual(sent.sort());
    expect(fs.existsSync('src/app/api/csp-report/route.js')).toBe(true);
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
