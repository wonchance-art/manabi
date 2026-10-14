import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';

/**
 * 계약: 줄바꿈 정본(LINE-BREAK-001, 오너 승인 2026-10-14 · docs/ui-conventions.md §7).
 * 한국어 = 어절 단위(keep-all), 일본어 · 중국어 = 일반 규칙. keep-all이 띄어쓰기 없는
 * 일본어 · 중국어에 걸리면 문장부호에서만 넘어가 줄이 넘친다 — class-course.css의
 * `.course-day__jp`가 lang="ja"를 달고도 클래스 규칙으로 keep-all을 덮어쓰던 선례.
 */

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const index = read('src/index.css');

function cssFiles(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(rel);
    return entry.name.endsWith('.css') ? [rel] : [];
  });
}
const sources = cssFiles('src').map((file) => ({ file, css: read(file).replace(/\/\*[\s\S]*?\*\//g, '') }));

describe('줄바꿈 정본 — 한국어 어절 · 일본어/중국어 일반', () => {
  const block = sliceBetween(index, 'LINE-BREAK-001', '/* 전역 무선택의 유일 예외');

  it('한국어는 lang 속성에서 keep-all을 상속하고, 일본어 · 중국어는 normal로 되돌린다', () => {
    expect(block).toContain('[lang|="ko"] { word-break: keep-all; }');
    expect(block).toContain('[lang|="ja"], [lang|="zh"] { word-break: normal; }');
    // :lang()은 모든 자손 요소에 직접 걸려 부모가 정한 값을 덮는다 — 속성 선택자 + 상속이 정본
    expect(block).not.toMatch(/:lang\((ja|zh|ko)\)\s*[,{]/);
  });

  it('긴 어절 · URL은 넘침만 막고(break-word), 제목은 balance', () => {
    expect(block).toContain('body { overflow-wrap: break-word; }');
    expect(block).toContain('h1, h2, h3 { text-wrap: balance; }');
  });

  it('학습 대상 언어 글을 담는 클래스 · :lang(ja|zh) 규칙에는 keep-all이 없다', () => {
    const offenders = [];
    for (const { file, css } of sources) {
      for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const targetLang = /__(jp|ja|zh)\b|:lang\((ja|zh)|\[lang\|?="?(ja|zh)/.test(selector);
        if (targetLang && /word-break\s*:\s*keep-all/.test(body)) offenders.push(`${file}: ${selector.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('word-break: break-all은 쓰지 않는다 — 한국어 · 영어 단어를 아무 데서나 끊는다', () => {
    const offenders = sources.filter(({ css }) => /word-break\s*:\s*break-all/.test(css)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('정본 문서가 같은 규칙을 말한다', () => {
    const doc = read('docs/ui-conventions.md');
    const section = sliceBetween(doc, '## 7. 줄바꿈');
    for (const phrase of ['어절', 'lang', 'keep-all', 'overflow-wrap', 'text-wrap: balance', 'break-all', 'lineBreak.test.js']) {
      expect(section).toContain(phrase);
    }
  });
});
