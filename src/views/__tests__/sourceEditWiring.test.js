import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 배선 계약: ③ 원문 수정 + 증분 재분석(오너 승인 2026-08-19).
// 핵심 순서: raw_text 확정 → 리맵 json + 변경 줄 목록을 override로 부분 분석
// 파이프라인에 투입(react-query 낡은 캐시 우회). 실패 계획(plan.ok=false)은
// DB에 아무것도 쓰지 않는다 — 자료 훼손 방지 가드가 저장보다 앞선다.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const modal = read('src/views/SourceEditModal.jsx');
const reanalyze = read('src/lib/useReanalyze.js');
const css = read('src/index.css');

describe('원문 수정 배선', () => {
  it('진입은 재분석 메뉴 3번째 항목 — 소유자 게이트(기존 재분석 블록) 안', () => {
    expect(viewer).toContain('원문 수정');
    expect(viewer).toContain('setSourceEditOpen(true)');
    // 모달 렌더도 소유자 한정
    expect(viewer).toMatch(/user\?\.id === material\?\.owner_id && \(\s*<SourceEditModal/);
  });

  it('저장 순서 — 가드 실패 시 DB 무접촉, raw_text 확정 후에만 분석 투입', () => {
    const fn = viewer.match(/const handleSourceEditSave = async \(plan\) => \{[\s\S]*?\n  \};/)?.[0];
    expect(fn).toBeTruthy();
    const guardAt = fn.indexOf("if (!plan.ok) { toast(plan.reason, 'error'); return; }");
    const rawWriteAt = fn.indexOf("update({ raw_text: plan.newText })");
    const mutateAt = fn.indexOf('reanalyzeMutation.mutate({');
    expect(guardAt).toBeGreaterThan(-1);
    expect(rawWriteAt).toBeGreaterThan(guardAt);
    expect(mutateAt).toBeGreaterThan(rawWriteAt);
    // raw_text 저장 실패 시 분석으로 넘어가지 않는다
    expect(fn).toContain("toast('원문 저장 실패 — ' + friendlyToastMessage(e), 'error');\n      return;");
  });

  it('분석 투입은 override 3종 — 방금 저장한 텍스트·리맵 json·변경 줄 목록', () => {
    expect(viewer).toContain('selectedLineIndices: plan.selected');
    expect(viewer).toContain('rawTextOverride: plan.newText');
    expect(viewer).toContain('baseJsonOverride: plan.remapped');
  });

  it('useReanalyze가 override를 받는다 — 부분 분석 baseJson과 initMeta 둘 다', () => {
    expect(reanalyze).toContain('rawTextOverride = null, baseJsonOverride = null');
    expect(reanalyze).toContain('let rawText = rawTextOverride || material?.raw_text');
    expect(reanalyze).toContain('baseJson = { ...(baseJsonOverride || material.processed_json), failed_indices: failedForPartial }');
    expect(reanalyze).toContain('...((baseJsonOverride || material.processed_json)?.metadata || {})');
  });

  it('모달 — 계획은 순수 lib가 계산, 요약은 디바운스, 저장은 현재 초안으로 재계산', () => {
    expect(modal).toContain("import { buildEditPlan } from '../lib/sourceEdit'");
    expect(modal).toContain('setTimeout(() => setDebounced(draft), 300)');
    expect(modal).toContain('onSave(buildEditPlan(initialText, draft, processedJson))');
    expect(modal).toMatch(/disabled=\{saving \|\| !plan \|\| plan\.noop \|\| !plan\.ok\}/);
  });

  it('스타일 존재 — 오버레이·모달·텍스트영역·요약', () => {
    for (const cls of ['.source-edit-overlay', '.source-edit__textarea', '.source-edit__summary']) {
      expect(css).toContain(cls);
    }
  });
});
