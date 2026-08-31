import { describe, expect, it, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_SOURCES, groupByLanguage, resolveActiveSources } from '../suggestionSources';
import { fetchWikinews, fetchFromSource } from '../content-sources';

/**
 * 계약: v2-F R2 — 중국어·프랑스어 공급 개통 (#1077, 오너 "F ㄱㄱ").
 *
 * 설계 §0의 갭 2는 「추천이 JA/EN 전용」이었다. 실측해 보니 소스가 없는 것만이 아니라
 * **크론이 구조적으로 ja/en에 잠겨 있었다** — `byLang = { Japanese: [], English: [] }`가
 * 고정이라, DB에 French 행을 넣어도 `if (byLang[s.language])`에서 조용히 버려졌다.
 * 소스만 추가해선 절대 개통되지 않는 구조였다. 그래서 이 계약이 지키는 것은
 * **특정 언어 목록이 아니라 "언어에 대해 열려 있음"** 이다.
 *
 * 읽기 경로(`/api/suggestions/today`)와 표시 층(`LANG_NAME_KO`·`LEVELS`)은 이미 4개 언어를
 * 감당하고 있었다 — 실측으로 확인했고, 그래서 이 라운드는 크론 한 곳만 손댄다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

afterEach(() => { vi.unstubAllGlobals(); });

describe('resolveActiveSources — 기본값은 언어별로 보충된다', () => {
  it('DB가 비면 기본값 전부', () => {
    expect(resolveActiveSources([])).toEqual([...DEFAULT_SOURCES]);
    expect(resolveActiveSources(null)).toEqual([...DEFAULT_SOURCES]);
  });

  it('DB가 아는 언어는 그 언어의 활성 행만 쓴다 — 의도적 비활성을 기본값이 되살리지 않는다', () => {
    // 예전 구현의 진짜 위험: `dbSources.length > 0 ? dbSources : DEFAULTS`를 언어별로
    // 바꾸면서 무심코 `is_active: false`를 덮으면, 오너가 끈 소스가 되살아난다.
    const db = [
      { language: 'Japanese', source_type: 'qiita',   is_active: true },
      { language: 'Japanese', source_type: 'nhk_rss', is_active: false },
    ];
    const out = resolveActiveSources(db);
    expect(out.filter((s) => s.language === 'Japanese')).toEqual([db[0]]);
    expect(out.some((s) => s.source_type === 'nhk_rss')).toBe(false);
  });

  it('DB가 모르는 언어는 기본값으로 열린다 — 배포만으로 개통', () => {
    // 예전 구현은 ja 행 하나만 있어도 기본값 전체가 죽어 en·fr가 함께 사라졌다.
    const db = [{ language: 'Japanese', source_type: 'qiita', is_active: true }];
    const langs = new Set(resolveActiveSources(db).map((s) => s.language));
    expect(langs.has('English')).toBe(true);
    expect(langs.has('French')).toBe(true);
  });

  it('기본값에 French는 있고 Chinese는 없다 — 하드리밋 「중화권 정치 서술 완전 배제」', () => {
    const langs = DEFAULT_SOURCES.map((s) => s.language);
    expect(langs).toContain('French');
    expect(langs, '중국어 뉴스 자동 수집은 오너 결정 — 기본 개통 금지').not.toContain('Chinese');
  });
});

describe('groupByLanguage — 언어 목록을 고정하지 않는다', () => {
  it('소스에 있는 언어는 무엇이든 그룹이 생긴다', () => {
    const g = groupByLanguage([
      { language: 'French', source_type: 'wikinews_fr' },
      { language: 'Chinese', source_type: 'wikinews_zh' },
      { language: 'French', source_type: 'x' },
    ]);
    expect([...g.keys()]).toEqual(['French', 'Chinese']);
    expect(g.get('French')).toHaveLength(2);
  });

  it('언어 없는 행은 조용히 건너뛴다(크론이 죽지 않는다)', () => {
    expect([...groupByLanguage([{ source_type: 'x' }, null]).keys()]).toEqual([]);
    expect([...groupByLanguage(undefined).keys()]).toEqual([]);
  });
});

describe('fetchWikinews — 언어판 매개변수화(신규 파서 0)', () => {
  const mockWiki = (titles) => vi.stubGlobal('fetch', vi.fn(async (url) => ({
    ok: true,
    json: async () => (String(url).includes('list=recentchanges')
      ? { query: { recentchanges: titles.map((title) => ({ title })) } }
      : { query: { pages: { 1: { extract: '본문 '.repeat(120) } } } }),
  })));

  it('언어판 서브도메인으로 요청한다', async () => {
    mockWiki(['Sujet']);
    await fetchWikinews(1, 'fr');
    const urls = globalThis.fetch.mock.calls.map((c) => String(c[0]));
    expect(urls.every((u) => u.includes('fr.wikinews.org'))).toBe(true);
  });

  it('videoId에 언어판이 들어간다 — 같은 제목의 언어 간 upsert 충돌 방지', async () => {
    // upsert 키가 (date, video_id)라, 언어판이 빠지면 같은 제목이 서로를 덮어쓴다.
    mockWiki(['Same Title']);
    const fr = await fetchWikinews(1, 'fr');
    mockWiki(['Same Title']);
    const en = await fetchWikinews(1, 'en');
    expect(fr[0].videoId).not.toBe(en[0].videoId);
    expect(fr[0].videoId).toContain('_fr_');
    // 크론의 source 라벨 판정이 `wikinews_` 접두사를 본다 — 접두사는 유지돼야 한다.
    expect(fr[0].videoId.startsWith('wikinews_')).toBe(true);
  });

  it('인자 없이 부르면 영어판 — 기존 호출부 무파손', async () => {
    mockWiki(['Topic']);
    const out = await fetchWikinews(1);
    expect(String(globalThis.fetch.mock.calls[0][0])).toContain('en.wikinews.org');
    expect(out[0].channelName).toBe('English Wikinews');
  });

  it('디스패처가 fr·zh를 각 언어판으로 보낸다', async () => {
    mockWiki(['A']);
    await fetchFromSource({ source_type: 'wikinews_fr' }, 1);
    expect(String(globalThis.fetch.mock.calls[0][0])).toContain('fr.wikinews.org');
    // zh는 기본 소스에 없지만 디스패처에는 있다 — 오너가 켜면 DB 행 하나로 끝나게.
    mockWiki(['B']);
    await fetchFromSource({ source_type: 'wikinews_zh' }, 1);
    expect(String(globalThis.fetch.mock.calls[0][0])).toContain('zh.wikinews.org');
  });
});

describe('크론 배선 — 언어 하드코딩이 되살아나지 않는다', () => {
  it('크론은 언어 목록을 고정하지 않고 순수 함수에 맡긴다', () => {
    const cron = read('src/app/api/cron/fetch-suggestions/route.js');
    expect(cron).toContain('resolveActiveSources');
    expect(cron).toContain('groupByLanguage');
    // 이 리터럴이 병목이었다 — 되살아나면 fr/zh가 다시 조용히 버려진다.
    expect(cron, 'byLang 언어 하드코딩 부활').not.toMatch(/\{\s*Japanese:\s*\[\]/);
  });

  it('is_active 필터를 쿼리에 걸지 않는다 — 설정 여부와 활성 여부는 다른 질문이다', () => {
    // 쿼리에서 걸러 버리면 「DB가 아는 언어」를 알 수 없어, 꺼 둔 소스를 기본값이 되살린다.
    const cron = read('src/app/api/cron/fetch-suggestions/route.js');
    expect(cron).not.toContain("eq('is_active', true)");
  });
});
