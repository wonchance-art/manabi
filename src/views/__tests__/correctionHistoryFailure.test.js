import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

// TOKEN-CORRECTIONS-BIGINT-001 — 교정 이력(token_corrections) 저장 실패를 조용히 삼키지 않는다.
// 재분석 보존기는 이 이력으로만 뜻·발음·품사 교정을 되살린다(reanalysisPreservation.js) — 이력을 못 남기면
// 다음 재분석에서 교정이 사라지므로, 교정 자체는 유지하되 오류를 보고하고 학습자에게 알린다.
// DB 쪽(타입 bigint로 맞추기·보존)은 supabase/tests/token-corrections-material-type.mjs가 실제 PostgreSQL로 검사한다.

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('교정 이력 저장 실패', () => {
  const viewer = read('src/views/ViewerPage.jsx');
  const mutation = sliceBetween(viewer, 'const correctTokenMutation = useMutation({', 'onError:');

  it('뜻 교정: 이력 insert 오류를 reportError로 남기고, 교정은 성공으로 유지한 채 경고 토스트를 띄운다', () => {
    expect(mutation).toContain("reportError(logError, { where: 'token_corrections insert', materialId: id, tokenId })");
    // 교정은 성공으로 유지(throw 없음) — 조용한 교정(카드 사전 뜻 줄·목록)에도 경고는 띄운다. quiet는 성공 토스트만 끈다.
    const failed = sliceBetween(mutation, 'if (logError) {', '\n        }');
    expect(failed).toContain("toast(CORRECTION_HISTORY_FAILED, 'warning', 8000)");
    expect(failed).not.toMatch(/throw|quiet/);
  });

  it('경고 문구는 화면 문구 표준(해요체 · 두 문장 · 보존 여부)을 따른다', () => {
    const copy = viewer.match(/const CORRECTION_HISTORY_FAILED = '([^']+)'/)?.[1];
    expect(copy).toBe('고친 내용은 저장했지만 기록을 남기지 못했어요. 자료를 다시 분석하면 이 수정이 사라질 수 있어요.');
  });

  it('경계 교정: 이력 실패를 console.warn이 아니라 reportError로 남긴다(경계 자체는 metadata.viewerBoundaries에 저장)', () => {
    const flow = read('src/lib/boundaryEditFlow.js');
    const log = sliceBetween(flow, 'async function logBoundaryHistory', '\n}\n');
    expect(log).toContain("client.from('token_corrections').insert(");
    expect(log).not.toContain('console.warn');
    expect(log.match(/reportError\(/g)).toHaveLength(2);
  });

  it('정방향 마이그레이션이 material_id를 reading_materials.id와 같은 bigint로 맞춘다', () => {
    const sql = read('supabase/migrations/20261013150000_token_corrections_material_bigint.sql');
    expect(sql).toContain('material_id bigint NOT NULL');
    expect(sql).toContain('ALTER COLUMN material_id TYPE bigint USING material_id::text::bigint');
    expect(sql).toContain('REFERENCES public.reading_materials(id) ON DELETE CASCADE');
    // 비파괴: 행을 지우거나 표를 버리지 않는다.
    expect(sql).not.toMatch(/\b(DROP TABLE|TRUNCATE|DELETE FROM)\b/i);
  });
});
