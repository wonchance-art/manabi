import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sentencePanelBelongsToLine } from '../viewerSentenceScope.js';
import { cleanLineText } from '../sentenceNav.js';
import { sliceBetween } from './helpers/sliceBetween.js';

// 뷰어 v2 AE-R2 PR ① — [문장] 탭의 문장 키 결과를 그 결과를 만든 문장에만 붙인다.
// §1.2 단어를 누를 때 앞 문장 번역이 남는 결함. (§5.1 더 쉽게·자세히 · §5.2 노트 저장은 [문장] 탭 개편으로 단추째 사라졌다.)
// 실제 화면 재현은 e2e/viewer-focus-move.e2e.mjs의 AE-R2 시나리오 3건이 맡는다.

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('sentencePanelBelongsToLine — 단어를 누른 줄과 [문장] 탭 내용(§1.2)', () => {
  const lines = ['眼前的体育场比照片上更壮观。', '她尽量别熬夜，要爱惜身体。', '# 第一课', '  我们明天去公园。  '];

  it('같은 줄의 막대 번역은 남긴다', () => {
    expect(sentencePanelBelongsToLine(cleanLineText(lines[0]), lines[0])).toBe(true);
  });
  it('제목 표지·앞뒤 공백을 걷은 막대 문장도 같은 줄로 본다', () => {
    expect(sentencePanelBelongsToLine(cleanLineText(lines[2]), lines[2])).toBe(true);
    expect(sentencePanelBelongsToLine(cleanLineText(lines[3]), lines[3])).toBe(true);
  });
  it('그 줄 안을 드래그한 구절도 남긴다', () => {
    expect(sentencePanelBelongsToLine('体育场比照片', lines[0])).toBe(true);
  });
  it('여러 줄 드래그는 그 줄 중 하나면 남긴다', () => {
    expect(sentencePanelBelongsToLine(`${lines[0]}\n${lines[1]}`, lines[1])).toBe(true);
  });
  it('다른 줄의 단어를 누르면 앞 문장 번역은 그 줄 것이 아니다', () => {
    expect(sentencePanelBelongsToLine(cleanLineText(lines[0]), lines[3])).toBe(false);
    expect(sentencePanelBelongsToLine(`${lines[0]}\n${lines[1]}`, lines[3])).toBe(false);
  });
  it('비어 있으면 비울 것이 없다 · 줄을 모르면 기존 동작 유지', () => {
    expect(sentencePanelBelongsToLine('', lines[0])).toBe(true);
    expect(sentencePanelBelongsToLine(lines[0], null)).toBe(true);
  });
});

describe('ViewerPage 배선', () => {
  const page = codeOf(read('src/views/ViewerPage.jsx'));

  it('단어를 누르면 그 줄 밖 문장의 번역을 비운다 — 수업 모드 경로는 그대로', () => {
    const tap = sliceBetween(page, 'const handleTokenClick = (token, tokenId) => {', 'const resetWordPanelScroll');
    expect(tap).toMatch(/if \(!classStudyActive && !sentencePanelBelongsToLine\(leftPanelText, ctxSentenceOf\(t\)\)\) \{\s*setLeftPanelText\(''\);\s*setLeftPanelResult\(''\);\s*\}/);
  });
});
