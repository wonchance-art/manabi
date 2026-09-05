import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  NHK_FEEDS, RSS_FAMILIES, fetchFromSource, fetchNHKHeadlines, fetchRssText, fetchWikinews,
  htmlToText, parseRssItems, topicSlug,
} from '../content-sources.js';
import { DEFAULT_SOURCES, suggestionSourceLabel } from '../suggestionSources.js';

/**
 * 계약: U R4 소스 확장 (#1077 조사표 5509440618 → 오너 「먼저 제안 살피되 좋은 안 있으면 그걸로 적용 ㄱㄱ」, 2026-09-05).
 *
 * 원칙 하나 — 주제 태그는 **소스 자신의 분류**에서만(NHK 카테고리 피드 = URL, Wikinews = 카테고리,
 * rss_text = 섹션 피드). 태그를 못 얻는 항목은 수집 단계에서 거부(fail-closed, newsTopicGate 선례).
 * 기존 6종의 수집 결과는 바뀌지 않는다(설정 없으면 옛 경로). zh 게이트는 카테고리 수집에도 그대로 걸린다.
 */
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
afterEach(() => vi.unstubAllGlobals());

const nhkXml = (channelTitle, n = 6) => `<?xml version="1.0"?><rss><channel><title>${channelTitle}</title><link>https://www3.nhk.or.jp/news/</link>
${Array.from({ length: n }, (_, i) => `<item><title><![CDATA[見出し${i + 1}]]></title><description><![CDATA[本文${i + 1}です。]]></description></item>`).join('\n')}
</channel></rss>`;
const mockText = (body) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => body, json: async () => ({}) })));

describe('① NHK 카테고리 피드 — URL이 곧 NHK의 분류', () => {
  it('설정 없으면 cat0 다이제스트 그대로 — 라벨·id·제목 불변(기존 결과 무변경)', async () => {
    mockText(nhkXml('NHKニュース'));
    const [a] = await fetchNHKHeadlines(1);
    expect(String(globalThis.fetch.mock.calls[0][0])).toBe('https://www3.nhk.or.jp/rss/news/cat0.xml');
    expect(a.videoId).toMatch(/^nhk_digest_\d{4}-\d{2}-\d{2}$/);
    expect(a.source).toBeUndefined();                       // 접두사 체인이 'nhk'로 판정한다
    expect(suggestionSourceLabel(a)).toBe('nhk');
    expect(a.transcript.startsWith('今日のニュース（NHK）')).toBe(true);
    expect(a.channelName).toBe('NHK ニュース');
  });

  it('feed=cat1 → 社会 피드를 긷고 라벨 nhk_society, id는 cat0과 충돌하지 않는다', async () => {
    mockText(nhkXml('NHKニュース'));
    const [a] = await fetchNHKHeadlines(1, { feed: 'cat1' });
    expect(String(globalThis.fetch.mock.calls[0][0])).toBe('https://www3.nhk.or.jp/rss/news/cat1.xml');
    expect(a.source).toBe('nhk_society');
    expect(suggestionSourceLabel(a)).toBe('nhk_society');
    expect(a.videoId).toMatch(/^nhk_cat1_digest_\d{4}-\d{2}-\d{2}$/);
    expect(a.channelName).toBe('NHK ニュース（社会）');
    expect(a.transcript.startsWith('今日のニュース（NHK・社会）')).toBe(true);
    expect(a.title).toContain('（社会）');
  });

  it('채널 제목에 분류명이 실려 있으면 그것이 우선 — 소스가 스스로 말한 분류', async () => {
    // 등록표는 cat3=科学・医療인데 피드 채널 제목이 社会라고 말하면 社会로 싣는다(등록표 오기 방어).
    mockText(nhkXml('NHKニュース｜社会'));
    const [a] = await fetchNHKHeadlines(1, { feed: 'cat3' });
    expect(a.source).toBe('nhk_society');
  });

  it('등록 안 된 피드(정치 cat4·국제 cat6·미지 cat9)는 요청조차 하지 않는다 — fail-closed', async () => {
    mockText(nhkXml('NHKニュース'));
    for (const feed of ['cat4', 'cat6', 'cat9', '']) {
      expect(await fetchNHKHeadlines(1, { feed })).toEqual(feed === '' ? expect.any(Array) : []);
    }
    // '' 는 cat0(현행)으로 흐른다 — 그 한 번만 fetch가 불린다
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(NHK_FEEDS.cat4).toBeUndefined();
    expect(NHK_FEEDS.cat6).toBeUndefined();
    expect(NHK_FEEDS.cat0.topic).toBeNull();
  });

  it('디스패처가 config.feed를 넘긴다 — qiita 폴백은 옛 cat0 그대로', async () => {
    mockText(nhkXml('NHKニュース'));
    await fetchFromSource({ source_type: 'nhk_rss', config: { feed: 'cat3' } }, 1);
    expect(String(globalThis.fetch.mock.calls[0][0])).toContain('cat3.xml');
    expect(read('src/lib/content-sources.js')).toContain('if (results.length === 0) return fetchNHKHeadlines(count);');
  });
});

describe('② Wikinews 카테고리 — 카테고리가 곧 위키의 분류', () => {
  const mockWiki = (titles, listKey) => vi.stubGlobal('fetch', vi.fn(async (url) => ({
    ok: true,
    json: async () => (String(url).includes(`list=${listKey}`)
      ? { query: { [listKey]: titles.map((title) => ({ title })) } }
      : { query: { pages: { 1: { extract: '본문 '.repeat(120), categories: [{ title: 'Category:科技' }] } } } }),
  })));

  it('category가 있으면 categorymembers(최신순)로 긷고 라벨은 wikinews_<lang>_<slug>', async () => {
    mockWiki(['Vaccine news'], 'categorymembers');
    const [a] = await fetchWikinews(1, 'en', { category: 'Health' });
    const url = String(globalThis.fetch.mock.calls[0][0]);
    expect(url).toContain('list=categorymembers');
    expect(url).toContain('cmtitle=Category%3AHealth');
    expect(url).toContain('cmsort=timestamp');
    expect(url).toContain('cmdir=desc');
    expect(a.source).toBe('wikinews_en_health');
    expect(a.channelName).toBe('English Wikinews · Health');
    expect(a.videoId).toBe('wikinews_en_Vaccine%20news');   // id 규약 불변(언어판 포함)
  });

  it('category가 없으면 현행(recentchanges)·라벨 없음 — 기존 결과 무변경', async () => {
    mockWiki(['Any'], 'recentchanges');
    const [a] = await fetchWikinews(1, 'fr');
    expect(String(globalThis.fetch.mock.calls[0][0])).toContain('list=recentchanges');
    expect(a.source).toBeUndefined();
    expect(suggestionSourceLabel(a)).toBe('wikinews');
  });

  it('슬러그: 악센트 제거·소문자·비문자 → _, 비라틴은 그대로', () => {
    expect(topicSlug('Santé')).toBe('sante');
    expect(topicSlug('Science and technology')).toBe('science_and_technology');
    expect(topicSlug('科技')).toBe('科技');
    expect(topicSlug('  ')).toBe('');
  });

  it('zh는 카테고리 수집에도 게이트가 그대로 — 안전 분류 없는 글은 버린다', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => (String(url).includes('list=categorymembers')
        ? { query: { categorymembers: [{ title: '無分類' }] } }
        : { query: { pages: { 1: { extract: '本文'.repeat(200), categories: [] } } } }),
    })));
    expect(await fetchWikinews(1, 'zh', { category: '科技' })).toEqual([]);
    const src = read('src/lib/content-sources.js');
    expect(src).toContain('if (!passesTopicGate(got.categories, gate)) continue;');
  });

  it('디스패처가 en·fr·zh 전부에 config를 넘긴다', async () => {
    mockWiki(['A'], 'categorymembers');
    await fetchFromSource({ source_type: 'wikinews_fr', config: { category: 'Santé' } }, 1);
    expect(String(globalThis.fetch.mock.calls[0][0])).toContain('cmtitle=Category%3ASant%C3%A9');
    const src = read('src/lib/content-sources.js');
    for (const l of ["fetchWikinews(count, 'en', config)", "fetchWikinews(count, 'fr', config)", "fetchWikinews(count, 'zh', config)"]) {
      expect(src).toContain(l);
    }
  });
});

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Health &amp; Lifestyle</title>
<item><title>Doctors Say Sleep &amp; Water Matter</title><link>https://example.org/a1</link>
<description><![CDATA[<p>Short summary.</p>]]></description>
<content:encoded><![CDATA[<p>${'Doctors say sleep matters for health. '.repeat(12)}</p><p>Water &amp; rest help too.<br>Line two.</p>]]></content:encoded>
<media:content url="https://example.org/a1.jpg" /></item>
<item><title>Only a summary</title><link>https://example.org/a2</link><description><![CDATA[<p>Too short.</p>]]></description></item>
<item><title>Description body</title><guid>https://example.org/a3</guid><description><![CDATA[${'Plain description text that is long enough to read. '.repeat(8)}]]></description></item>
</channel></rss>`;

describe('③ rss_text — 본문을 담는 RSS 공용 문(VOA·service-public)', () => {
  it('계열·주제·URL 셋이 다 있어야 긷는다 — 하나라도 없으면 요청 없이 빈 배열(fail-closed)', async () => {
    mockText(RSS);
    expect(await fetchRssText(3, { topic: 'health', url: 'https://x.test/rss' })).toEqual([]);          // 계열 없음
    expect(await fetchRssText(3, { family: 'nyt', topic: 'health', url: 'https://x.test/rss' })).toEqual([]); // 계열 밖(저작물)
    expect(await fetchRssText(3, { family: 'voa', url: 'https://x.test/rss' })).toEqual([]);            // 주제 없음
    expect(await fetchRssText(3, { family: 'voa', topic: 'health', url: 'ftp://x' })).toEqual([]);      // URL 아님
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('전문(content:encoded) 우선, 요약뿐인 항목은 버리고, 출처 줄이 본문 끝에 붙는다', async () => {
    mockText(RSS);
    const out = await fetchRssText(3, { family: 'voa', topic: 'Health', url: 'https://x.test/rss' });
    expect(out.map((a) => a.title)).toEqual(['Doctors Say Sleep & Water Matter', 'Description body']);
    const [a, b] = out;
    expect(a.source).toBe('voa_health');
    expect(a.videoId).toMatch(/^rss_voa_health_[0-9a-f]{8}$/);
    expect(a.channelName).toBe('VOA Learning English');
    expect(a.thumbnail).toBe('https://example.org/a1.jpg');
    expect(a.level).toBe('B1 중급');
    expect(a.transcript).toContain('Water & rest help too.\nLine two.');
    expect(a.transcript.endsWith(`${RSS_FAMILIES.voa.credit} · https://example.org/a1`)).toBe(true);
    expect(a.transcript).not.toMatch(/<[a-z]+>/);
    expect(b.videoId).toMatch(/^rss_voa_health_/);          // guid로 id — 같은 글은 하루 한 번
  });

  it('같은 링크는 같은 id(결정적) — upsert 키 (date, video_id)', async () => {
    mockText(RSS);
    const a = await fetchRssText(1, { family: 'voa', topic: 'health', url: 'https://x.test/rss' });
    mockText(RSS);
    const b = await fetchRssText(1, { family: 'voa', topic: 'health', url: 'https://x.test/rss' });
    expect(a[0].videoId).toBe(b[0].videoId);
  });

  it('계열 레지스트리 — 라이선스·출처 표기가 코드에 산다(설정 표식 아님)', () => {
    expect(RSS_FAMILIES.voa.license).toBe('public-domain');
    expect(RSS_FAMILIES.sp.license).toBe('etalab-2.0');
    expect(RSS_FAMILIES.sp.credit).toContain('Licence Ouverte');
    for (const f of Object.values(RSS_FAMILIES)) expect(f.credit.length).toBeGreaterThan(10);
  });

  it('HTML → 글: 줄바꿈 태그·엔티티·CDATA', () => {
    expect(htmlToText('<![CDATA[<p>a &amp; b</p><p>c&#39;d &#x00e9;</p>]]>')).toBe("a & b\nc'd é");
    expect(parseRssItems(RSS)).toHaveLength(3);
    expect(parseRssItems('')).toEqual([]);
  });

  it('디스패처에 rss_text가 있다', async () => {
    mockText(RSS);
    const out = await fetchFromSource({ source_type: 'rss_text', config: { family: 'sp', topic: 'admin', url: 'https://x.test/rss' } }, 1);
    expect(out[0].source).toBe('sp_admin');
    expect(out[0].channelName).toBe('service-public.fr');
  });
});

describe('④ 편성·시드 — 기본값은 더하기만, 시드는 DDL 없이 행만', () => {
  it('기본값에 NHK 카테고리(ja)·Wikinews 카테고리(en·fr)가 더해졌고 옛 행은 그대로', () => {
    const has = (lang, type, key, val) => DEFAULT_SOURCES.some((s) => s.language === lang && s.source_type === type && s.config?.[key] === val);
    expect(has('Japanese', 'nhk_rss', 'feed', 'cat1')).toBe(true);
    expect(has('Japanese', 'nhk_rss', 'feed', 'cat3')).toBe(true);
    expect(has('English', 'wikinews', 'category', 'Health')).toBe(true);
    expect(has('French', 'wikinews_fr', 'category', 'Santé')).toBe(true);
    // 옛 행(설정 없는 nhk_rss·wikinews_fr)이 남아 있다 — 기존 수집 결과 불변
    expect(DEFAULT_SOURCES.some((s) => s.source_type === 'nhk_rss' && !s.config?.feed)).toBe(true);
    expect(DEFAULT_SOURCES.some((s) => s.source_type === 'wikinews_fr' && !s.config?.category)).toBe(true);
    // rss_text는 기본값에 없다 — URL 미실측(오너 행으로만)
    expect(DEFAULT_SOURCES.some((s) => s.source_type === 'rss_text')).toBe(false);
    expect(DEFAULT_SOURCES.some((s) => s.language === 'Chinese')).toBe(false);
  });

  it('시드 SQL은 행만 넣는다 — DDL 0, 정치 피드 0, rss_text는 주석 템플릿', () => {
    const sql = read('supabase/migrations/20260905100000_content_sources_r4.sql');
    const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    expect(code).not.toMatch(/\b(CREATE|ALTER|DROP)\b/i);
    expect(code).toContain("'nhk_rss'");
    expect(code).toContain('"feed": "cat1"');
    expect(code).toContain('"category": "Health"');
    expect(code).not.toContain('cat4');
    expect(code).not.toContain('cat6');
    expect(code).not.toContain("'rss_text'");          // 실행부에 없다
    expect(sql).toContain("'rss_text'");               // 주석 템플릿에는 있다
  });

  it('크론은 손대지 않았다 — 라벨은 순수 함수가 article.source를 우선한다', () => {
    expect(suggestionSourceLabel({ source: 'nhk_society', videoId: 'nhk_cat1_digest_2026-09-05' })).toBe('nhk_society');
    expect(suggestionSourceLabel({ videoId: 'nhk_cat1_digest_2026-09-05' })).toBe('nhk');
    expect(read('src/app/api/cron/fetch-suggestions/route.js')).toContain('const sourceLabel = suggestionSourceLabel(a);');
  });
});
