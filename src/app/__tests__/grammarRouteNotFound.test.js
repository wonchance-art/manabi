import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TRACKS = ['french', 'japanese', 'english', 'chinese'];
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('문법 챕터 라우트 — soft 404 방지 계약', () => {
  it.each(TRACKS)('%s: 미지 slug가 on-demand 렌더되지 않도록 dynamicParams=false를 유지한다', (track) => {
    const src = read(`src/app/(app)/${track}/grammar/[slug]/page.jsx`);
    // 이 선언이 빠지면 없는 챕터가 HTTP 200(soft 404)으로 응답한다 — 검색엔진 유령 색인 방지.
    expect(src).toMatch(/export const dynamicParams = false;/);
    expect(src).toContain('generateStaticParams');
  });

  it.each(TRACKS)('%s: 로더가 챕터를 못 찾으면 notFound()로 빠진다', (track) => {
    const src = read(`src/app/(app)/${track}/grammar/[slug]/page.jsx`);
    expect(src).toContain("import { notFound } from 'next/navigation'");
    expect(src).toMatch(/if \(!loaded\?\.data\) notFound\(\);/);
  });
});
