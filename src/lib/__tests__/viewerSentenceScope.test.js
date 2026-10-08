import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { openForSentence, sentencePanelBelongsToLine } from '../viewerSentenceScope.js';
import { cleanLineText } from '../sentenceNav.js';
import { sliceBetween } from './helpers/sliceBetween.js';

// 뷰어 v2 AE-R2 PR ① — [문장] 탭의 문장 키 결과를 그 결과를 만든 문장에만 붙인다.
// §5.1 더 쉽게·자세히 · §5.2 노트 저장 문장 · §1.2 단어를 누를 때 앞 문장 번역이 남는 결함.
// 실제 화면 재현은 e2e/viewer-focus-move.e2e.mjs의 AE-R2 시나리오 3건이 맡는다.

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('openForSentence — 결과는 만든 문장에서만 열려 있다(§5.1)', () => {
  const A = '眼前的体育场比照片上更壮观。';
  const B = '我们明天去公园。';

  it('같은 문장이면 열린 상태 그대로', () => {
    expect(openForSentence({ open: true, forText: A }, A)).toBe(true);
  });
  it('[문장] 탭 문장이 바뀌면 닫힌 상태로 그린다', () => {
    expect(openForSentence({ open: true, forText: A }, B)).toBe(false);
  });
  it('탭 문장이 비면(다른 줄 단어를 눌러 비운 뒤) 닫힌다', () => {
    expect(openForSentence({ open: true, forText: A }, '')).toBe(false);
  });
  it('닫혀 있으면 문장이 같아도 닫힘', () => {
    expect(openForSentence({ open: false, forText: A }, A)).toBe(false);
  });
  it('만든 문장을 모르면(빈 forText) 열지 않는다', () => {
    expect(openForSentence({ open: true, forText: '' }, '')).toBe(false);
    expect(openForSentence(null, A)).toBe(false);
  });
});

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

describe('훅 — 결과와 함께 그 결과의 문장(forText)을 든다', () => {
  for (const file of ['src/lib/useEasierText.js', 'src/lib/useGrammarDetail.js']) {
    const hook = codeOf(read(file));
    it(`${file}: run이 forText를 기록하고 reset이 비운다`, () => {
      expect(sliceBetween(hook, 'const reset = useCallback', '}, [cancel]);')).toContain("setForText('')");
      expect(sliceBetween(hook, 'const run = useCallback', 'try {')).toContain('setForText(text)');
      expect(hook).toMatch(/return \{[^}]*\bforText\b[^}]*\};/);
    });
  }
});

describe('ViewerPage 배선', () => {
  const page = codeOf(read('src/views/ViewerPage.jsx'));
  // [문장] 탭 마크업은 AE-R2 PR③(#1378)부터 renderSentencePanel 안에 있다(leftPanelContent는 그것을 부르기만 한다).
  const left = sliceBetween(page, 'const renderSentencePanel = () => {', '<ViewerUiLocaleProvider value={uiLocale}>');

  it('[더 쉽게]·[자세히]의 열림은 지금 탭 문장 기준 — 모든 문장 변경 경로를 한 자리에서 덮는다', () => {
    // 버튼 줄(닫힘)과 결과 칸(열림) 네 자리 모두 같은 판정(PR③ 배치: 버튼 한 줄 + 아래 결과 칸).
    expect(left).toContain('{!openForSentence(easier, leftPanelText) && (');
    expect(left).toContain('{!openForSentence(grammar, leftPanelText) && (');
    expect(left).toContain('{openForSentence(easier, leftPanelText) && (');
    expect(left).toContain('{openForSentence(grammar, leftPanelText) && (');
    expect(left).not.toMatch(/(?:easier|grammar)\.open\b/);
  });

  it('탭 문장이 바뀌면 진행 중 요청까지 끊는다(다른 문장 결과로 돌아오지 않게)', () => {
    expect(page).toContain('const resetGrammar = grammar.reset, resetEasier = easier.reset;');
    expect(page).toMatch(/useEffect\(\(\) => \{\s*if \(grammar\.forText && grammar\.forText !== leftPanelText\) resetGrammar\(\);\s*if \(easier\.forText && easier\.forText !== leftPanelText\) resetEasier\(\);\s*\}, \[leftPanelText, grammar\.forText, easier\.forText/);
  });

  it('노트 저장 문장 = 해설을 만든 문장(§5.2) — selectedRangeText가 아니다', () => {
    const save = sliceBetween(page, 'useGrammarNoteSave({', '});');
    expect(save).toContain('selectedText: grammar.forText');
    expect(save).not.toContain('selectedRangeText');
    expect(left).toContain('user && learningStorageSupported && grammar.result && grammar.forText && (');
  });

  it('다른 문장의 해설을 저장한 뒤에도 새 해설은 다시 저장할 수 있다', () => {
    expect(page).toMatch(/useEffect\(\(\) => \{ resetNoteSave\(\); \}, \[grammar\.forText, resetNoteSave\]\);/);
  });

  it('단어를 누르면 그 줄 밖 문장의 번역을 비운다 — 수업 모드 경로는 그대로', () => {
    const tap = sliceBetween(page, 'const handleTokenClick = (token, tokenId) => {', 'const resetWordPanelScroll');
    expect(tap).toMatch(/if \(!classStudyActive && !sentencePanelBelongsToLine\(leftPanelText, ctxSentenceOf\(t\)\)\) \{\s*setLeftPanelText\(''\);\s*setLeftPanelResult\(''\);\s*\}/);
  });
});
