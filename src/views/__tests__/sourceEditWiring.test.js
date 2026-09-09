import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

// 배선 계약: ③ 원문 수정 + 증분 재분석(오너 승인 2026-08-19).
// 승인한 신뢰성 수리: 초안 분석 → 검증 → raw_text와 json을 함께 조건부 교체
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

  it('초안은 분석 성공 전까지 저장하지 않고 충돌도 차단한다', () => {
    const fn = viewer.match(/const handleSourceEditSave = async \(plan\) => \{[\s\S]*?\n  \};/)?.[0];
    expect(fn).toBeTruthy();
    expect(fn).not.toContain('.update(');
    expect(fn.indexOf('if (!plan.ok)')).toBeLessThan(fn.indexOf('await reanalyzeMutation.mutateAsync'));
    expect(fn).toContain('plan.expectedRaw !== material.raw_text');
    expect(fn).toContain('JSON.stringify(plan.expectedJson) !== JSON.stringify(material.processed_json)');
    expect(fn).toContain('await reanalyzeMutation.mutateAsync');
    expect(sliceBetween(fn, 'await reanalyzeMutation.mutateAsync')).toContain('setSourceEditOpen(false)');
  });

  it('분석 투입은 override 3종 — 방금 저장한 텍스트·리맵 json·변경 줄 목록', () => {
    expect(viewer).toContain('selectedLineIndices: plan.selected');
    expect(viewer).toContain('rawTextOverride: plan.newText');
    expect(viewer).toContain('baseJsonOverride: plan.remapped');
  });

  it('useReanalyze가 override를 받는다 — 부분 분석 baseJson과 initMeta 둘 다', () => {
    expect(reanalyze).toContain('rawTextOverride = null, baseJsonOverride = null');
    expect(reanalyze).toContain('let rawText = rawTextOverride || material?.raw_text');
    expect(reanalyze).toContain('runPreservedReanalysis(supabase, material, controller.signal, analyzeText');
    expect(reanalyze).toContain('fullReset, resume, selectedLineIndices, rawTextOverride, baseJsonOverride');
  });

  it('모달 — 계획은 순수 lib가 계산, 요약은 디바운스, 저장은 현재 초안으로 재계산', () => {
    expect(modal).toContain("import { buildEditPlan } from '../lib/sourceEdit'");
    expect(modal).toContain('setTimeout(() => setDebounced(draft), 300)');
    expect(modal).toContain('buildEditPlan(baseline.text, draft, baseline.json)');
    expect(modal).toContain('expectedRaw: baseline.text, expectedJson: baseline.json');
    expect(modal).toMatch(/disabled=\{saving \|\| !plan \|\| plan\.noop \|\| !plan\.ok\}/);
  });

  it('스타일 존재 — 오버레이·모달·텍스트영역·요약', () => {
    for (const cls of ['.source-edit-overlay', '.source-edit__textarea', '.source-edit__summary']) {
      expect(css).toContain(cls);
    }
  });
});
