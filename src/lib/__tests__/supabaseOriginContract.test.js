import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 계약: 앱 소스는 Supabase 주소·키를 박아 두지 않는다 — NEXT_PUBLIC_SUPABASE_URL / ANON_KEY만 쓴다.
 * 뷰어 generateMetadata가 운영 주소를 박아 e2e 목(server-fetch-mock)을 우회했고, CI 러너에서 그 실제 요청이
 * 멎자 /viewer 문서 응답이 30초 넘게 오지 않았다(2026-10-15, 여러 PR의 learning-flow 동시 실패).
 */

const ROOT = 'src';
const SOURCE = /\.(?:[cm]?js|jsx|tsx?)$/;
const TEST_FILE = /\.test\.[jt]sx?$/;
const HARDCODED = /https:\/\/[a-z0-9]{20}\.supabase\.co|sb_publishable_[A-Za-z0-9_]+/g;

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (SOURCE.test(name) && !TEST_FILE.test(name)) out.push(p);
  }
  return out;
}

describe('Supabase 주소는 환경 변수 정본만', () => {
  it('src 앱 소스에 프로젝트 주소·publishable 키 리터럴이 0이다', () => {
    const files = walk(ROOT, []);
    expect(files.length).toBeGreaterThan(200); // 스캐너가 비면(경로 붕괴) 여기서 잡힌다
    const violations = [];
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      for (const m of content.matchAll(HARDCODED)) {
        violations.push(`${f}:${content.slice(0, m.index).split('\n').length} — ${m[0].slice(0, 32)}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('뷰어 메타데이터는 정본 서버 클라이언트로 조회한다', () => {
    const page = fs.readFileSync('src/app/(app)/viewer/[id]/page.jsx', 'utf8');
    expect(page).toMatch(/import \{ createSupabaseServerClient \} from '@\/lib\/supabaseServer'/);
    expect(page).not.toMatch(/createServerClient\(/);
  });
});
