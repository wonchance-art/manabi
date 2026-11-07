#!/usr/bin/env node
// 지역학 문서별 첫 화면 한글 하위 집합의 글자 목록(STUDIES-CLS-001, 2026-11-07 KST 오케스트레이터 결정 ③).
//
// 왜: 지역학 문서는 첫 그림 때 본문 한글을 시스템 글꼴로 그렸다가 Noto Sans KR 조각(문서당 28개 · 약 780KB)이 4초 넘어 와서 줄이 다시 흘렀다
// (운영 실측 CLS — jp-culture 0.0063 · kr-culture 0.0124 · fr-overview 0.0636). Noto Sans KR 한글은 모두 0.92em, 실험실 대체 글꼴은 1.0em이라
// 대체 글꼴로 그린 문단이 한 줄 길다. 문서마다 첫 화면에 보이는 한글(185–214자)만 담은 약 25KB를 첫 그림 전에 주면 교체가 없다
// (같은 출처 앞단 교대 실측 — CLS 0 · FCP−TTFB +0.07–0.10s). 지역학 전체 한글(801자 · 92KB)은 미리 받아도 첫 그림 뒤에 와서 CLS가 그대로였다.
//
// 글자 출처(이 함수가 정본): 셸(Layout · webNavigation) + 문서 화면 틀(StudiesDocPage — 이동 경로 · 「최종 갱신」) + 나라 이름 · 분야 이름 +
// 문서의 제목 · 요약 · 앞 절들(제목 · 문단 · 표) — 절 글자 수를 앞에서부터 더해 FIRST_SCREEN_TEXT에 닿는 절까지. PC 1280×800 첫 화면은 머리 +
// 본문 약 600–700자다(실측: kr-culture는 1 · 2절이 짧아 3절 앞부분까지 보이고, jp-culture는 2절에서 끝난다).
// 계약(src/components/fonts/__tests__/krViewerSubset.test.js)은 문서마다 「추출 글자 중 커밋된 목록에 있는 비율」을 본다 — 95% 이상이면 통과(빠진 글자 수와
// 재생성 명령을 경고로), 미만이면 실패. 작은 문구 수정은 막지 않고, 앞부분을 크게 고친 문서만 잡는다. 재생성: python3 scripts/fonts/kr-viewer-subset.py
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ROOT, stripComments } from './kr-viewer-chars.mjs';

/** 첫 화면으로 치는 절 글자 수 — 이 값에 닿는 절까지 담는다(적어도 한 절). */
export const FIRST_SCREEN_TEXT = 700;
export const STUDIES_STEM = 'noto-sans-kr-studies';
/** 굵기별 파일 — 본문 400 · 제목 700(StudiesDocPage의 h1 · h2 · 절 번호 800은 가장 가까운 700으로 맞춰진다). */
export const STUDIES_WEIGHTS = Object.freeze({ body: 400, head: 700 });
/** 문서 하위 집합 목록 파일(src/components/fonts/kr-viewer/ 아래) — 생성기가 쓰고, 문서 쪽이 읽는다. */
export const STUDIES_MANIFEST = 'studies-subsets.json';
/** 계약의 통과 기준 — 첫 화면 추출 글자 중 목록에 든 비율. */
export const MIN_COVERAGE = 0.95;

const CHROME_FILES = Object.freeze(['src/components/Layout.jsx', 'src/lib/webNavigation.js', 'src/views/StudiesDocPage.jsx']);
const HANGUL = /[가-힣]/gu;

const hangulOf = (text, set) => { for (const ch of String(text || '').match(HANGUL) || []) set.add(ch); };

/** 지역학 레지스트리 — 나라 · 문서 · 분야 이름. */
export async function loadStudies(root = ROOT) {
  return import(pathToFileURL(path.join(root, 'src/content/studies/index.js')).href);
}

/** 화면 틀(셸 · 문서 화면)의 한글 — 모든 문서 공통. */
export function chromeHangul(root = ROOT) {
  const set = new Set();
  for (const rel of CHROME_FILES) hangulOf(stripComments(fs.readFileSync(path.join(root, rel), 'utf8')), set);
  return set;
}

/**
 * 문서 하나의 첫 화면 한글 — { body, head } (정렬 · 중복 없음).
 * body = 400 굵기로 그리는 글자 전부(셸 · 이동 경로 · 요약 · 문단 · 표 — 제목 글자도 넣는다: 같은 글자가 본문에도 흔하고, 400 파일이 커지는 값은 작다).
 * head = 700 굵기로 그리는 글자(문서 제목 h1 · 절 제목 h2). 굵기마다 정적 파일 하나 — 가변 한 파일(모든 굵기)보다 약 30% 작다(실측 29.8 → 20.6KB).
 */
export function docFirstScreenHangul(studies, country, doc, chrome) {
  const body = new Set(chrome);
  const head = new Set();
  hangulOf(country.nameKo, body);
  hangulOf(studies.studyDomainLabel(doc.domain), body);
  hangulOf(doc.title, body);
  hangulOf(doc.title, head);
  hangulOf(doc.summary, body);
  let text = 0;
  for (const section of doc.sections) {
    const cells = [...(section.table?.head || []), ...(section.table?.rows || []).flat()].map(String);
    const parts = [section.heading, ...(section.paras || []), ...cells];
    for (const part of parts) hangulOf(part, body);
    hangulOf(section.heading, head);
    text += parts.join('').length;
    if (text >= FIRST_SCREEN_TEXT) break;
  }
  return { body: [...body].sort(), head: [...head].sort() };
}

/** 모든 문서 — [{ key: '<나라>/<slug>', slug, body, head }] (body · head는 글자 문자열). */
export async function studiesDocSubsets(root = ROOT) {
  const studies = await loadStudies(root);
  const chrome = chromeHangul(root);
  return studies.STUDY_COUNTRIES.flatMap((country) => country.docs.map((doc) => {
    const { body, head } = docFirstScreenHangul(studies, country, doc, chrome);
    return { key: `${country.id}/${doc.slug}`, slug: doc.slug, body: body.join(''), head: head.join('') };
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify(await studiesDocSubsets()));
}
