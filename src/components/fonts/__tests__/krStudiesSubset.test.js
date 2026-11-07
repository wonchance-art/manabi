import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MIN_COVERAGE, STUDIES_MANIFEST, STUDIES_REST_WEIGHTS, STUDIES_STEM, STUDIES_WEIGHTS, studiesDocSubsets } from '../../../../scripts/fonts/kr-studies-chars.mjs';
import { STUDY_COUNTRIES } from '../../../content/studies';
import { studiesSubsetCss, studiesSubsetEntry } from '../kr-viewer/KrStudiesSubset';

// STUDIES-CLS-001 — 지역학 문서별 첫 화면 한글 하위 집합(본문 400 · 제목 700 정적 파일). 첫 그림 전에 받아 본문 한글이 대체 글꼴 → Noto Sans KR로
// 바뀌며 줄이 다시 흐르지 않게 한다(운영 CLS fr-overview 0.0636 · kr-culture 0.0124 · jp-culture 0.0063 → 같은 출처 앞단 0).
// 계약(오케스트레이터 결정 2026-11-07): 문서마다 「첫 화면 추출 글자 중 커밋된 목록에 있는 비율」이 95% 이상이면 통과 — 빠진 글자는 경고로만 알린다
// (조각으로 폴백하니 화면은 맞고, 이동만 다시 생길 수 있다). 95% 미만(문서 앞부분을 크게 고침 · 새 문서)이면 실패.
const REGEN = 'python3 -m pip install fonttools brotli && python3 scripts/fonts/kr-viewer-subset.py';
const ROOT = process.cwd();
const DIR = path.join(ROOT, 'src/components/fonts/kr-viewer');
const PUBLIC = path.join(ROOT, 'public/fonts/kr-viewer');
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, STUDIES_MANIFEST), 'utf8'));
const extracted = await studiesDocSubsets(ROOT);
const PARTS = Object.keys(STUDIES_WEIGHTS);
const REST = Object.keys(STUDIES_REST_WEIGHTS); // 나머지(미리 받지 않음, STUDIES-REST-001)
const ALL_WEIGHTS = { ...STUDIES_WEIGHTS, ...STUDIES_REST_WEIGHTS };

const expandRange = (text) => text.split(',').flatMap((part) => {
  const [a, b] = part.trim().replace(/^U\+/i, '').split('-').map((h) => parseInt(h, 16));
  return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i);
});

describe('지역학 문서별 첫 화면 한글 하위 집합', () => {
  it('지역학 문서마다 목록이 있다(새 문서는 재생성해야 첫 화면이 같은 글꼴로 그려진다)', () => {
    const keys = STUDY_COUNTRIES.flatMap((c) => c.docs.map((d) => `${c.id}/${d.slug}`)).sort();
    expect(keys.length).toBeGreaterThan(20); // 공허 통과 방지
    expect(extracted.map((d) => d.key).sort()).toEqual(keys);
    const missing = keys.filter((k) => !manifest.docs[k]);
    expect(missing, `목록 없는 문서 ${missing.join(', ')} — ${REGEN}`).toEqual([]);
  });

  it.each([...PARTS, ...REST])('%s: 추출 글자의 95% 이상이 목록에 있다(빠진 글자는 경고 — 조각으로 폴백)', (part) => {
    const low = [];
    for (const doc of extracted) {
      const e = manifest.docs[doc.key]?.[part];
      // skipped = Noto Sans KR에 없는 글자(일본 신자체 등) — 원래도 다음 글꼴이 그리므로 덮은 것으로 센다.
      const have = new Set((e?.chars || '') + (e?.skipped || ''));
      const want = [...doc[part]];
      if (part === 'body') expect(want.length, doc.key).toBeGreaterThan(100);
      if (part === 'head') expect(want.length, doc.key).toBeGreaterThan(5);
      if (!want.length) continue;
      const out = want.filter((ch) => !have.has(ch));
      const coverage = 1 - out.length / want.length;
      if (out.length) console.warn(`[STUDIES-CLS-001] ${doc.key} ${part}: 목록 밖 ${out.length}자(${out.join('')}) · 포함률 ${(coverage * 100).toFixed(1)}% — ${REGEN}`);
      if (coverage < MIN_COVERAGE) low.push(`${doc.key} ${(coverage * 100).toFixed(1)}%`);
    }
    expect(low, `포함률 ${MIN_COVERAGE * 100}% 미만 — ${REGEN}`).toEqual([]);
  });

  it('woff2는 목록과 함께 만든 그 파일이다(sha256 · 크기 · 이름 = stem + 굵기 + 내용 해시 앞 16자) · 작다 · 옛 판이 남지 않는다', () => {
    const expected = [];
    for (const [key, entry] of Object.entries(manifest.docs)) {
      const slug = key.split('/')[1];
      for (const part of [...PARTS, ...REST].filter((p) => entry[p])) {
        const { woff2 } = entry[part];
        const tag = REST.includes(part) ? part : STUDIES_WEIGHTS[part];
        expect(woff2.href, key).toBe(`/fonts/kr-viewer/${STUDIES_STEM}-${slug}-${tag}.${woff2.sha256.slice(0, 16)}.woff2`);
        const buf = fs.readFileSync(path.join(ROOT, 'public', woff2.href));
        expect(crypto.createHash('sha256').update(buf).digest('hex'), `${key} ${part} — ${REGEN}`).toBe(woff2.sha256);
        expect(buf.length).toBe(woff2.bytes);
        expect(buf.subarray(0, 4).toString('latin1')).toBe('wOF2');
        // 미리 받는 바이트는 첫 그림 전 대역을 나눈다 — 본문 약 17KB · 제목 약 4KB(문서당 두 파일 합 FCP−TTFB +0.1s 이하가 게이트)
        expect(buf.length, `${key} ${part}`).toBeLessThan({ body: 26, head: 8, rest400: 24, rest700: 12 }[part] * 1024);
        expected.push(path.basename(woff2.href));
      }
    }
    const files = fs.readdirSync(PUBLIC).filter((f) => f.startsWith(`${STUDIES_STEM}-`)).sort();
    expect(files).toEqual(expected.sort());
  });

  it('CSS: 본문 · 나머지400은 400, 제목 · 나머지700은 700 face — unicode-range = 그 파일에 담긴 글자 정확히 · swap · family Noto Sans KR', () => {
    expect(manifest.weights).toEqual(STUDIES_WEIGHTS);
    expect(manifest.restWeights).toEqual(STUDIES_REST_WEIGHTS);
    const entry = studiesSubsetEntry('japan', 'jp-culture');
    const css = studiesSubsetCss(entry);
    const faces = [...css.matchAll(/@font-face\{([^}]*)\}/g)].map((m) => m[1]);
    const parts = [...PARTS, ...REST].filter((p) => entry[p]);
    expect(faces).toHaveLength(parts.length);
    for (const part of parts) {
      const face = faces.find((f) => f.includes(`src:url(${entry[part].woff2.href})`));
      expect(face, part).toContain(`font-family:'Noto Sans KR';font-style:normal;font-weight:${ALL_WEIGHTS[part]};font-display:swap;`);
      const range = /unicode-range:(.+)$/.exec(face)[1];
      expect(new Set(expandRange(range)), part).toEqual(new Set([...entry[part].chars].map((c) => c.codePointAt(0))));
    }
    expect(studiesSubsetEntry('japan', 'nope')).toBeNull();
  });

  it('첫 화면 파일과 나머지 파일의 글자가 같은 굵기 안에서 겹치지 않는다(겹치면 같은 글자에 두 파일을 다 받는다) · 나머지는 한자 · 가나도 담는다', () => {
    for (const [key, e] of Object.entries(manifest.docs)) {
      for (const [first, rest] of [['body', 'rest400'], ['head', 'rest700']]) {
        if (!e[rest]) continue;
        const a = new Set(e[first].chars);
        expect([...e[rest].chars].filter((c) => a.has(c)), `${key} ${first}∩${rest}`).toEqual([]);
      }
    }
    expect(manifest.docs['japan/jp-culture'].rest400.chars).toMatch(/[\u4e00-\u9fff]/); // 한자 17자가 조각 12개 · 495KB를 끌어왔다
  });

  it('나머지는 미리 받지 않는다 — 첫 화면(body · head)만 preload', () => {
    const helper = fs.readFileSync(path.join(DIR, 'KrStudiesSubset.jsx'), 'utf8');
    expect(helper).toContain('const PRELOADED = Object.freeze(Object.keys(manifest.weights));');
    expect(helper).toContain('for (const part of PRELOADED) {');
  });

  it('생성기 · 글자 모듈 · 문서 쪽의 값이 같다(stem · 목록 파일 · 굵기) · 원본은 판 고정', () => {
    const script = fs.readFileSync(path.join(ROOT, 'scripts/fonts/kr-viewer-subset.py'), 'utf8');
    expect(script).toContain(`STUDIES_STEM = '${STUDIES_STEM}'`);
    expect(script).toContain(`STUDIES_MANIFEST = '${STUDIES_MANIFEST}'`);
    expect(script).toContain(`STUDIES_WEIGHTS = {'body': ${STUDIES_WEIGHTS.body}, 'head': ${STUDIES_WEIGHTS.head}}`);
    expect(script).toContain(`STUDIES_REST_WEIGHTS = {'rest400': ${STUDIES_REST_WEIGHTS.rest400}, 'rest700': ${STUDIES_REST_WEIGHTS.rest700}}`);
    expect(script).toContain("instancer.instantiateVariableFont(font, {'wght': wght})"); // 굵기별 정적 파일
    expect(script).toContain(`SOURCE_SHA256 = '${manifest.source.sha256}'`);
  });

  it('지역학 문서 쪽만 싣고 첫 그림 전에 미리 받는다', () => {
    const page = fs.readFileSync(path.join(ROOT, 'src/app/(app)/studies/[country]/[slug]/page.jsx'), 'utf8');
    expect(page).toContain("import KrStudiesSubset from '@/components/fonts/kr-viewer/KrStudiesSubset';");
    expect(page).toMatch(/<KrStudiesSubset countryId=\{countryId\} slug=\{doc\.slug\} \/>/);
    const helper = fs.readFileSync(path.join(DIR, 'KrStudiesSubset.jsx'), 'utf8');
    expect(helper).toContain("preload(entry[part].woff2.href, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });");
    expect(helper).not.toMatch(/^'use client'/m); // 서버 구성 요소 — 목록 JSON이 클라이언트 묶음에 들어가지 않는다
    const users = [];
    const walk = (dir) => { for (const n of fs.readdirSync(dir)) { const p = path.join(dir, n); if (fs.statSync(p).isDirectory()) { if (n !== 'node_modules' && n !== '__tests__') walk(p); } else if (/\.(jsx?|mjs)$/.test(n) && /KrStudiesSubset|studies-subsets\.json/.test(fs.readFileSync(p, 'utf8'))) users.push(path.relative(ROOT, p)); } };
    walk(path.join(ROOT, 'src'));
    expect(users.filter((f) => !f.startsWith('src/components/fonts/kr-viewer/')).sort()).toEqual(['src/app/(app)/studies/[country]/[slug]/page.jsx']);
  });
});
