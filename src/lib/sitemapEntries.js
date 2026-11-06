// 사이트 지도 항목 조립(LAUNCH-META-001) — src/app/sitemap.js가 부른다. 설명은 그 파일 머리.
import { STUDY_COUNTRIES } from '@/content/studies';
import { OPEN_LEVEL_LIST } from '@/lib/bookNavigation';
import { LEVEL_LIST_LANGS, levelKinds } from '@/lib/levelList';
import { canonicalFor } from '@/lib/seo';
import { curatedMaterialIds } from '@/lib/server/curatedMaterials';
import { publishedOrNull } from '@/lib/server/publishedBook';
import { BOOKS } from '@/lib/textbook/contract';
import { readEditionStamp, readRelease } from '@/lib/textbook/server';

const latest = (dates) => dates.filter(Boolean).sort().at(-1);
/** '2026년 10월 19일' → '2026-10-19'(출처 화면의 갱신일 표기 그대로를 쓴다). */
export function koreanDate(text) {
  const m = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/.exec(String(text || ''));
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : undefined;
}

export const entry = (path, lastModified) => (lastModified ? { url: canonicalFor(path), lastModified } : { url: canonicalFor(path) });

/** 지역학 — 나라 · 문서는 등록부 그대로, 날짜는 문서 updated(나라 · 목록은 그 아래 가장 늦은 문서). */
export function studiesEntries(countries = STUDY_COUNTRIES) {
  const all = countries.flatMap((country) => country.docs.map((doc) => doc.updated));
  return [
    entry('/studies', latest(all)),
    ...countries.flatMap((country) => [
      entry(`/studies/${country.id}`, latest(country.docs.map((doc) => doc.updated))),
      ...(country.id === 'japan' ? [entry('/studies/japan/map')] : []),
      ...country.docs.map((doc) => entry(`/studies/${country.id}/${doc.slug}`, doc.updated)),
    ]),
  ];
}

/** 레벨 단어 · 문형 · 한자 목록 — 라우트의 정적 판(levelListRoute)과 같은 레벨 · 갈래 중 손님에게 열린 것(OPEN_LEVEL_LIST)만. */
export function levelListEntries(langs = LEVEL_LIST_LANGS) {
  return Object.entries(langs).flatMap(([lang, conf]) => conf.levels.flatMap((level) =>
    levelKinds(lang, level).map((kind) => `/${lang}/${kind}/${level.toLowerCase()}`)))
    .filter((path) => OPEN_LEVEL_LIST.test(path))
    .map((path) => entry(path));
}

/** 발행 도장 — 발행 안 한 책은 null(404와 같은 판정 · publishedOrNull). 발행 · 판본 행이 그 책의 것일 때만(다른 책의 행을 그 책의 발행으로 치지 않는다). */
async function publishedStamp(db, bookId) {
  const release = await readRelease(db, bookId);
  if (release?.book_id !== bookId || !release.edition_id) return null;
  const stamp = await readEditionStamp(db, release.edition_id, bookId);
  return stamp?.book_id === bookId ? stamp : null;
}

/** 교재 첫 화면 — 발행된 책만, 날짜는 발행 시각. */
export async function bookEntries(stampOf = (bookId) => publishedOrNull((db) => publishedStamp(db, bookId))) {
  const stamps = await Promise.all(Object.keys(BOOKS).map(async (bookId) => [bookId, await stampOf(bookId)]));
  return stamps.filter(([, stamp]) => stamp).map(([bookId, stamp]) => entry(`/books/${bookId}`, stamp.published_at || undefined));
}


/** 뷰어 자료 — 우리가 만든 공개 자료만(lib/server/curatedMaterials · LAUNCH-META-002). 자료 표에 갱신 시각 칸이 없어 lastmod는 뺀다(생성일은 다시 분석해도 그대로라 「바뀜」 신호가 못 된다). */
export async function materialEntries(listIds = curatedMaterialIds) {
  return (await listIds()).map((id) => entry(`/viewer/${encodeURIComponent(id)}`));
}
