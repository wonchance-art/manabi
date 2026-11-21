// CLS-COMPOSER-001(2026-11-21 KST) — 운영 vitals.cls에서 잡힌 밀림(composer-gate 0.18 · 0.61)을 로컬 프로덕션 빌드 + 대역으로
// 재현해 고친 자리를 고정한다. 측정(전 → 후)과 근거는 PR 본문. 화면에 드러난 뒤의 모습은 바꾸지 않는다 — 기다리는 동안의 자리 · 깨진 중간 상태만.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween';

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('작성기 저장 → 자동 이동(CLS-COMPOSER-001)', () => {
  const composer = read('src/components/materials/MaterialComposer.jsx');
  it('이동 중에는 「저장됨」 관문을 그리지 않는다 — 관문은 넘어가지 못했을 때만', () => {
    expect(composer).toContain('if (draft.savedId && !leaving) return <section className="composer-gate">');
    expect(composer).not.toMatch(/if \(draft\.savedId\) return <section className="composer-gate">/);
  });
  it('저장이 끝나 이동을 시작하기 전에 표시를 세우고, 모음집 담기 실패 · 오류에서 내린다', () => {
    const submit = sliceBetween(composer, 'const record = await save(', 'finally { submitRef.current = false;');
    expect(submit.indexOf('setLeaving(true)')).toBeGreaterThan(-1);
    expect(submit.indexOf('setLeaving(true)')).toBeLessThan(submit.indexOf('setDraft(saved)'));
    expect(submit.indexOf('setLeaving(true)')).toBeLessThan(submit.indexOf('router.push('));
    expect(submit).toMatch(/catch \{ if\(alive\.current\)\{setLeaving\(false\);setError\('자료는 저장했지만 모음집에 담지 못했어요/);
    expect(submit).toMatch(/catch \(err\) \{ if \(alive\.current\) \{ setLeaving\(false\);/);
  });
  it('이동 중에도 단계 문구(「저장했어요. 자료를 열고 있어요…」)가 남는다', () => {
    expect(composer).toContain('<span role="status">{busy || leaving ? stage : draftStatus}</span>');
  });
  it('불러오는 상태 칸은 작성기 자리만큼(화면 높이) 잡아 둔다 — 푸터가 화면 안에서 밀리지 않게', () => {
    expect(composer).toContain('if (!draft) return <div className="composer-gate" role="status">');
    expect(read('src/components/materials/material-composer.css')).toContain('.composer-gate[role="status"] { min-height: 100dvh; }');
  });
});
