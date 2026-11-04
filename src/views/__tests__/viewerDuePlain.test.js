// 뷰어 복습 표시 걷기(VIEWER-DUE-PLAIN-001 — 오너 지시 2026-11-02 KST 「뷰어에 복습 모양 없애줘. 너무 복잡해져」).
// 복습 대상 토큰은 늘 저장 클래스(.word-token--saved)와 함께 붙으므로, 복습 전용 규칙이 없으면 저장 단어와 같은 모양이다.
// 클래스(.word-token--due)는 상태로 남는다(채점 뒤 복습 해제를 보는 e2e). 복습 개수는 머리의 「N개 복습 가능」이 알린다.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = f => fs.readFileSync(path.join(process.cwd(), f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// .word-token--due가 들어간 선택자 중 「저장과 함께 묶은 기하(:is(saved, due))」가 아닌 것 = 복습 전용 규칙
const dueOnlySelectors = css => [...css.matchAll(/([^{}]*\.word-token--due[^{}]*)\{/g)].map(m => m[1].trim())
  .filter(sel => !/:is\(\.word-token--saved,\s?\.word-token--due\)/.test(sel));

describe('뷰어 복습 표시 0', () => {
  it('index.css · reader-controls.css에 복습 전용 규칙이 없다(펄스 · 주황 띠 · 점 · 주황 밑줄 · 선택선)', () => {
    for (const f of ['src/index.css', 'src/components/viewer/reader-controls.css']) {
      expect(dueOnlySelectors(read(f)), f).toEqual([]);
      expect(read(f), f).not.toMatch(/due-pulse|--ws-due/);
    }
  });
  it('상태 범례에 복습 견본이 없다 · 안내 문구도 저장 단어만', () => {
    const settings = read('src/components/viewer/ViewerSettings.jsx');
    expect(settings).toContain("[['new','새 단어'],['saved','학습 중']]");
    expect(settings).not.toContain("['due','복습']");
    expect(settings).toContain('새 단어는 옅은 파랑과 밑줄, 저장한 단어는 노란 띠로 표시해요');
  });
  it('클래스는 남는다 — 본문 · 미리보기가 복습 상태를 계속 표시한다(e2e가 채점 뒤 해제를 본다)', () => {
    expect(read('src/views/ViewerPage.jsx')).toContain("${isDue ? 'word-token--due' : ''}");
    expect(read('src/components/viewer/ViewerPreview.jsx')).toContain("token.previewDue&&'word-token--due'");
  });
});
