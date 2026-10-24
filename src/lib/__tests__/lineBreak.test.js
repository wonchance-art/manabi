import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
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

  // 한국어 전용 내용만 담는 클래스 — 여기서만 keep-all을 다시 적어도 된다(일본어 · 중국어 컨테이너 안의 한국어 뜻 · 해설 등).
  // 그 밖의 클래스 규칙은 keep-all을 적지 않는다: 클래스 규칙은 [lang|="ja"] 되돌림보다 우선순위가 같거나 높아
  // lang="ja"를 단 제목에도 keep-all이 걸린다(M09 #1337 6164424314 — .manabi-page h3 · .learn-paragraph__sentence 선례).
  // src/content/textbookEditions/** 는 게시 판본 스냅숏이라 이 검사 밖이다.
  const KOREAN_ONLY = [
    '.tb-line__ko', '.course-day__ko', '.course-cal__tag', '.composer-save-actions button',
    // index.css — 문법 레퍼런스의 한국어 해설 · 한자 다리 노트 · 버전 배지(한국어 UI)
    '.version-badge__panel', '.fr-section__heading', '.fr-section__para', '.fr-callout__body', '.fr-parallel__note', '.hanja-bridge__note',
  ];

  it('keep-all은 정본 블록과 한국어 전용 클래스에만 — 다른 규칙이 lang 되돌림을 덮지 않는다', () => {
    const offenders = [];
    for (const { file, css } of sources) {
      if (file.startsWith(path.join('src', 'content', 'textbookEditions'))) continue;
      for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!/word-break\s*:\s*keep-all/.test(body)) continue;
        const sel = selector.trim();
        if (sel !== '[lang|="ko"]' && !KOREAN_ONLY.includes(sel)) offenders.push(`${file}: ${sel}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('JSX 인라인 스타일도 lang="ja|zh" 요소에 keep-all을 걸지 않는다', () => {
    const jsx = execSync('git ls-files "src/*.jsx" "src/**/*.jsx"', { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
    const offenders = jsx.filter((file) => /lang="(ja|zh)[^"]*"[^>]*wordBreak:\s*'keep-all'/.test(read(file)));
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
