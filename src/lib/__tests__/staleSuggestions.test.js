import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { MAX_ARTICLE_AGE_DAYS, REPEAT_WINDOW_DAYS, daysBefore, freshSuggestions } from '../suggestionSources';
import { wikinewsPublishedDate } from '../content-sources';

/**
 * 계약(STALE-SUGGEST-001 · 2026-11-08 KST): 오늘의 소식은 ⑴ 최근 30일 안에 이미 실린 id를 다시 넣지 않고 ⑵ 발행일을 아는 기사는 30일보다
 * 오래되면 넣지 않는다. 운영 실측 — Wikinews 폐쇄(2026-05) 뒤 영어 소식이 9/6~11/8 64일 동안 같은 기사 6개(321줄)를 날마다 「오늘」로 실었다.
 */
describe('STALE-SUGGEST-001 — 오늘의 소식 신선도', () => {
  it('Wikinews 날짜 카테고리 → 발행일(영어 · 프랑스어판), 없으면 null', () => {
    // 운영 기사 실측 카테고리(South Korean military halts … — 2026-11-08 KST API 조회)
    const cats = ['Category:Archived', 'Category:Asia', 'Category:Health', 'Category:March 22, 2026', 'Category:Military', 'Category:Published'];
    expect(wikinewsPublishedDate(cats)).toBe('2026-03-22');
    expect(wikinewsPublishedDate(['Catégorie:Santé', 'Catégorie:3 mai 2026'])).toBe('2026-05-03');
    expect(wikinewsPublishedDate(['Category:Health', 'Category:Mayday 3, 2026'])).toBeNull();
    expect(wikinewsPublishedDate([])).toBeNull();
  });

  it('이미 실린 id는 빼고, 30일보다 오래된 기사는 빼고, 발행일을 모르면 반복 문만 본다', () => {
    const today = '2026-11-08';
    const articles = [
      { videoId: 'wikinews_en_Old', publishedAt: '2026-03-22' },        // 오래됨 → 뺀다
      { videoId: 'wikinews_en_Seen', publishedAt: '2026-11-05' },       // 최근이지만 이미 실림 → 뺀다
      { videoId: 'wikinews_en_Fresh', publishedAt: '2026-10-20' },      // 30일 안 → 넣는다
      { videoId: 'nhk_cat1_x' },                                         // 발행일 모름 · 처음 → 넣는다
      { videoId: 'nhk_cat1_y', publishedAt: 'not-a-date' },              // 형식 밖 → 모름으로 친다
    ];
    const out = freshSuggestions(articles, { today, seen: new Set(['wikinews_en_Seen']) });
    expect(out.map((a) => a.videoId)).toEqual(['wikinews_en_Fresh', 'nhk_cat1_x', 'nhk_cat1_y']);
    expect(daysBefore(today, MAX_ARTICLE_AGE_DAYS)).toBe('2026-10-09');
    expect(freshSuggestions([{ videoId: 'a', publishedAt: '2026-10-09' }], { today })).toHaveLength(1); // 경계 당일은 넣는다
    expect(REPEAT_WINDOW_DAYS).toBe(30);
  });

  it('크론이 최근 30일 실린 id를 읽어 신선도 문을 거친 기사만 저장한다 · Wikinews가 발행일을 싣는다', () => {
    const route = fs.readFileSync('src/app/api/cron/fetch-suggestions/route.js', 'utf8');
    expect(route).toMatch(/\.gte\('date', daysBefore\(today, REPEAT_WINDOW_DAYS\)\)/);
    expect(route).toMatch(/\.lt\('date', today\)/);
    expect(route).toMatch(/const articles = freshSuggestions\(fetched, \{ today, seen \}\)/);
    expect(fs.readFileSync('src/lib/content-sources.js', 'utf8')).toMatch(/publishedAt: wikinewsPublishedDate\(got\.categories\)/);
  });
});

describe('STALE-SUGGEST-001 — NHK 다이제스트 제목 날짜는 KST', () => {
  it('제목 날짜 형식이 Asia/Seoul 기준이다(서버 UTC면 00:06 KST 수집이 전날 날짜를 단다)', () => {
    const src = fs.readFileSync('src/lib/content-sources.js', 'utf8');
    expect(src).toMatch(/toLocaleDateString\('ja-JP', \{ month: 'long', day: 'numeric', timeZone: 'Asia\/Seoul' \}\)/);
    // 00:06 KST(= 전날 15:06 UTC)에 같은 식으로 만든 날짜는 KST 날짜다
    const at = new Date('2026-11-07T15:06:00Z');
    expect(at.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })).toBe('11月8日');
  });
});
