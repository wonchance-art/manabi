/**
 * 계약 테스트 전용 CSS 훑개 — PWA-SHELL-001(pwaShell.test.js)에서 쓰던 것을 NATIVE-FEEL-001(nativeFeel.test.js)과 함께 쓰려고 옮겼다.
 * 두 계약이 같은 규칙 단위(선택자 · 본문 · 감싼 @규칙)로 CSS를 읽어야 판정이 갈리지 않는다.
 * __tests__/ 아래라 번들에 실리지 않고, *.test.js가 아니라 vitest가 테스트로 오인하지 않는다(sliceBetween 선례).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

/** src 아래 CSS 파일 전부(교재 판본 스냅숏 제외 — 별도 문서라 앱 셸 밖이다). 경로는 리포 루트 기준. */
export function cssFiles(dir = path.join(ROOT, 'src')) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'textbookEditions' ? [] : cssFiles(p);
    return e.name.endsWith('.css') ? [path.relative(ROOT, p)] : [];
  });
}

/** CSS를 규칙 단위로 훑는다 — 각 규칙의 선택자 · 본문 · 감싼 @규칙 조건들(바깥부터). 주석은 지운다. */
export function rulesOf(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const stack = [];
  let buf = '';
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === '{') {
      const head = buf.trim(); buf = '';
      if (head.startsWith('@')) { stack.push(head); continue; }
      const end = css.indexOf('}', i);
      rules.push({ selector: head, body: css.slice(i + 1, end), at: [...stack] });
      i = end;
    } else if (ch === '}') {
      stack.pop(); buf = '';
    } else if (ch === ';' && buf.trim().startsWith('@')) {
      buf = ''; // @import · @charset 같은 한 줄 @규칙
    } else {
      buf += ch;
    }
  }
  return rules;
}
