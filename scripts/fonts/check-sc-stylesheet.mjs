#!/usr/bin/env node
// 빌드 산출 대조 — 간체 중국어 독립 스타일시트가 글꼴 입력 · public 산출 · next/font 선언과 맞는지 본다(SC-LINK-001 1단계, 2026-10-17 KST).
//
// 단위 계약(src/app/__tests__/scStylesheet.test.js)은 "계산"만 지킨다. 이 검사는 빌드 결과에 대고
//   ① env 주소의 CSS가 public에 있고, 지금 글꼴 입력으로 다시 계산한 본문과 같다(옛 산출물 · 다른 입력이 섞이지 않았다)
//   ② CSS가 가리키는 글꼴이 모두 public에 있고, 파일 이름 = 바이트 해시(오래 캐시해도 내용이 바뀌지 않는다)
//   ③ 같은 빌드에서 next/font가 낸 'Noto Sans SC' @font-face와 굵기 · unicode-range 쌍이 같다(바꿔 걸어도 덮는 글자가 같다)
// 를 확인한다. 사용: 빌드와 같은 NEXT_FONT_GOOGLE_MOCKED_RESPONSES로 `node scripts/fonts/check-sc-stylesheet.mjs [.next] [public]`.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { SC_STYLESHEET, scStylesheet } = require('./sc-stylesheet.cjs');

function walk(dir, pick, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, pick, out);
    else if (pick(p)) out.push(p);
  }
  return out;
}

/**
 * unicode-range를 값으로 맞춘다 — 빌드 CSS 압축기는 같은 범위를 다르게 쓴다(`U+0000-00FF` → `u+00??`, 실측 e2e:build).
 * 토큰마다 [시작, 끝] 정수로 바꿔(?는 시작 0 · 끝 f) 정렬 · 병합한 뒤 `시작-끝` 16진 목록으로 돌려준다.
 */
export function normalizeRange(text) {
  const spans = String(text || '').split(',').map((t) => t.trim().toLowerCase().replace(/^u\+/, '')).filter(Boolean).map((t) => {
    const [a, b] = t.includes('-') ? t.split('-') : [t.replace(/\?/g, '0'), t.replace(/\?/g, 'f')];
    return [parseInt(a, 16), parseInt(b, 16)];
  }).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const merged = [];
  for (const [a, b] of spans) {
    const last = merged.at(-1);
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b); else merged.push([a, b]);
  }
  return merged.map(([a, b]) => `${a.toString(16)}-${b.toString(16)}`).join(',');
}

/** CSS에서 family별 (굵기 | unicode-range) 쌍을 모은다 — 정렬된 목록(범위는 값으로 맞춘 꼴). */
export function faceKeys(cssText, family) {
  const keys = [];
  for (const m of cssText.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const fam = /font-family:\s*(['"]?)([^;'"}]+)\1/.exec(m[1])?.[2]?.trim();
    if (fam !== family) continue;
    const weight = /font-weight:\s*([^;}]+)/.exec(m[1])?.[1]?.trim();
    const range = normalizeRange(/unicode-range:\s*([^;}]+)/.exec(m[1])?.[1] || '');
    keys.push(`${weight}|${range}`);
  }
  return keys.sort();
}

/** 문제 목록을 돌려준다(빈 배열 = 통과). */
export function checkScStylesheet({ nextDir = '.next', publicDir = 'public', env = process.env } = {}) {
  const modulePath = env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES;
  if (!modulePath) return ['NEXT_FONT_GOOGLE_MOCKED_RESPONSES가 없다 — 빌드와 같은 글꼴 입력으로 실행한다'];
  const problems = [];
  const expected = scStylesheet(require(modulePath));
  const cssFile = path.join(publicDir, ...expected.href.slice(1).split('/'));
  if (!fs.existsSync(cssFile)) problems.push(`① CSS가 public에 없다 — ${expected.href}`);
  else if (fs.readFileSync(cssFile, 'utf8') !== expected.css) problems.push(`① public CSS 본문이 지금 글꼴 입력과 다르다 — ${expected.href}`);
  for (const { name } of expected.files) {
    const file = path.join(publicDir, ...SC_STYLESHEET.publicDir.split('/'), name);
    if (!fs.existsSync(file)) { problems.push(`② 글꼴이 public에 없다 — ${name}`); continue; }
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
    if (`${hash}.woff2` !== name) problems.push(`② 파일 이름이 바이트 해시와 다르다 — ${name} (실제 ${hash})`);
  }
  const built = walk(path.join(nextDir, 'static', 'css'), (p) => p.endsWith('.css')).map((p) => fs.readFileSync(p, 'utf8')).join('\n');
  const nextFont = faceKeys(built, SC_STYLESHEET.family);
  const ours = faceKeys(expected.css, SC_STYLESHEET.family);
  if (!nextFont.length) problems.push(`③ 빌드 CSS에 next/font '${SC_STYLESHEET.family}' @font-face가 없다 — 대조 기준이 없다`);
  else if ([...new Set(nextFont)].join('\n') !== [...new Set(ours)].join('\n')) problems.push(`③ next/font와 굵기 · unicode-range가 다르다(next ${new Set(nextFont).size}쌍 · 독립 ${new Set(ours).size}쌍)`);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkScStylesheet({ nextDir: process.argv[2] || '.next', publicDir: process.argv[3] || 'public' });
  if (problems.length) {
    console.error(`간체 독립 스타일시트 산출 대조 실패:\n- ${problems.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log('간체 독립 스타일시트 산출 대조 통과');
  }
}
