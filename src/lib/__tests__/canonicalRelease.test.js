import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CANONICAL_BOOK_KEY_PREFIXES } from '../canonicalBookKey';

// 정본 발행 기록(CANON-RELEASE-001) 계약 — 실제 PostgreSQL 검사는 supabase/tests/canonical-book-releases.mjs(CI)가 한다.
// 여기서는 문장 모양으로 세 가지가 갈리지 않게 잡는다: ⑴ SQL의 key 접두사 = 생성기 접두사(canonicalBookKey.js)
// ⑵ 외래 키 없음 — profiles · auth.users에 내부 트리거가 붙으면 학습 지문이 어긋난다(CONV-LOBBY-001)
// ⑶ Supabase 기본 권한을 걷고 읽기 · 관리자 쓰기만 다시 준다(VIEW-WRITE-GRANT-001 선례).
const SQL = readFileSync(path.join(process.cwd(), 'supabase/migrations/20261022081000_canonical_book_releases.sql'), 'utf8');
const code = SQL.replace(/--[^\n]*/g, '');

describe('정본 발행 기록 마이그레이션', () => {
  it('key 접두사가 정본 key 생성기와 같다(표 검사 · 서가 · 채우기 모두)', () => {
    const prefixes = CANONICAL_BOOK_KEY_PREFIXES.map((prefix) => prefix.slice(0, -1)).join('|');
    const shapes = [...code.matchAll(/'\^\(([a-z|]+)\)-/g)].map((match) => match[1]);
    expect(shapes.length).toBeGreaterThanOrEqual(3);
    for (const shape of shapes) expect(shape).toBe(prefixes);
  });
  it('외래 키를 두지 않는다', () => {
    expect(code).not.toMatch(/\breferences\b/i);
  });
  it('기본 권한을 걷고 읽기 · 관리자 본인 쓰기만 — 고치기 · 지우기는 화면에서 하지 않는다', () => {
    expect(code).toMatch(/REVOKE ALL ON public\.canonical_book_releases FROM PUBLIC, anon, authenticated;/);
    expect(code).toMatch(/GRANT SELECT ON public\.canonical_book_releases TO anon, authenticated;/);
    expect(code).toMatch(/GRANT INSERT ON public\.canonical_book_releases TO authenticated;/);
    expect(code).not.toMatch(/GRANT[^;]*\b(UPDATE|DELETE|ALL)\b[^;]*ON public\.canonical_book_releases/i);
    expect(code).toMatch(/WITH CHECK \(\(SELECT public\.is_admin\(\)\) AND owner_id = \(SELECT auth\.uid\(\)\)\)/);
    expect(code).toMatch(/ENABLE ROW LEVEL SECURITY/);
  });
  it('서가 함수는 발행 기록의 소유자 · 공개 장만 잇는다(위조 공개 글은 소유자가 달라 빠진다)', () => {
    expect(code).toMatch(/ON m\.owner_id = r\.owner_id\s+AND m\.processed_json #>> '\{metadata,book,key\}' = r\.book_key\s+AND m\.visibility = 'public'/);
    expect(code).toMatch(/GRANT EXECUTE ON FUNCTION public\.canonical_book_shelf\(\) TO anon, authenticated;/);
  });
});
