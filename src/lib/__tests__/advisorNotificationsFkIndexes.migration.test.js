import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

/**
 * 계약(ADVISOR-RECHECK-002 · 2026-11-07 KST): 어드바이저 정리는 학습 계약 지문 밖만 고친다.
 * capability(9표 정책 · 인덱스) · core(fsrs_*) · activity(profiles) 지문 표를 건드리지 않고, 사후 검사가 지문 넷 + capability 정의를 다시 잰다.
 * DB 동작(접근 행렬 · 복원 · 운영 사슬 지문)은 supabase/tests/advisor-notifications-fk-indexes.mjs(PGlite, CI).
 */
const read = (p) => fs.readFileSync(p, 'utf8');
const code = (sql) => sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');

describe('ADVISOR-RECHECK-002 — notifications 중복 정책 · 지문 밖 FK 인덱스', () => {
  const mig = code(read('supabase/migrations/20261107050000_advisor_notifications_fk_indexes.sql'));
  const rollback = code(read('docs/sql/advisor-notifications-fk-indexes-20261107-rollback.sql'));

  it('바꾸는 대상은 notifications 정책 3개 · daily_suggestions · reading_progress 인덱스뿐', () => {
    expect([...mig.matchAll(/DROP POLICY (\w+) ON public\.(\w+)/g)].map((m) => `${m[2]}.${m[1]}`)).toEqual([
      'notifications.insert_notifications', 'notifications.read_own_notifications', 'notifications.update_own_notifications',
    ]);
    expect([...mig.matchAll(/CREATE INDEX IF NOT EXISTS \w+ ON public\.(\w+)/g)].map((m) => m[1])).toEqual(['daily_suggestions', 'reading_progress']);
    expect(mig).not.toMatch(/ALTER POLICY|CREATE POLICY|ALTER TABLE|DROP INDEX/);
  });

  it('지문 표를 건드리지 않는다 · 사후 검사가 지문 넷과 capability 정의를 다시 잰다', () => {
    const ddl = mig.split('\n').filter((l) => /^(DROP|CREATE INDEX|ALTER)/.test(l)).join('\n');
    expect(ddl).not.toMatch(/user_vocabulary|vocabulary_exclusions|reading_materials|uploaded_pdfs|user_known_words|review_events|profiles|fsrs_/);
    for (const fn of ['contract_hash_live', 'manual_contract_hash_live', 'admission_contract_hash_live', 'activity_profile_hash_live']) expect(mig).toContain(`'${fn}'`);
    expect(mig).toMatch(/proname = 'learning_language_capabilities'/);
    expect(mig).toMatch(/learning contract fingerprint changed — abort/);
    expect(mig).not.toMatch(/learning_language_capabilities\(\)/); // 부르지 않는다(db push엔 로그인 맥락이 없다 — 11/6 실측)
  });

  it('복원 SQL은 지운 정책 3개를 운영 식으로 다시 만들고 인덱스 2개를 지운다', () => {
    expect([...rollback.matchAll(/CREATE POLICY (\w+) ON public\.notifications/g)].map((m) => m[1]).sort()).toEqual([
      'insert_notifications', 'read_own_notifications', 'update_own_notifications',
    ]);
    expect(rollback).toMatch(/DROP INDEX IF EXISTS public\.daily_suggestions_material_id_idx/);
    expect(rollback).toMatch(/DROP INDEX IF EXISTS public\.reading_progress_material_id_idx/);
  });

  it('DB 계약이 CI에서 돈다', () => {
    expect(read('.github/workflows/ci.yml')).toContain('node supabase/tests/advisor-notifications-fk-indexes.mjs');
  });
});
