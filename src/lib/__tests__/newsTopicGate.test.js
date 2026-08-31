import { describe, expect, it, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GATES, normalizeCategory, passesTopicGate, ZH_BLOCKED, ZH_SAFE } from '../newsTopicGate';
import { fetchWikinews } from '../content-sources';
import { DEFAULT_SOURCES } from '../suggestionSources';

/**
 * 계약: v2-F R3 — 중국어 공급의 **선행 조건**. 오너 "나머지 차근차근 ㄱㄱ"(2026-08-31).
 *
 * F R2는 중국어를 「DB 행 하나면 켜진다」고 적었고 그건 틀렸다(#1221 정정). 실제로 막고
 * 있던 것은 둘이다 — ① `content_sources.language` CHECK 제약 ② **정치 기사 필터 부재**.
 * ①은 마이그레이션, ②가 이 라운드다.
 *
 * ── 왜 allowlist인가 (판정을 뒤집은 이유)
 *
 * 하드리밋은 「중화권 정치 서술 **완전** 배제」다. 키워드 denylist는 "걸린 것만" 막으므로
 * 미분류·미매칭 기사가 그대로 샌다 — 「완전」이 성립하지 않는다. 그래서 안전 분류가
 * **확인된** 기사만 통과시키고 나머지는 전부 거부한다. 수확량을 잃는 쪽이 새는 쪽보다 싸다.
 *
 * ⚠ **미검증**: 이 세션은 `*.wikinews.org` 전 호스트가 egress 차단(403 CONNECT)이라
 * **실제 zh 피드에 대고 돌려보지 못했다**. 그래서 zh를 기본 소스에 넣지 않았다 —
 * 게이트만 놓고, 켜는 것은 오너 몫으로 남긴다(아래 마지막 describe).
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const zh = GATES.zhNonPolitical;

afterEach(() => { vi.unstubAllGlobals(); });

describe('주제 게이트 — fail-closed가 본체다', () => {
  it('카테고리가 없으면 거부한다 — denylist였다면 여기서 샌다', () => {
    // 이 한 줄이 allowlist와 denylist를 가른다. 뒤집히면 미분류 정치 기사가 전부 통과한다.
    expect(passesTopicGate([], zh)).toBe(false);
    expect(passesTopicGate(null, zh)).toBe(false);
    expect(passesTopicGate(undefined, zh)).toBe(false);
  });

  it('안전 분류가 하나도 없으면 거부한다 — 「정치가 아님」으로는 부족하다', () => {
    // 경제·사회는 차단 목록에 없지만 안전 목록에도 없다. 통과시키면 그게 denylist다.
    expect(passesTopicGate(['分类:经济'], zh)).toBe(false);
    expect(passesTopicGate(['分类:社会'], zh)).toBe(false);
  });

  it('안전 분류가 있으면 통과한다 — 게이트지 차단기가 아니다', () => {
    expect(passesTopicGate(['分类:科技'], zh)).toBe(true);
    expect(passesTopicGate(['分類:體育', '分類:日本'], zh)).toBe(true);
  });

  it('中国 분류 자체는 막지 않는다 — 막으면 zh 피드가 통째로 사라진다', () => {
    // 하드리밋은 「중화권 **정치** 서술」이지 중국 언급이 아니다. 여기를 막으면 게이트가
    // 차단기가 되고, 그건 개통이 아니라 개통 포기다.
    expect(passesTopicGate(['分类:科技', '分类:中国'], zh)).toBe(true);
  });
});

describe('주제 게이트 — 차단은 주제를 이긴다', () => {
  it('정치 분류는 안전 분류가 같이 있어도 거부한다', () => {
    // 실제 위키 기사는 카테고리를 여럿 단다. 「하나라도 안전하면 통과」였다면
    // 政治+科技 기사가 들어온다 — 이 계약이 그 우선순위를 고정한다.
    expect(passesTopicGate(['分类:政治', '分类:科技'], zh)).toBe(false);
  });

  it('민감지역은 주제와 무관하게 거부한다 — 하드리밋 「지리·외관만」', () => {
    for (const region of ['台湾', '臺灣', '香港', '澳门', '西藏', '新疆']) {
      expect(passesTopicGate([`分类:${region}`, '分类:科技'], zh), region).toBe(false);
    }
  });

  it('번체·간체를 함께 막는다 — 한쪽만 실으면 다른 표기로 그대로 샌다', () => {
    expect(passesTopicGate(['分類:選舉', '分類:文化'], zh)).toBe(false);  // 번체
    expect(passesTopicGate(['分类:选举', '分类:文化'], zh)).toBe(false);  // 간체
  });

  it('합성 분류명도 잡는다 — 실제 분류는 `日本政治`처럼 붙어 온다', () => {
    // 완전 일치로 판정하면 실전에서 거의 안 맞는다(그래서 부분 일치다).
    expect(passesTopicGate(['分类:日本政治', '分类:科技'], zh)).toBe(false);
    expect(passesTopicGate(['分类:科技新聞'], zh)).toBe(true);
  });

  it('목록 둘이 실제로 채워져 있다 — 빈 배열이면 모든 검사가 공허해진다', () => {
    // A 축에서 공허한 하한 검사에 두 번 물렸다. 목록이 비면 위 계약들이 "통과 0"으로
    // 전부 만족되므로, 재료가 있다는 것부터 고정한다.
    expect(ZH_BLOCKED.length).toBeGreaterThan(20);
    expect(ZH_SAFE.length).toBeGreaterThan(15);
    expect(ZH_BLOCKED).toContain('政治');
  });
});

describe('주제 게이트 — 네임스페이스 표기 차이를 흡수한다', () => {
  it('Category:·分类:·分類: 접두사를 떼고 본다', () => {
    expect(normalizeCategory('Category:政治')).toBe('政治');
    expect(normalizeCategory('分类:科技')).toBe('科技');
    expect(normalizeCategory('分類:體育')).toBe('體育');
    expect(normalizeCategory('科技')).toBe('科技');
  });

  it('접두사가 붙은 채로도 정치를 막는다 — 실제 API는 접두사를 붙여 준다', () => {
    expect(passesTopicGate(['Category:政治', 'Category:科技'], zh)).toBe(false);
  });
});

describe('주제 게이트 — 게이트 없는 언어판은 건드리지 않는다', () => {
  it('gate가 없으면 무조건 통과 — F R2로 연 프랑스어의 생명줄이다', () => {
    // en/fr에 같은 allowlist를 씌우면 이미 열린 공급이 조용히 말라붙는다.
    expect(passesTopicGate([], null)).toBe(true);
    expect(passesTopicGate(['Category:Politics'], undefined)).toBe(true);
  });
});

describe('배선 — 게이트가 실제로 zh 수집에 걸린다', () => {
  /** recentchanges 목록 + 기사별 본문·카테고리를 흉내낸다. */
  const mockWiki = (byTitle) => vi.stubGlobal('fetch', vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('list=recentchanges')) {
      return { ok: true, json: async () => ({
        query: { recentchanges: Object.keys(byTitle).map((title) => ({ title })) },
      }) };
    }
    const title = decodeURIComponent((u.match(/titles=([^&]*)/) || [])[1] || '');
    return { ok: true, json: async () => ({ query: { pages: { 1: {
      extract: '본문 '.repeat(120),
      categories: (byTitle[title] || []).map((t) => ({ title: t })),
    } } } }) };
  }));

  it('zh에서 정치 기사는 산출에 안 들어온다', async () => {
    mockWiki({ 政治記事: ['分类:政治'], 科技記事: ['分类:科技'] });
    const out = await fetchWikinews(5, 'zh');
    expect(out.map((a) => a.title)).toEqual(['科技記事']);
  });

  it('zh에서 미분류 기사도 안 들어온다 — 배선이 fail-closed를 보존한다', async () => {
    // 순수 함수만 맞고 배선이 `categories`를 안 넘기면 이 검사만 깨진다.
    mockWiki({ 무분류: [], 科技記事: ['分类:科技'] });
    expect((await fetchWikinews(5, 'zh')).map((a) => a.title)).toEqual(['科技記事']);
  });

  it('fr은 카테고리가 없어도 그대로 수집된다 — F R2 회귀 방지', async () => {
    mockWiki({ 'Sujet A': [], 'Sujet B': [] });
    expect(await fetchWikinews(2, 'fr')).toHaveLength(2);
  });

  it('en도 그대로다', async () => {
    mockWiki({ 'Topic A': [] });
    expect(await fetchWikinews(1, 'en')).toHaveLength(1);
  });

  it('본문과 카테고리를 한 번에 받는다 — 게이트가 기사당 왕복을 늘리지 않는다', async () => {
    // 따로 부르면 게이트가 대부분을 거부하는 만큼 왕복이 곱해진다.
    mockWiki({ 科技記事: ['分类:科技'] });
    await fetchWikinews(1, 'zh');
    const articleUrls = globalThis.fetch.mock.calls
      .map((c) => String(c[0])).filter((u) => u.includes('titles='));
    expect(articleUrls).toHaveLength(1);
    expect(articleUrls[0]).toContain('extracts');
    expect(articleUrls[0]).toContain('categories');
  });

  it('게이트가 붙은 언어판은 후보를 더 넓게 긷는다 — allowlist라 수확률이 낮다', async () => {
    mockWiki({ A: ['分类:科技'] });
    await fetchWikinews(3, 'zh');
    const list = String(globalThis.fetch.mock.calls[0][0]);
    const zhLimit = Number((list.match(/rclimit=(\d+)/) || [])[1]);
    mockWiki({ A: [] });
    await fetchWikinews(3, 'fr');
    const frLimit = Number((String(globalThis.fetch.mock.calls[0][0]).match(/rclimit=(\d+)/) || [])[1]);
    expect(zhLimit).toBeGreaterThan(frLimit);
  });
});

describe('개통은 여전히 오너 결정이다 — 게이트를 놨다고 켜지 않는다', () => {
  it('기본 소스에 Chinese가 없다 — 실피드로 검증하지 못한 게이트를 배포로 켜지 않는다', () => {
    expect(DEFAULT_SOURCES.map((s) => s.language)).not.toContain('Chinese');
  });

  it('마이그레이션이 French·Chinese를 허용한다 — 이제 진짜로 "행 하나"가 된다', () => {
    const sql = read('supabase/migrations/20260831120000_content_sources_langs.sql');
    expect(sql).toContain('content_sources_language_check');
    expect(sql).toMatch(/CHECK\s*\(language IN \('Japanese', 'English', 'French', 'Chinese'\)\)/);
    expect(sql, '교체 전 DROP이 없으면 재적용이 깨진다').toContain('DROP CONSTRAINT IF EXISTS');
  });

  it('프랑스어 off 스위치도 이 마이그레이션이 만든다 — F R2가 남긴 구멍이다', () => {
    // French 행을 못 넣으니 코드 기본값으로 열린 프랑스어를 DB로 끌 방법이 없었다.
    const sql = read('supabase/migrations/20260831120000_content_sources_langs.sql');
    expect(sql).toContain("'French', 'wikinews_fr'");
    expect(sql).toContain('false');
  });
});
