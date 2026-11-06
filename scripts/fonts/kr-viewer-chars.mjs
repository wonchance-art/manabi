#!/usr/bin/env node
// 뷰어 한글 하위 집합의 글자 목록 — 출처는 뷰어 · 공통 셸의 UI 문자열(KR-VIEWER-SUBSET-001, 2026-11-07 KST 오케스트레이터 승인 (가)안).
//
// 왜: 뷰어 첫 화면은 서로 다른 한글이 90자 남짓인데, Google의 Noto Sans KR 조각(unicode-range 124개)에 흩어져 10개 · 약 157KB를 받았다
// (운영 실측). 그 바이트가 스크립트(Low)보다 높은 우선순위(VeryHigh)로 대역을 나눠 하이드레이션을 늦췄다. 뷰어가 그리는 UI 한글을 한 파일
// (약 50KB)로 묶어 먼저 주면 대부분의 조각을 받지 않는다. 묶음에 없는 글자(자료 본문 · 사용자 글)는 원래 조각으로 저절로 넘어간다
// (같은 family의 unicode-range 규칙) — 이 목록은 성능용이지 정확성 조건이 아니다.
//
// 글자 출처(이 목록이 정본): 아래 SOURCES의 파일에서 주석을 걷은 원문의 한글 음절(U+AC00–U+D7A3). 문구가 바뀌면 CI 계약
// (src/components/fonts/__tests__/krViewerSubset.test.js)이 「추출 ⊆ 커밋된 목록」으로 잡고, 재생성은 scripts/fonts/kr-viewer-subset.py.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** 뷰어에서 그려지는 UI 문자열이 사는 곳 — 뷰어 화면 · 뷰어 부품 · 뷰어 문구표 · 공통 셸(머리 · 아래 메뉴). */
export const SOURCES = Object.freeze([
  { dir: 'src/views', pick: /^Viewer.*\.jsx$/ },
  { dir: 'src/components/viewer', pick: /\.(jsx|js)$/ },
  { file: 'src/lib/viewerMessages.js' },
  { file: 'src/components/Layout.jsx' },
  { file: 'src/lib/webNavigation.js' },
]);

const HANGUL = /[가-힣]/gu;

/** 주석을 걷는다 — 설명 주석의 한글을 화면 글자로 세지 않게(문자열 안의 // 는 드물고, 세어도 목록이 조금 넓어질 뿐이다). */
export function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

export function sourceFiles(root = ROOT) {
  const out = [];
  for (const s of SOURCES) {
    if (s.file) { out.push(s.file); continue; }
    for (const name of fs.readdirSync(path.join(root, s.dir)).sort()) {
      if (s.pick.test(name) && !/\.test\./.test(name)) out.push(`${s.dir}/${name}`);
    }
  }
  return out;
}

/** 출처 파일들의 한글 음절 — 정렬 · 중복 없음. */
export function extractViewerHangul(root = ROOT) {
  const set = new Set();
  for (const rel of sourceFiles(root)) {
    for (const ch of stripComments(fs.readFileSync(path.join(root, rel), 'utf8')).match(HANGUL) || []) set.add(ch);
  }
  return [...set].sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(extractViewerHangul().join(''));
