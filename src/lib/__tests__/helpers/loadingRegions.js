// 대기 문구를 직접 품은 JSX 요소를 찾는다(LOADING-ANNOUNCE-001 — docs/ui-conventions.md §3).
// 판정은 문자열 수준이다: 여는 태그부터 같은 이름의 첫 닫는 태그까지를 요소 안쪽으로 보고, 그 안에 대기 문구 글자(따옴표 안)가
// 있으면 대기 요소다. 버튼 · 선택지 글자(「저장 중…」 같은 상태어)는 알림 영역이 아니라 빼고 센다.
import fs from 'node:fs';
import path from 'node:path';

// 문구 표준(docs/design/copy-standard.md 로딩 줄)의 두 꼴 + 이 리포에 실제로 있는 대기 동사들.
export const LOADING_PHRASE = /(불러오는 중|불러오고 있어요|찾는 중|확인하는 중|확인 중…|확인하고 있어요|여는 중…|세는 중…|준비 중…|만드는 중…|번역 중…|펼치고 있어요|이동하고 있어요|분석하고 있어요|저장하고 있어요|글꼴을 불러오는 중이에요)/;
const SKIP_TAGS = new Set(['button', 'Button', 'option', 'Option', 'title', 'label']);
const QUOTED = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;

export function sourceFiles(root) {
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.jsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
    }
  })(path.join(root, 'src'));
  return out;
}

/** 파일 하나에서 대기 문구 요소들 — { line, tag, attrs, inner, phrase } */
export function loadingElements(source) {
  const found = [];
  const open = /<([A-Za-z][\w.]*)((?:\s+[\w:-]+(?:=(?:"[^"]*"|'[^']*'|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}))?)*)\s*>/g;
  for (const m of source.matchAll(open)) {
    const [whole, tag, attrs] = m;
    if (SKIP_TAGS.has(tag)) continue;
    const start = m.index + whole.length;
    const close = source.indexOf(`</${tag}>`, start);
    if (close < 0) continue;
    let inner = source.slice(start, close);
    // 안쪽에 다른 여는 태그가 있으면 그 앞까지만 이 요소의 글자로 본다(자식 요소의 글자는 자식이 갖는다).
    const child = inner.search(/<[A-Za-z]/);
    if (child >= 0) inner = inner.slice(0, child);
    const literals = [...inner.matchAll(QUOTED)].map((q) => q[2]);
    // JSX 글자(따옴표 밖 텍스트)도 본다 — 「<p>글과 문항 불러오는 중…</p>」
    const bare = inner.replace(/\{[^{}]*\}/g, ' ');
    const phrase = [...literals, bare].map((text) => text.match(LOADING_PHRASE)?.[0]).find(Boolean);
    if (!phrase) continue;
    // 바로 감싼 여는 태그(사이에 공백만) — 「<div role="status"><p>복습 준비 중…</p>」처럼 알림이 부모에 달린 경우를 본다.
    const wrapper = source.slice(Math.max(0, m.index - 400), m.index).match(/<([A-Za-z][\w.]*)((?:\s+[\w:-]+(?:=(?:"[^"]*"|'[^']*'|\{[^<>]*?\}))?)*)\s*>\s*$/);
    found.push({ line: source.slice(0, m.index).split('\n').length, tag, attrs, inner: inner.trim(), phrase, parentAttrs: wrapper ? wrapper[2] : '' });
  }
  return found;
}

/** 알림 역할(role=status · alert — 값이 식이어도) 또는 aria-live */
export const announces = (attrs) => /\brole=(?:"status"|"alert"|\{[^}]*['"](?:status|alert)['"][^}]*\})|\baria-live=/.test(attrs);
/** aria-busy(값 무관) */
export const busy = (attrs) => /\baria-busy=/.test(attrs);
/** 대기 동안만 켜지는 aria-busy(식) — 대기 뒤 결과를 싣는 영역이 대기 글만 미루는 꼴 */
export const deferredBusy = (attrs) => /\baria-busy=\{/.test(attrs);
/** 화면 낭독용 상시 영역(sr-only) */
export const srOnly = (attrs) => /\bclassName="sr-only"/.test(attrs);
/** 낭독 영역의 보이는 사본 */
export const hiddenCopy = (attrs) => /\baria-hidden="true"/.test(attrs);
/** 화면 전체 대기(규칙 ②) — 라우트 하나가 이 줄만 그리는 자리 */
export const pageLevel = (attrs) => /\bclassName="[^"]*\b(?:page-container|manabi-page|composer-gate)\b/.test(attrs);
