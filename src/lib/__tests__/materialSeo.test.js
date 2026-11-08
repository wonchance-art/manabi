import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MATERIAL_TAIL, jsonLdScript, materialDescription, materialExcerpt, materialFacts, materialJsonLd } from '../materialSeo';
import { canonicalFor, siteUrl } from '../seo';

// VIEWER-SEO-001 — 뷰어 자료 한 편의 검색 · 공유 설명과 구조화 데이터. 운영 점검(2026-11-08 KST): 공개 132편 설명이 전부
// 「AI가 분석한 "제목" 학습 자료」 한 틀(제목 되풀이)이었고 JSON-LD가 없었다.
const jp = { id: 45, title: '[N5 문법 #1] ~は~です (기본 단정문)', raw_text: 'わたしは がくせいです。\nあなたは せんせいです。\nわたしは かんこくじんです。\nたなかさんは にほんじんです。\nあなたは がくせいですか。',
  processed_json: { metadata: { language: 'Japanese', level: 'N5 기초', updated_at: '2026-11-07T03:00:00Z' } } };

describe('본문 첫머리', () => {
  it('공백을 하나로 · 한도 안 마지막 문장 끝에서 자른다', () => {
    expect(materialExcerpt(jp.raw_text)).toBe('わたしは がくせいです。 あなたは せんせいです。 わたしは かんこくじんです。 たなかさんは にほんじんです。');
    expect(materialExcerpt('I can speak two languages. She can swim very well. We can meet tomorrow. He cannot drive a car yet.'))
      .toBe('I can speak two languages. She can swim very well.');
  });
  it('짧으면 그대로 · 문장 끝이 없으면 한도에서 자르고 「…」 · 없으면 빈 문자열', () => {
    expect(materialExcerpt('服务员：你好！')).toBe('服务员：你好！');
    expect(materialExcerpt('가'.repeat(80))).toBe(`${'가'.repeat(60)}…`);
    expect(materialExcerpt('   ')).toBe('');
    expect(materialExcerpt(null)).toBe('');
    expect(materialExcerpt('3.14 is pi and it goes on and on and on without any sentence end at all here')).toMatch(/…$/); // 소수점은 문장 끝이 아니다
  });
});

describe('설명 한 줄', () => {
  it('언어 · 레벨 · 첫머리(우리 공개 자료) — 제목을 되풀이하지 않는다', () => {
    const d = materialDescription(jp, { withExcerpt: true });
    expect(d).toBe(`일본어 N5 기초 읽기 자료 · 「わたしは がくせいです。 あなたは せんせいです。 わたしは かんこくじんです。 たなかさんは にほんじんです。」 — ${MATERIAL_TAIL}`);
    expect(d).not.toContain(jp.title);
    expect(d).not.toMatch(/해주세요|하시겠습니까|\.\.\./); // 문구 표준(copy-standard)
  });
  it('첫머리 없이(다른 계정 공개 · 제목 조회 행) — 언어 · 레벨만', () => {
    expect(materialDescription(jp)).toBe(`일본어 N5 기초 읽기 자료 — ${MATERIAL_TAIL}`);
    expect(materialDescription({ title: 'x', language: 'Chinese', level: 'H1 기초' }, { withExcerpt: true })).toBe(`중국어 H1 기초 읽기 자료 — ${MATERIAL_TAIL}`);
    expect(materialDescription({ title: 'x' })).toBe(`읽기 자료 — ${MATERIAL_TAIL}`);
    expect(materialFacts({ processed_json: { metadata: { language: 'Klingon', level: ' ' } } })).toEqual({ language: null, level: null });
  });
});

describe('구조화 데이터(LearningResource)', () => {
  it('이름 · 설명 · 정본 · 언어 코드 · 레벨 · 무료 · 사이트', () => {
    expect(materialJsonLd('45', jp)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'LearningResource',
      name: jp.title,
      description: materialDescription(jp, { withExcerpt: true }),
      url: canonicalFor('/viewer/45'),
      inLanguage: 'ja',
      educationalLevel: 'N5 기초',
      learningResourceType: '읽기 자료',
      isAccessibleForFree: true,
      dateModified: '2026-11-07T03:00:00.000Z',
      isPartOf: { '@type': 'WebSite', name: 'manabi', url: `${siteUrl()}/` },
    });
    const zh = materialJsonLd('371', { title: '在饭馆', processed_json: { metadata: { language: 'Chinese', updated_at: 'nope' } } });
    expect(zh.inLanguage).toBe('zh');
    expect(zh).not.toHaveProperty('dateModified');
    expect(zh).not.toHaveProperty('educationalLevel');
  });
  it('스크립트 본문은 「<」를 이스케이프한다(본문 글자가 태그를 닫지 못하게)', () => {
    const out = jsonLdScript(materialJsonLd('1', { title: '</script><b>x', raw_text: '</script>' }));
    expect(out).not.toContain('</script');
    expect(JSON.parse(out).name).toBe('</script><b>x');
  });
  it('뷰어 쪽: 서버 본문(손님 판) 중 검색에 싣는 자료만 붙인다', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'src/app/(app)/viewer/[id]/page.jsx'), 'utf8');
    expect(page).toMatch(/const jsonLd = ssr && isIndexableMaterial\(ssr, await curatorIds\(\)\) \? materialJsonLd\(id, ssr\) : null;/);
    expect(page).toContain('<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />');
    expect(page).toContain('materialDescription(data, { withExcerpt: indexable })');
  });
});

describe('「함께 읽는 글」 탭 제목 · 설명(오케스트레이터 (나) — 정본은 산책 그대로)', () => {
  it('제목은 h1과 같은 「함께 읽는 글」, 정본 · og:url은 /discover, 설명은 해요체', async () => {
    const { metadata } = await import('@/app/(app)/discover/reading/page');
    expect(metadata.title).toBe('함께 읽는 글');
    expect(metadata.alternates.canonical).toBe(canonicalFor('/discover'));
    expect(metadata.openGraph.url).toBe(canonicalFor('/discover'));
    expect(metadata.description).toMatch(/요\.$/);
    expect(metadata.description).not.toMatch(/해주세요|하시겠습니까|\.\.\./);
    const page = fs.readFileSync(path.join(process.cwd(), 'src/app/(app)/discover/reading/page.jsx'), 'utf8');
    expect(page).toContain('<h1>함께 읽는 글</h1>');
    expect(page).not.toContain(metadata.description); // 그리지 않는 문구는 첫 화면 글꼴 출처(page.jsx) 밖
  });
});
