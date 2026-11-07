import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

/**
 * 계약(ORPHAN-MATERIALS-001 · 2026-11-07 KST): 주인 없는 비공개 자료 정리는 백업(마이그레이션) → 삭제(docs/sql, 오너 실행 확인 창) → 복원이
 * 같은 id 목록을 쓰고, 삭제 SQL은 백업 · 참조 · 행 수를 스스로 확인한다. DB 동작은 supabase/tests/orphan-private-materials.mjs(PGlite, CI).
 */
const read = (p) => fs.readFileSync(p, 'utf8');
const idsOf = (sql) => (sql.match(/array\[([0-9,\s]+)\]/) || [])[1]?.split(',').map(Number);

describe('ORPHAN-MATERIALS-001 — 백업 · 삭제 · 복원', () => {
  const backup = read('supabase/migrations/20261107030000_backup_orphan_private_materials.sql');
  const del = read('docs/sql/orphan-private-materials-20261107-delete.sql');
  const restore = read('docs/sql/orphan-private-materials-20261107-restore.sql');

  it('백업과 삭제가 같은 10개 id를 쓴다', () => {
    expect(idsOf(backup)).toEqual([1, 5, 7, 13, 14, 15, 16, 17, 18, 30]);
    expect(idsOf(del)).toEqual(idsOf(backup));
  });

  it('마이그레이션은 지우지 않는다(백업만) · 삭제 SQL은 백업 · 참조 · 행 수를 확인한다', () => {
    expect(backup).not.toMatch(/delete\s+from\s+public\.reading_materials/i);
    expect(del).toMatch(/backup table missing/);
    expect(del).toMatch(/confrelid = 'public\.reading_materials'::regclass/);
    expect(del).toMatch(/deleted <> cardinality\(ids\)/);
    expect(restore).toMatch(/OVERRIDING SYSTEM VALUE/);
    expect(restore).toMatch(/WHERE NOT EXISTS/);
  });

  it('DB 계약이 CI에서 돈다', () => {
    expect(read('.github/workflows/ci.yml')).toContain('node supabase/tests/orphan-private-materials.mjs');
  });
});
