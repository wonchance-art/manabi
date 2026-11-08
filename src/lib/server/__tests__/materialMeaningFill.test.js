import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { MEANING_FILL_PER_TICK, fillPublicEmptyMeanings } from '../materialMeaningFill';
import { sliceBetween } from '../../__tests__/helpers/sliceBetween.js';

// SEED-QA-002 C 계약 — 공개 영어 빈 뜻 토큰을 공유 사전으로 채우는 크론 단계. 규칙 · 권한 · 백업 · 복원은 PGlite supabase/tests/en-meaning-fill.mjs.
const db = (impl) => ({ rpc: vi.fn(impl) });

describe('fillPublicEmptyMeanings — fail-soft', () => {
  it('상한을 p_limit으로 넘기고 결과를 숫자로 정리한다', async () => {
    const client = db(async () => ({ data: { materials: 2, tokens: 5, ids: [1, 2], remaining: 3, unfillable: 25, more: true }, error: null }));
    expect(await fillPublicEmptyMeanings(client)).toEqual({ materials: 2, tokens: 5, remaining: 3, unfillable: 25, more: true });
    expect(client.rpc).toHaveBeenCalledWith('material_fill_empty_meanings', { p_limit: MEANING_FILL_PER_TICK });
    expect(MEANING_FILL_PER_TICK).toBe(50);
  });
  it('함수 없음(배포 순간)은 건너뜀 · RPC 오류 · throw는 error 문자열만(throw하지 않는다)', async () => {
    expect(await fillPublicEmptyMeanings(db(async () => ({ error: { code: 'PGRST202', message: 'x' } })))).toEqual({ skipped: 'rpc-missing' });
    expect(await fillPublicEmptyMeanings(db(async () => ({ error: { message: 'boom' } })))).toEqual({ error: 'boom' });
    expect(await fillPublicEmptyMeanings(db(async () => { throw new Error('down'); }))).toEqual({ error: 'down' });
  });
});

describe('배선 — 분석 작업 크론 사슬 끝, 난이도 앞, 실행 줄 detail', () => {
  const src = fs.readFileSync('src/app/api/cron/analysis-jobs/route.js', 'utf8');
  it('사슬 끝 구간에서만 부르고 detail.meaningFill에 남긴다', () => {
    const tail = sliceBetween(src, 'SEED-QA-002 C', 'OPS-HEALTH-001: 사슬 끝');
    expect(tail).toContain('const meaningFill = await fillPublicEmptyMeanings(supabase);');
    expect(tail).toContain('run.detail.meaningFill = meaningFill;');
    expect(tail.indexOf('fillPublicEmptyMeanings(supabase)')).toBeLessThan(tail.indexOf('refreshPublicDifficulty(supabase)'));
    // 다음 작업이 남아 tick을 이어 부르는 갈래(분석 중)에서는 부르지 않는다.
    expect(sliceBetween(src, 'async function analysisTick', 'SEED-QA-002 C')).not.toContain('fillPublicEmptyMeanings');
  });
  it('마이그레이션 · PGlite 계약이 있고 CI에 걸려 있다', () => {
    expect(fs.readFileSync('supabase/migrations/20261108060000_en_meaning_fill.sql', 'utf8')).toContain('CREATE OR REPLACE FUNCTION public.material_fill_empty_meanings(p_limit integer DEFAULT 50)');
    expect(fs.readFileSync('.github/workflows/ci.yml', 'utf8')).toContain('node supabase/tests/en-meaning-fill.mjs');
  });
});
