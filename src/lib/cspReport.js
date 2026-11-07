// CSP 위반 보고 정리(SEC-HEADERS-001) — /api/csp-report가 받은 본문을 오류 기록(ERROR-OBSERVE-001 observe_record_error) 한 줄로 바꾼다.
// 받는 모양 둘:
//   ⑴ report-uri(옛 방식 — Firefox · Safari): Content-Type application/csp-report, 본문 { "csp-report": { "document-uri", "effective-directive" | "violated-directive", "blocked-uri", ... } }
//   ⑵ Reporting API(report-to — Chromium): application/reports+json, 본문 [{ type: 'csp-violation', body: { documentURL, effectiveDirective, blockedURL, disposition, ... } }]
// 남기는 것: 지시어 이름 · 막힌 것의 출처(origin)나 'inline' · 'eval' 같은 낱말 · 문서 경로의 틀(sanitizeRoute — ID는 :id). 전체 주소 · 쿼리 · 소스 조각(sample)은
// 남기지 않는다(확장 프로그램 · 개인 주소가 섞인다). 계정 · IP와 잇지 않는다.
import { sanitizeRoute } from './errorEvent';
import { CSP_REPORTED_DIRECTIVES } from './cspPolicy';

/** 우리가 보내는 정책의 지시어와 그 세분 이름(lib/cspPolicy) — 이 밖의 지시어 보고는 버린다(브라우저 · 확장의 잡음). */
export const CSP_DIRECTIVES = CSP_REPORTED_DIRECTIVES;
export const MAX_REPORTS_PER_BODY = 5;
const KEYWORDS = new Set(['inline', 'eval', 'data', 'blob', 'self', 'wasm-eval', 'trusted-types-policy', 'trusted-types-sink']);

/** 'object-src' · "object-src 'none'"(옛 violated-directive는 값까지 온다) → 'object-src'. 우리 정책 밖이면 null. */
export function directiveOf(value) {
  const name = String(value || '').trim().split(/\s+/)[0].toLowerCase();
  return CSP_DIRECTIVES.includes(name) ? name : null;
}

/** 막힌 것 → 출처만: 'https://evil.example/x?y' → 'https://evil.example' · 'inline' · 'data:' → 'data' · 그 밖 'other'. */
export function blockedOf(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'none';
  const word = raw.replace(/:$/, '').toLowerCase();
  if (KEYWORDS.has(word)) return word;
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin.slice(0, 120);
    return url.protocol.replace(/:$/, '').replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'other';
  } catch {
    return 'other';
  }
}

function one(report) {
  if (!report || typeof report !== 'object') return null;
  const directive = directiveOf(report.effectiveDirective ?? report['effective-directive'] ?? report.violatedDirective ?? report['violated-directive']);
  if (!directive) return null;
  const blocked = blockedOf(report.blockedURL ?? report['blocked-uri']);
  const disposition = String(report.disposition || 'report').toLowerCase() === 'enforce' ? 'enforce' : 'report';
  return {
    kind: `csp.${directive}`,
    message: `${directive} ${disposition}: ${blocked}`,
    route: sanitizeRoute(report.documentURL ?? report['document-uri']) || null,
  };
}

/** 본문(JSON 파싱 결과) → 정리된 위반 목록(같은 줄은 하나로, 최대 MAX_REPORTS_PER_BODY). 모르는 모양은 []. */
export function parseCspReportBody(body) {
  const raw = Array.isArray(body)
    ? body.filter((r) => r && r.type === 'csp-violation').map((r) => r.body)
    : body && typeof body === 'object' && body['csp-report'] ? [body['csp-report']] : [];
  const seen = new Set();
  const out = [];
  for (const report of raw.slice(0, MAX_REPORTS_PER_BODY * 2)) {
    const event = one(report);
    if (!event) continue;
    const key = `${event.kind}|${event.message}|${event.route}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
    if (out.length >= MAX_REPORTS_PER_BODY) break;
  }
  return out;
}
