// 뷰어 자료 한 편의 검색 · 공유 문구(VIEWER-SEO-001, 2026-11-08 KST). 공개 자료 132편이 손님 「함께 읽는 글」에 오르자(#1760) 검색 유입을 받을
// 준비로 점검했다 — 132편 모두 index · 자기 정본 · 공유 그림은 맞았고, 설명이 「AI가 분석한 "제목" 학습 자료」 한 틀이라 제목을 되풀이할 뿐
// 언어 · 레벨 · 내용이 없었다. 구조화 데이터(JSON-LD)도 없었다.
//
// 설명 = 「일본어 N5 기초 읽기 자료 · 「본문 첫머리」 — 모르는 말은 눌러서 뜻과 발음을 보며 읽어요.」 본문 첫머리는 검색에 싣는 자료(우리 공개 자료 —
// curatedMaterials.isIndexableMaterial)만 — 다른 계정이 공개로 돌린 글의 본문을 공유 미리보기 · 검색 문구로 옮기지 않는다.
// 이 모듈은 뷰어만 쓴다(언어 판정 정본 refVocabLookup을 가져오므로 모든 화면이 싣는 seo.js에 두지 않는다).
import { LANG_NAME_KO } from './constants';
import { encounterLookupLang } from './refVocabLookup';
import { canonicalFor, siteUrl } from './seo';

const EXCERPT_MAX = 60;
// 문장 끝 — 일본어 · 중국어 마침표 · 느낌표 · 물음표, 영어 · 프랑스어는 뒤에 빈칸이 오는 . ! ?
const SENTENCE_END = /[。．！？]|[.!?](?=\s|$)/g;
export const MATERIAL_TAIL = '모르는 말은 눌러서 뜻과 발음을 보며 읽어요.';
export const MATERIAL_TYPE_KO = '읽기 자료';

/** 본문 첫머리 — 공백을 하나로, 한도 안의 마지막 문장 끝에서 자른다. 한 문장이 한도를 넘으면 자르고 「…」. 없으면 ''. */
export function materialExcerpt(text, max = EXCERPT_MAX) {
  const flat = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
  if (!flat) return '';
  const chars = [...flat];
  if (chars.length <= max) return flat;
  const head = chars.slice(0, max).join('');
  let cut = -1;
  for (const m of head.matchAll(SENTENCE_END)) cut = m.index + m[0].length;
  if (cut >= Math.min(20, max)) return head.slice(0, cut).trim();
  return `${head.trimEnd()}…`;
}

/** 자료 언어 · 레벨 — 행(본문을 실은 행이든 제목 조회 행이든)에서. 모르면 null. */
export function materialFacts(row) {
  const meta = row?.processed_json?.metadata || {};
  const language = row?.language ?? meta.language ?? null;
  const level = row?.level ?? meta.level ?? null;
  return {
    language: LANG_NAME_KO[language] ? language : null,
    level: typeof level === 'string' && level.trim() ? level.trim() : null,
  };
}

/** 검색 · 공유 설명 한 줄. withExcerpt면 본문 첫머리를 넣는다(우리 공개 자료만). */
export function materialDescription(row, { withExcerpt = false } = {}) {
  const { language, level } = materialFacts(row);
  const kind = [language && LANG_NAME_KO[language], level, MATERIAL_TYPE_KO].filter(Boolean).join(' ');
  const excerpt = withExcerpt ? materialExcerpt(row?.raw_text) : '';
  return excerpt ? `${kind} · 「${excerpt}」 — ${MATERIAL_TAIL}` : `${kind} — ${MATERIAL_TAIL}`;
}

/** schema.org LearningResource — 검색에 싣는 서버 본문에만 붙인다(뷰어 쪽 · VIEWER-SEO-001). */
export function materialJsonLd(id, row) {
  const { language, level } = materialFacts(row);
  const updated = row?.processed_json?.metadata?.updated_at;
  const dateModified = typeof updated === 'string' && !Number.isNaN(Date.parse(updated)) ? new Date(updated).toISOString() : null;
  return {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: row?.title || '자료',
    description: materialDescription(row, { withExcerpt: true }),
    url: canonicalFor(`/viewer/${encodeURIComponent(id)}`),
    ...(language ? { inLanguage: encounterLookupLang(language) } : {}),
    ...(level ? { educationalLevel: level } : {}),
    learningResourceType: MATERIAL_TYPE_KO,
    isAccessibleForFree: true,
    ...(dateModified ? { dateModified } : {}),
    isPartOf: { '@type': 'WebSite', name: 'manabi', url: `${siteUrl()}/` },
  };
}

/** <script type="application/ld+json"> 본문 — 「<」를 이스케이프해 본문 글자가 태그를 닫지 못하게 한다(손님 배움 판과 같은 방식). */
export function jsonLdScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
