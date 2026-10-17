#!/usr/bin/env node
// 빌드 산출 대조 — 화면별 글꼴 힌트 주소가 실제 산출 파일 · @font-face와 같은지 본다(FONT-HINT-001, 2026-10-17 KST).
//
// 단위 계약(src/app/__tests__/fontHints.test.js)은 "계산"만 지킨다. 이 검사는 빌드 결과에 대고
//   ① 힌트 파일이 .next/static/media에 있다(next 업그레이드로 파일 이름 규칙이 바뀌면 여기서 깨진다)
//   ② 그 글꼴의 @font-face는 힌트와 같은 주소를 가리키고, 미리 받기판(`.p`)은 없다(두 벌 선언 · 이중 다운로드 방지)
//   ③ 힌트 주소가 서버 번들에 실제로 들어갔다(세그먼트 layout이 env 값을 받았다)
// 를 확인한다. 사용: 빌드와 같은 NEXT_FONT_GOOGLE_MOCKED_RESPONSES로 `node scripts/fonts/check-font-hints.mjs [.next]`.
// CI는 e2e:build(대역 글꼴) 직후에 돌린다 — 빌드를 더 하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { FONT_HINTS, fontHintEnv } = require('./next-font-file-url.cjs');

/** 힌트 글꼴의 next/font family 이름 — 빌드 CSS의 @font-face에서 찾는다. */
const FAMILY = Object.freeze({ notoSans: 'Noto Sans' });

function walk(dir, pick, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, pick, out);
    else if (pick(p)) out.push(p);
  }
  return out;
}

/** 빌드 CSS에서 family별 @font-face src 주소를 모은다. */
export function fontFaceUrls(cssText, family) {
  const urls = [];
  for (const m of cssText.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const fam = /font-family:\s*(['"]?)([^;'"}]+)\1/.exec(m[1]);
    if (!fam || fam[2].trim() !== family) continue;
    for (const u of m[1].matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g)) urls.push(u[2]);
  }
  return urls;
}

/** 문제 목록을 돌려준다(빈 배열 = 통과). */
export function checkFontHints({ nextDir = '.next', env = process.env } = {}) {
  const problems = [];
  const hints = fontHintEnv(env);
  if (!Object.keys(hints).length) return ['NEXT_FONT_GOOGLE_MOCKED_RESPONSES가 없다 — 빌드와 같은 글꼴 입력으로 실행한다'];
  const css = walk(path.join(nextDir, 'static', 'css'), (p) => p.endsWith('.css')).map((p) => fs.readFileSync(p, 'utf8')).join('\n');
  const server = walk(path.join(nextDir, 'server'), (p) => /\.(js|rsc|html)$/.test(p));
  for (const [key, hint] of Object.entries(FONT_HINTS)) {
    const href = hints[hint.env];
    const file = path.join(nextDir, href.replace(/^\/_next\//, ''));
    if (!fs.existsSync(file)) problems.push(`① ${key}: 힌트 파일이 산출물에 없다 — ${href}`);
    const faces = [...new Set(fontFaceUrls(css, FAMILY[key]))];
    if (!faces.includes(href)) problems.push(`② ${key}: '${FAMILY[key]}' @font-face가 힌트 주소를 가리키지 않는다 — ${faces.join(', ') || '(없음)'}`);
    const preloaded = faces.filter((u) => /\.p\.woff2$/.test(u));
    if (preloaded.length) problems.push(`② ${key}: 미리 받기판 @font-face가 있다(두 벌 선언?) — ${preloaded.join(', ')}`);
    if (!server.some((p) => fs.readFileSync(p, 'utf8').includes(href))) problems.push(`③ ${key}: 힌트 주소가 서버 번들에 없다 — ${href}`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkFontHints({ nextDir: process.argv[2] || '.next' });
  if (problems.length) {
    console.error(`글꼴 힌트 산출 대조 실패:\n- ${problems.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log(`글꼴 힌트 산출 대조 통과: ${Object.values(fontHintEnv()).join(', ')}`);
  }
}
