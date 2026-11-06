import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// SUPA-SSR-0127 — supabase-js 2.102부터 postgrest GET은 네트워크 오류 · 503 · 520에 1 · 2 · 4초 백오프로 다시 묻는다(기본 켜짐).
// 판 올림 전(2.100) 이 앱은 실패를 바로 받아 폴백했다: 서버 화면은 기본 제목 · 불러오기 그림, API는 오류 응답, 브라우저는 기기 캐시.
// 기본값을 그대로 두면 끊긴 Supabase에서 조회 하나가 7초 늦게 실패한다(로컬 실측: 기본 7,059 ms · retry:false 1 ms, CI e2e는 30분 제한을 넘겼다).
// 재시도 정책은 이 판 올림의 범위가 아니다 → 앱이 만드는 모든 클라이언트(브라우저 · 서버 · 미들웨어 · 라우트)는 `db: { retry: false }`를 싣는다.
// 재시도를 켜려면 이 계약을 바꾸는 별도 결정으로 한다.

const ROOT = join(__dirname, '..', '..', '..');
const SRC = join(ROOT, 'src');
const FACTORY = /\b(createClient|createServerClient|createBrowserClient)\(/g;
const SKIP = /(__tests__|\.test\.|\.spec\.)/;

function sourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(m?js|jsx)$/.test(name) && !SKIP.test(p)) out.push(p);
  }
  return out;
}

// 여는 괄호부터 짝이 맞는 닫는 괄호까지(문자열 · 템플릿 안 괄호는 이 저장소의 호출부에 없다 — 짝이 안 맞으면 throw).
function callText(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '(') depth += 1;
    else if (src[i] === ')') { depth -= 1; if (depth === 0) return src.substring(open, i + 1); }
  }
  throw new Error(`괄호 짝 없음 @${open}`);
}

function factoryCalls() {
  const calls = [];
  for (const file of sourceFiles(SRC)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(FACTORY)) {
      const before = src.substring(Math.max(0, m.index - 9), m.index);
      if (/function\s*$|import\s*\{?\s*$/.test(before)) continue; // 정의 · import 줄은 호출이 아니다
      const line = src.substring(0, m.index).split('\n').length;
      calls.push({ at: `${relative(ROOT, file)}:${line}`, name: m[1], text: callText(src, m.index + m[0].length - 1) });
    }
  }
  return calls;
}

describe('Supabase 클라이언트 — 조회 자동 재시도 끔(판 올림 전 동작 유지)', () => {
  const calls = factoryCalls();

  it('앱이 만드는 클라이언트를 실제로 찾는다(공허 통과 방지)', () => {
    expect(calls.length).toBeGreaterThanOrEqual(50);
    const names = new Set(calls.map((c) => c.name));
    expect(names).toEqual(new Set(['createClient', 'createServerClient', 'createBrowserClient']));
    expect(calls.some((c) => c.at.startsWith('src/middleware.js'))).toBe(true);
    expect(calls.some((c) => c.at.startsWith('src/lib/supabaseServer.js'))).toBe(true);
    expect(calls.some((c) => c.at.startsWith('src/lib/supabaseClient.js'))).toBe(true);
  });

  it('모든 호출이 db: { retry: false }를 싣는다 — 조건부 옵션이면 두 갈래 모두', () => {
    const missing = calls.filter((c) => {
      const n = (c.text.match(/db:\s*\{\s*retry:\s*false\s*\}/g) || []).length;
      // 옵션 인자 자체가 `key ? { … } : { … }`인 호출(fetch-suggestions · pushSend). 옵션 안쪽의 삼항(headers 등)은 해당하지 않는다.
      const conditional = /,\s*\w+\s*\?\s*\{\s*(db|auth)\b/.test(c.text);
      return conditional ? n < 2 : n < 1;
    }).map((c) => c.at);
    expect(missing).toEqual([]);
  });
});
