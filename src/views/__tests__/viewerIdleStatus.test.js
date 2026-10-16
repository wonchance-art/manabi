import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

/**
 * 계약: 미분석 자료('idle')도 원문을 보여 준다 (VIEWER-IDLE-001, 2026-10-17 KST).
 *
 * 공개 자료 123편 중 118편이 processed_json.status = 'idle' · sequence [] 였다(운영 읽기 실측). 뷰어는 미분석을
 * 'pending' · 'saved'로만 알아봐서 'idle'은 분석 중도 · 완료도 · 미분석도 아닌 상태가 됐고, 원문(raw_text)이 있는데도
 * 제목 아래가 비었다(/viewer/169 게스트 캡처). 'idle'을 쓰는 곳이 실제로 있으므로 뷰어가 같은 미분석으로 받는다.
 */
const read = path => fs.readFileSync(path, 'utf8');
const viewer = read('src/views/ViewerPage.jsx');

describe('뷰어 — 미분석 상태 판정', () => {
  const pendingLine = sliceBetween(viewer, 'const isPending = ', '\n');

  it("'idle'을 'pending' · 'saved'와 같은 미분석으로 본다", () => {
    for (const status of ['pending', 'saved', 'idle']) expect(pendingLine).toContain(`status === '${status}'`);
  });

  it('미분석이면 원문 줄을 그린다(showRaw가 isPending을 쓴다)', () => {
    expect(sliceBetween(viewer, 'const showRaw = ', ';')).toContain('isPending');
  });

  it("'idle'을 미분석 표지로 쓰는 곳이 실제로 있다 — 판정에서 빼면 그 자료들이 다시 빈 화면이 된다", () => {
    expect(read('src/app/api/admin/seed-starters/route.js')).toMatch(/sequence: \[\][^\n]*status: 'idle'/);
    expect(read('src/lib/bookMeta.js')).toContain("material?.processed_json?.status || 'idle'");
  });
});
