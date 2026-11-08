// LAUNCH-META-001 — 검색 · 공유 메타 계약(운영 감사 2026-11-06 KST).
// 감사 실측: 루트 `canonical: '/'`가 모든 화면에 물려 정본 = 첫 화면 · og:url 고정 · 화면별 openGraph가 공유 그림을 지움 ·
// 사이트 지도 7개 손 주소(비공개 /materials · anatomy-studio 기본 주소 · 요청 시각 lastmod) · robots.txt가 개인 화면을 열어 둠 ·
// 없는 뷰어 자료 200 + index · 404에 noindex와 index가 함께.
//
// 이 파일은 실제 모듈을 읽는다: src/app 아래 모든 page · layout을 불러 메타를 풀고(layout → page 순서로 robots를 물려받는 Next 규칙),
// 모든 화면이 ① 자기 정본 주소를 단 공개 화면 ② noindex 화면 ③ 리디렉트만 하는 주소 셋 중 하나임을 본다 — 새 화면은 여기서 분류돼야 통과한다.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const { FONT_NAMES } = vi.hoisted(() => ({ FONT_NAMES: ['Black_Han_Sans', 'Dela_Gothic_One', 'EB_Garamond', 'GFS_Didot', 'Gochi_Hand', 'Goudy_Bookletter_1911', 'IM_Fell_English', 'Inter',
  'Josefin_Sans', 'Jost', 'Kaushan_Script', 'Libre_Caslon_Display', 'Manrope', 'Metamorphous', 'Nanum_Myeongjo', 'Noto_Sans', 'Noto_Sans_JP', 'Noto_Sans_KR',
  'Noto_Sans_SC', 'Noto_Sans_TC', 'Noto_Serif_JP', 'Noto_Serif_KR', 'Noto_Serif_SC', 'Rye', 'Shippori_Mincho_B1', 'Song_Myung', 'Yellowtail', 'Yuji_Syuku'] }));
vi.mock('next/font/google', () => Object.fromEntries(FONT_NAMES.map((name) => [name, () => ({ className: name, variable: name, style: {} })])));

const { viewer } = vi.hoisted(() => ({ viewer: { seed: undefined, query: { data: null, error: null } } }));
vi.mock('@/lib/server/viewerSeed', () => ({
  readViewerSeed: async () => viewer.seed,
  viewerSeedWithin: async () => null,
}));
vi.mock('@/lib/supabaseServer', async (importOriginal) => {
  const actual = await importOriginal();
  const chain = {
    select: () => chain, eq: () => chain, abortSignal: () => chain,
    single: () => Promise.resolve(viewer.query),
  };
  return { ...actual, createSupabaseServerClient: async () => ({ from: () => chain }), createSupabasePublicClient: () => ({ from: () => chain }) };
});

import { DEFAULT_SITE_URL, INDEX_EXTERNAL_SUGGESTIONS, SITE_DESCRIPTION, websiteJsonLd, OG_DEFAULTS, OG_IMAGE, PRIVATE_ROBOTS, ROBOTS_DISALLOW, canonicalFor, publicMetadata, siteUrl, suggestionMetadata, withOgDefaults } from '@/lib/seo';
import { legacyTextbookTarget } from '@/lib/bookNavigation';
import { bookEntries, koreanDate, levelListEntries, materialEntries, studiesEntries } from '@/lib/sitemapEntries';
import { ANALYZED_STATUSES, __setCuratorClient, curatedMaterialIds, curatorIds, isAnalyzedMaterial, isIndexableMaterial } from '@/lib/server/curatedMaterials';
import { STUDY_COUNTRIES } from '@/content/studies';
import robots from '@/app/robots';
import * as rootLayout from '@/app/layout';
import * as notFound from '@/app/not-found';
import * as ogImage from '@/app/opengraph-image';

const ROOT = process.cwd();
const MODULES = import.meta.glob(['/src/app/**/page.jsx', '/src/app/**/layout.jsx']);

/** /src/app/(app)/home/(guest)/page.jsx → /home(그룹 세그먼트를 뺀 주소 모양). */
const routeOf = (file) => {
  const route = file.replace(/^\/src\/app/, '').replace(/\/(page|layout)\.jsx$/, '').split('/').filter((seg) => seg && !/^\(.*\)$/.test(seg)).join('/');
  return `/${route}`;
};
const segmentDirs = (file) => {
  const parts = path.posix.dirname(file).split('/');
  return parts.map((_, i) => parts.slice(0, i + 1).join('/')).filter((dir) => dir.startsWith('/src/app'));
};

// 동적 세그먼트 표본 — generateStaticParams가 없거나 빈 목록인 라우트(첫 방문에 굽는 ISR · 동적 화면)는 이름별 표본 값.
const SAMPLE = { id: '45', team: 't1', day: '1', path: ['japanese'], edition: '8a8c1c1fd452773810abaf8c', hint: 'guest' };
const paramsFor = async (mod, route) => {
  const list = mod.generateStaticParams ? await mod.generateStaticParams() : [];
  if (list[0]) return list[0];
  return Object.fromEntries([...route.matchAll(/\[\[?(?:\.\.\.)?([^\]]+)\]?\]/g)].map(([, name]) => [name, SAMPLE[name] ?? 'x']));
};
const fill = (route, params) => route.replace(/\[\[?\.{0,3}([^\]]+)\]?\]/g, (_, name) => [].concat(params[name] ?? '').join('/'));
const resolveMeta = async (mod, params) => (mod.generateMetadata ? mod.generateMetadata({ params: Promise.resolve(params), searchParams: Promise.resolve({}) }) : mod.metadata);

// 같은 내용의 판(쿠키 · 질의 → middleware가 고르는 내부 경로) — 정본은 주소창의 주소다.
const VARIANT_OF = [
  [/^\/home(\/sc|\/member|\/member\/sc)$/, () => '/home'],
  [/^\/discover\/(sc|reading)$/, () => '/discover'],
  [/^\/lessons\/lang\/[^/]+$/, () => '/lessons'],
  [/^\/books\/(japanese-n[345])\/(cover\/[^/]+|edition\/[^/]+\/[^/]+)$/, (m) => `/books/${m[1]}`],
  [/^\/suggestions\/([^/]+)\/from\/[^/]+$/, (m) => `/suggestions/${m[1]}`],
];
const canonicalPathOf = (concrete) => {
  for (const [pattern, to] of VARIANT_OF) { const m = pattern.exec(concrete); if (m) return to(m); }
  return concrete;
};
// 리디렉트만 하는 주소(화면이 없다) — 이유와 함께. 옛 교재 장 · 언어 첫 화면은 middleware가 보낸다(legacyTextbookTarget · LANGUAGE_HOMES).
const REDIRECT_ONLY = Object.freeze({
  '/': "middleware → /home(로그인 결과만 page.jsx)",
  '/learn': 'middleware → /lessons',
  '/learn/course': 'middleware → /lessons',
  '/japanese': 'middleware → /lessons?lang=Japanese',
  '/chinese': 'middleware → /lessons?lang=Chinese',
  '/english': 'middleware → /lessons?lang=English',
  '/french': 'middleware → /lessons?lang=French',
});
// robots.txt가 막지만 noindex는 달지 않는 곳 — 로그인 판의 내부 경로라 주소창 /home(공개)과 같은 메타를 쓴다.
const DISALLOWED_BUT_PUBLIC = ['/home/member'];

let pages = [];
beforeAll(async () => {
  const loaded = Object.fromEntries(await Promise.all(Object.entries(MODULES).map(async ([file, load]) => [file, await load()])));
  const rootRobots = rootLayout.metadata.robots;
  pages = await Promise.all(Object.keys(loaded).filter((file) => file.endsWith('/page.jsx')).map(async (file) => {
    const route = routeOf(file);
    const mod = loaded[file];
    const params = await paramsFor(mod, route);
    const concrete = fill(route, params);
    const meta = (await resolveMeta(mod, params)) || {};
    // Next 규칙: robots는 가장 가까운 층의 값(layout → page)이 통째로 이긴다.
    let robotsValue = rootRobots;
    for (const dir of segmentDirs(file)) {
      const layout = loaded[`${dir}/layout.jsx`];
      if (layout?.metadata && 'robots' in layout.metadata) robotsValue = layout.metadata.robots;
    }
    if ('robots' in meta) robotsValue = meta.robots;
    return { file, route, concrete, meta, robots: robotsValue };
  }));
}, 120_000);

const isNoindex = (robotsValue) => robotsValue?.index === false;
const isRedirect = (page) => Object.hasOwn(REDIRECT_ONLY, page.route) || legacyTextbookTarget(page.concrete) !== null;
const publicPages = () => pages.filter((page) => !isNoindex(page.robots) && !isRedirect(page));
const disallowed = (urlPath) => ROBOTS_DISALLOW.some((prefix) => urlPath === prefix || urlPath.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`) || (prefix.endsWith('/') && urlPath.startsWith(prefix)));

describe('정본 주소 한 곳 — siteUrl / canonicalFor', () => {
  it('운영 값(NEXT_PUBLIC_SITE_URL)을 출처로 정규화하고, 없으면 기본값', () => {
    expect(siteUrl('https://manabi.co.kr/')).toBe('https://manabi.co.kr');
    expect(siteUrl('https://www.manabi.co.kr/x?y')).toBe('https://www.manabi.co.kr');
    expect(siteUrl('')).toBe(DEFAULT_SITE_URL);
    expect(siteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(siteUrl('not a url')).toBe(DEFAULT_SITE_URL);
    expect(DEFAULT_SITE_URL).toBe('https://www.manabi.co.kr'); // 대표 도메인 = www(DOMAIN-CANONICAL-001) — Vercel 서빙 호스트와 같다
  });

  it('경로만 정본 — 질의 · 조각 · 끝 / 를 버린다', () => {
    const origin = siteUrl();
    expect(canonicalFor('/privacy')).toBe(`${origin}/privacy`);
    expect(canonicalFor('privacy/')).toBe(`${origin}/privacy`);
    expect(canonicalFor('/discover?view=reading#top')).toBe(`${origin}/discover`);
    expect(canonicalFor('/')).toBe(`${origin}/`);
  });

  it('src 안에서 사이트 주소 환경 값을 읽는 곳은 lib/seo 하나 · 옛 기본 주소(anatomy-studio)는 어디에도 없다', () => {
    const hits = [];
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) { if (name !== '__tests__') walk(p); continue; }
        if (!/\.(jsx?|mjs)$/.test(name)) continue;
        const src = fs.readFileSync(p, 'utf8');
        if (src.includes('NEXT_PUBLIC_SITE_URL') || src.includes('anatomy-studio.vercel.app')) hits.push(path.relative(ROOT, p));
      }
    };
    walk(path.join(ROOT, 'src'));
    expect(hits).toEqual(['src/lib/seo.js']);
    expect(fs.readFileSync(path.join(ROOT, 'src/lib/seo.js'), 'utf8')).not.toContain('anatomy-studio');
  });
});

describe('루트 레이아웃 — 정본 · 공유 제목을 물려주지 않는다', () => {
  it('canonical 없음 · og:url 없음 · og/twitter 제목 · 설명 고정 없음 · metadataBase = siteUrl()', () => {
    const meta = rootLayout.metadata;
    expect(meta.alternates).toBeUndefined();
    expect(meta.metadataBase.origin).toBe(siteUrl());
    expect(meta.openGraph).toEqual({ type: OG_DEFAULTS.type, siteName: OG_DEFAULTS.siteName, locale: OG_DEFAULTS.locale });
    expect(meta.twitter).toEqual({ card: 'summary_large_image' });
  });

  it('공유 그림 상수는 opengraph-image.jsx와 같은 그림을 가리킨다', () => {
    expect(OG_IMAGE.alt).toBe(ogImage.alt);
    expect({ width: OG_IMAGE.width, height: OG_IMAGE.height }).toEqual(ogImage.size);
    expect(OG_IMAGE.type).toBe(ogImage.contentType);
    expect(OG_IMAGE.url).toBe('/opengraph-image');
  });
});

describe('모든 화면 분류 — 공개(자기 정본) · noindex · 리디렉트', () => {
  it('분류되지 않는 화면이 없다(공개 화면은 정본 · og:url · 공유 그림을 갖는다)', () => {
    expect(pages.length).toBeGreaterThan(100);
    const problems = [];
    for (const page of publicPages()) {
      const want = canonicalFor(canonicalPathOf(page.concrete));
      const { meta } = page;
      if (meta.alternates?.canonical !== want) problems.push(`${page.file}: canonical ${meta.alternates?.canonical} ≠ ${want}`);
      if (meta.openGraph?.url !== want) problems.push(`${page.file}: og:url ${meta.openGraph?.url} ≠ ${want}`);
      if (meta.openGraph?.images?.[0]?.url !== OG_IMAGE.url) problems.push(`${page.file}: 공유 그림 없음`);
      if (meta.openGraph?.siteName !== 'manabi' || meta.openGraph?.locale !== 'ko_KR' || meta.openGraph?.type !== 'website') problems.push(`${page.file}: og 공통 값 없음`);
    }
    expect(problems).toEqual([]);
  });

  it('공개 화면 표본 — 감사에 나온 주소들이 자기 정본을 단다', () => {
    const byConcrete = new Map(publicPages().map((page) => [page.concrete, page]));
    for (const concrete of ['/home', '/lessons', '/books/japanese-n5', '/discover', '/studies', '/studies/japan', '/studies/japan/jp-overview', '/privacy',
      '/terms', '/help', '/credits', '/guide', '/japanese/vocab/n5', '/viewer/45']) {
      expect(byConcrete.has(concrete), concrete).toBe(true);
    }
    const doc = publicPages().find((page) => page.route === '/studies/[country]/[slug]');
    expect(doc.meta.alternates.canonical).toBe(canonicalFor(doc.concrete));
    expect(doc.meta.alternates.canonical).not.toBe(canonicalFor('/'));
  });

  it('robots.txt가 막는 경로의 화면은 모두 noindex다(로그인 판 내부 경로 /home/member만 예외 — 주소창은 /home)', () => {
    const leaks = publicPages().filter((page) => disallowed(page.concrete) && !DISALLOWED_BUT_PUBLIC.some((p) => page.concrete.startsWith(p)));
    expect(leaks.map((page) => page.file)).toEqual([]);
    // 막은 접두마다 실제 화면이 noindex로 하나 이상 있다(목록이 낡지 않게) — API · 임베드 · 내부 판 경로는 제외.
    for (const prefix of ROBOTS_DISALLOW.filter((p) => !['/api/', '/home/member'].includes(p))) {
      const under = pages.filter((page) => page.concrete === prefix || page.concrete.startsWith(`${prefix}/`));
      expect(under.length, prefix).toBeGreaterThan(0);
      expect(under.filter((page) => !isNoindex(page.robots)).map((page) => page.file), prefix).toEqual([]);
    }
  });

  it('개인 · 로그인 화면(감사 목록)은 noindex, nofollow', () => {
    for (const concrete of ['/study', '/study/library', '/progress', '/progress/report', '/review/grammar', '/quick', '/auth', '/auth/from-link', '/offline',
      '/groups', '/conversation/lobby', '/vocab', '/profile', '/materials', '/materials/add', '/notes/45', '/pdf/45', '/writing', '/admin', '/japanese/reading']) {
      const page = pages.find((p) => p.concrete === concrete);
      expect(page, concrete).toBeTruthy();
      expect(isNoindex(page.robots), concrete).toBe(true);
    }
    expect(PRIVATE_ROBOTS).toEqual({ index: false, follow: false });
  });
});

describe('공유 메타 합치기 — 화면 openGraph가 공통 그림을 지우지 않는다', () => {
  it('withOgDefaults · publicMetadata는 그림 · 사이트 이름 · 언어 · 종류를 깔고 화면 값이 이긴다', () => {
    expect(withOgDefaults({ title: 't' })).toEqual({ ...OG_DEFAULTS, title: 't' });
    const meta = publicMetadata('/x', { title: 'X', openGraph: { title: 'OG' }, alternates: { languages: { ko: '/x' } } });
    expect(meta.title).toBe('X');
    expect(meta.openGraph).toEqual({ ...OG_DEFAULTS, title: 'OG', url: canonicalFor('/x') });
    expect(meta.alternates).toEqual({ languages: { ko: '/x' }, canonical: canonicalFor('/x') });
    // twitter는 화면에서 고정하지 않는다 — Next가 og 제목 · 설명 · 그림을 물려준다(루트도 card만).
    expect(meta.twitter).toBeUndefined();
  });

  it('보관함으로 옮긴 옛 장 화면(문법 등)도 openGraph를 주면 공통 그림을 함께 싣는다', () => {
    const legacy = pages.filter((page) => /\/(grammar|vocab|bunkei)\/\[/.test(page.route) && page.meta.openGraph);
    expect(legacy.length).toBeGreaterThan(5);
    for (const page of legacy) expect(page.meta.openGraph.images, page.file).toEqual(OG_DEFAULTS.images);
  });
});

describe('뷰어 — 없는 자료는 화면 그대로, 검색에서만 뺀다', () => {
  let generateMetadata;
  beforeAll(async () => { ({ generateMetadata } = await import('@/app/(app)/viewer/[id]/page')); });
  beforeEach(() => { viewer.seed = undefined; viewer.query = { data: null, error: null }; });
  const meta = (id) => generateMetadata({ params: Promise.resolve({ id }) });

  it('보이는 자료 = 자기 정본 + 공유 그림', async () => {
    viewer.seed = { id: '45', row: { id: 45, title: '駅前' }, account: null, servedAt: 0 };
    const m = await meta('45');
    expect(m.title).toBe('駅前');
    expect(m.alternates.canonical).toBe(canonicalFor('/viewer/45'));
    expect(m.openGraph).toMatchObject({ url: canonicalFor('/viewer/45'), title: '駅前', images: OG_DEFAULTS.images });
    expect(m.robots).toBeUndefined();
  });

  it('행 없음(실은 쪽 · 제목 조회 0행 · 숫자 아닌 id) = noindex, nofollow · 정본 없음', async () => {
    viewer.seed = { id: '99999999', row: null, account: null, servedAt: 0 };
    for (const m of [await meta('99999999'),
      await (viewer.seed = null, viewer.query = { data: null, error: { code: 'PGRST116' } }, meta('99999999')),
      await (viewer.query = { data: null, error: { code: '22P02' } }, meta('abc'))]) {
      expect(m.robots).toEqual({ index: false, follow: false });
      expect(m.alternates).toBeUndefined();
      expect(m.title).toBe('자료 뷰어');
    }
  });

  it('조회 실패 · 시간 초과는 없는 자료로 치지 않는다(잠깐의 장애로 공개 자료를 빼지 않게)', async () => {
    viewer.seed = null;
    viewer.query = { data: null, error: { code: '', name: 'AbortError', message: 'aborted' } };
    const m = await meta('45');
    expect(m.robots).toBeUndefined();
    expect(m.alternates.canonical).toBe(canonicalFor('/viewer/45'));
  });

  it('기기 사본(local:)은 noindex', async () => {
    expect((await meta('local:1')).robots).toEqual(PRIVATE_ROBOTS);
  });
});

// 서비스 키 클라이언트 흉내 — 표마다 돌려줄 결과와, 받은 거르기 조건을 남긴다.
function fakeService(tables) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      const result = () => (typeof tables[table] === 'function' ? tables[table](call) : tables[table]);
      const chain = {
        select: (cols) => { call.select = cols; return chain; },
        eq: (...a) => { call.filters.push(['eq', ...a]); return chain; },
        in: (...a) => { call.filters.push(['in', a[0], [...a[1]]]); return chain; },
        not: (...a) => { call.filters.push(['not', ...a]); return chain; },
        is: (...a) => { call.filters.push(['is', ...a]); return chain; },
        order: () => chain,
        abortSignal: () => Promise.resolve(result()),
      };
      return chain;
    },
  };
}

describe('뷰어 자료 — 우리가 만든 공개 자료만 검색에 싣는다(LAUNCH-META-002)', () => {
  let generateMetadata;
  beforeAll(async () => { ({ generateMetadata } = await import('@/app/(app)/viewer/[id]/page')); });
  beforeEach(() => { viewer.seed = undefined; viewer.query = { data: null, error: null }; __setCuratorClient(undefined); });
  const meta = (id) => generateMetadata({ params: Promise.resolve({ id }) });
  const curators = () => fakeService({ profiles: { data: [{ id: 'admin-1' }], error: null } });

  it('판정 — 관리자 소유 공개만 싣고, 남의 공개 · 비공개는 뺀다 · 관리자 목록을 모르면 공개 여부만 본다', () => {
    const ids = new Set(['admin-1']);
    expect(isIndexableMaterial({ visibility: 'public', owner_id: 'admin-1' }, ids)).toBe(true);
    expect(isIndexableMaterial({ visibility: 'public', owner_id: 'user-2' }, ids)).toBe(false);
    expect(isIndexableMaterial({ visibility: 'public', owner_id: null }, ids)).toBe(false);
    expect(isIndexableMaterial({ visibility: 'private', owner_id: 'admin-1' }, ids)).toBe(false);
    expect(isIndexableMaterial({ visibility: 'public', owner_id: 'user-2' }, null)).toBe(true);
    expect(isIndexableMaterial({ visibility: 'private', owner_id: 'user-2' }, null)).toBe(false);
  });

  it('남이 공개로 돌린 자료 = noindex, follow · 정본 · 제목은 그대로', async () => {
    __setCuratorClient(curators());
    viewer.seed = { id: '77', row: { id: 77, title: '私の日記', visibility: 'public', owner_id: 'user-2' }, account: null, servedAt: 0 };
    const m = await meta('77');
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(m.title).toBe('私の日記');
    expect(m.alternates.canonical).toBe(canonicalFor('/viewer/77'));
  });

  it('관리자 소유 공개 자료 = robots 없음(색인) — 제목 조회 경로도 공개 · 소유자 칸을 함께 읽는다', async () => {
    __setCuratorClient(curators());
    viewer.seed = { id: '45', row: { id: 45, title: '駅前', visibility: 'public', owner_id: 'admin-1' }, account: null, servedAt: 0 };
    expect((await meta('45')).robots).toBeUndefined();
    viewer.seed = null;
    viewer.query = { data: { title: '日記', visibility: 'public', owner_id: 'user-2' }, error: null };
    expect((await meta('46')).robots).toEqual({ index: false, follow: true });
    const page = fs.readFileSync(path.join(ROOT, 'src/app/(app)/viewer/[id]/page.jsx'), 'utf8');
    // 언어 · 레벨은 설명 한 줄(VIEWER-SEO-001)에 쓴다 — 본문은 읽지 않는다(첫머리는 본문을 실은 행에서만).
    expect(page).toContain(".select('title, visibility, owner_id, analysis_status:processed_json->>status, language:processed_json->metadata->>language, level:processed_json->metadata->>level')");
  });

  it('관리자 목록 조회 실패 · 키 없음 = 빼지 않는다(잠깐의 장애로 공개 자료를 빼지 않게)', async () => {
    __setCuratorClient(fakeService({ profiles: { data: null, error: { code: '57014' } } }));
    viewer.seed = { id: '77', row: { id: 77, title: '日記', visibility: 'public', owner_id: 'user-2' }, account: null, servedAt: 0 };
    expect((await meta('77')).robots).toBeUndefined();
    __setCuratorClient(null);
    expect(await curatorIds()).toBeNull();
    expect((await meta('77')).robots).toBeUndefined();
  });

  it('분석 전(idle · 문장 0) 자료는 관리자 소유 공개여도 뺀다 — 뷰어 SSR과 같은 상태 판정(LAUNCH-META-003)', async () => {
    // 운영 실측 2026-11-07 KST: 공개 123건 중 분석됨 5 · idle 118 — processed_json은 모두 있어 「있음」만으로는 가를 수 없었다.
    const ssr = fs.readFileSync(path.join(ROOT, 'src/lib/viewerSsr.js'), 'utf8');
    expect(ssr).toContain(`new Set([${ANALYZED_STATUSES.map((v) => `'${v}'`).join(', ')}])`);
    const ids = new Set(['admin-1']);
    const base = { visibility: 'public', owner_id: 'admin-1' };
    expect(isAnalyzedMaterial({ ...base, processed_json: { status: 'idle', sequence: [] } })).toBe(false);
    expect(isAnalyzedMaterial({ ...base, processed_json: { status: 'completed', sequence: [] } })).toBe(false);
    expect(isAnalyzedMaterial({ ...base, processed_json: { status: 'partial', sequence: [{}] } })).toBe(true);
    expect(isAnalyzedMaterial({ ...base, analysis_status: 'idle' })).toBe(false);
    expect(isAnalyzedMaterial({ ...base, analysis_status: 'completed' })).toBe(true);
    expect(isAnalyzedMaterial(base)).toBeNull();
    expect(isIndexableMaterial({ ...base, processed_json: { status: 'idle', sequence: [] } }, ids)).toBe(false);
    expect(isIndexableMaterial({ ...base, processed_json: { status: 'idle', sequence: [] } }, null)).toBe(false);
    expect(isIndexableMaterial({ ...base, processed_json: { status: 'completed', sequence: [{}] } }, ids)).toBe(true);
    __setCuratorClient(curators());
    viewer.seed = { id: '50', row: { id: 50, title: 'Cafe', ...base, processed_json: { status: 'idle', sequence: [] } }, account: null, servedAt: 0 };
    expect((await meta('50')).robots).toEqual({ index: false, follow: true });
    viewer.seed = null;
    viewer.query = { data: { title: 'Cafe', ...base, analysis_status: 'idle' }, error: null };
    expect((await meta('50')).robots).toEqual({ index: false, follow: true });
    viewer.query = { data: { title: 'Cafe', ...base, analysis_status: 'completed' }, error: null };
    expect((await meta('50')).robots).toBeUndefined();
  });

  it('관리자 목록은 10분 기억한다(뷰어 메타마다 조회를 늘리지 않게)', async () => {
    const service = curators();
    __setCuratorClient(service);
    await curatorIds(1_000);
    await curatorIds(1_000 + 9 * 60_000);
    expect(service.calls.length).toBe(1);
    await curatorIds(1_000 + 11 * 60_000);
    expect(service.calls.length).toBe(2);
  });

  it('사이트 지도 — 관리자 소유 · 공개 · 분석된 자료만, lastmod 없음 · 키 없으면 빈 목록 · 조회 실패는 던진다(직전 판 유지)', async () => {
    const service = fakeService({
      profiles: { data: [{ id: 'admin-1' }, { id: 'admin-2' }], error: null },
      reading_materials: { data: [{ id: 3 }, { id: 45 }], error: null },
    });
    __setCuratorClient(service);
    expect(await materialEntries()).toEqual([{ url: canonicalFor('/viewer/3') }, { url: canonicalFor('/viewer/45') }]);
    const list = service.calls.find((c) => c.table === 'reading_materials');
    expect(list.select).toBe('id');
    expect(list.filters).toEqual([['is', 'processed_json->metadata->>retired_series', null], // 은퇴 표식 자료는 색인에서도 뺀다(SEED-EXPOSE-001)
      ['eq', 'visibility', 'public'], ['in', 'owner_id', ['admin-1', 'admin-2']],
      ['in', 'processed_json->>status', ['completed', 'partial']], ['not', 'processed_json->sequence->0', 'is', null]]);
    __setCuratorClient(null);
    expect(await curatedMaterialIds()).toEqual([]);
    __setCuratorClient(fakeService({ profiles: { data: [{ id: 'admin-1' }], error: null }, reading_materials: { data: null, error: { code: '57014' } } }));
    await expect(curatedMaterialIds()).rejects.toThrow('57014');
  });
});

// LAUNCH-META-004 — 제목 · 설명 · 사이트 표식(발매 점검 「개선」: 구분자 섞임 · 브랜드 중복 · 책 세 권이 같은 기본 설명).
describe('제목 · 설명 · JSON-LD · favicon.ico', () => {
  const titleText = (title) => (typeof title === 'string' ? title : title?.absolute || title?.default || '');

  it('화면 제목은 「 | 」를 쓰지 않는다 — 구분자는 루트 틀(%s · manabi)의 「 · 」 하나', () => {
    expect(rootLayout.metadata.title.template).toBe('%s · manabi');
    const piped = pages.filter((page) => titleText(page.meta.title).includes(' | ')).map((page) => `${page.file}: ${titleText(page.meta.title)}`);
    expect(piped).toEqual([]);
  });

  it('화면 제목에 브랜드를 직접 넣지 않는다(틀이 붙여 「… · manabi · manabi」가 된다)', () => {
    const branded = pages.filter((page) => typeof page.meta.title === 'string' && /manabi/i.test(page.meta.title)).map((page) => `${page.file}: ${page.meta.title}`);
    expect(branded).toEqual([]);
  });

  it('루트 기본 설명 = 배움 설명 = SITE_DESCRIPTION(옛 「영어·프랑스어 학습 도구」 문장 없음)', () => {
    expect(rootLayout.metadata.description).toBe(SITE_DESCRIPTION);
    expect(pages.find((page) => page.file.endsWith('/home/(guest)/page.jsx')).meta.description).toBe(SITE_DESCRIPTION);
    const stale = pages.filter((page) => /영어·프랑스어·중국어 학습 도구/.test(page.meta.description || '')).map((page) => page.file);
    expect(stale).toEqual([]);
  });

  it('교재 세 권은 책마다 다른 설명을 단다(기본 설명을 물려받지 않는다)', () => {
    const covers = ['japanese-n5', 'japanese-n4', 'japanese-n3'].map((id) => pages.find((page) => page.file === `/src/app/(app)/books/${id}/page.jsx`).meta.description);
    expect(new Set(covers).size).toBe(3);
    for (const [i, level] of ['N5', 'N4', 'N3'].entries()) expect(covers[i]).toMatch(new RegExp(`^JLPT ${level} 일본어 교재 — `));
    for (const description of covers) expect(description).not.toBe(SITE_DESCRIPTION);
  });

  it('사이트 JSON-LD(WebSite)는 손님 배움 판에만 · 정본 호스트 · 「<」는 이스케이프 — 자료 한 편(LearningResource)은 뷰어 서버 본문(materialSeo.test.js)', () => {
    expect(websiteJsonLd()).toEqual({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'manabi', url: `${siteUrl()}/`, inLanguage: 'ko', description: SITE_DESCRIPTION });
    const guest = fs.readFileSync(path.join(ROOT, 'src/app/(app)/home/(guest)/page.jsx'), 'utf8');
    expect(guest).toContain('<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()).replace(/</g, \'\\\\u003c\') }} />');
    const withLd = Object.keys(MODULES).filter((file) => fs.readFileSync(path.join(ROOT, file), 'utf8').includes('application/ld+json'));
    expect(withLd).toEqual(['/src/app/(app)/home/(guest)/page.jsx', '/src/app/(app)/viewer/[id]/page.jsx']);
  });

  it('/favicon.ico — 16 · 32 · 48 ICO(favicon.svg를 그린 것, 바탕색 #994A5A)', () => {
    const ico = fs.readFileSync(path.join(ROOT, 'public/favicon.ico'));
    expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => ico[6 + i * 16] || 256).sort((a, b) => a - b);
    expect(sizes).toEqual([16, 32, 48]);
    expect(fs.readFileSync(path.join(ROOT, 'public/favicon.svg'), 'utf8')).toContain('fill="#994A5A"');
  });
});

describe('404 — robots 한 줄(Next의 noindex)만 · 첫 화면 정본 없음', () => {
  it('not-found 메타는 robots를 비우고 정본을 두지 않는다', () => {
    expect(notFound.metadata).toHaveProperty('robots', null);
    expect(notFound.metadata.alternates).toBeUndefined();
  });
});

describe('지역학 없는 주소 — robots 한 줄(쪽의 notFound noindex)', () => {
  it('없는 나라 · 문서의 메타는 robots를 비운다(루트 index, follow와 겹치지 않게) · 정본 없음', async () => {
    const country = await import('@/app/(app)/studies/[country]/page');
    const doc = await import('@/app/(app)/studies/[country]/[slug]/page');
    for (const m of [await country.generateMetadata({ params: Promise.resolve({ country: 'nope' }) }),
      await doc.generateMetadata({ params: Promise.resolve({ country: 'japan', slug: 'nope' }) })]) {
      expect(m).toHaveProperty('robots', null);
      expect(m.alternates).toBeUndefined();
    }
  });
});

describe('robots.txt', () => {
  it('개인 · 앱 전용 화면을 막고, 사이트 지도는 정본 호스트', () => {
    const txt = robots();
    expect(txt.rules).toEqual([{ userAgent: '*', allow: '/', disallow: [...ROBOTS_DISALLOW] }]);
    expect(txt.sitemap).toBe(`${siteUrl()}/sitemap.xml`);
    for (const p of ['/study', '/progress', '/review', '/quick', '/auth', '/offline', '/home/member', '/groups', '/conversation', '/vocab', '/profile', '/materials', '/api/', '/admin']) {
      expect(ROBOTS_DISALLOW).toContain(p);
    }
    // 접두 일치가 공개 화면을 막지 않는다 — /study ≠ /studies, /review ≠ /books/…/review
    for (const open of ['/studies', '/studies/japan', '/home', '/discover', '/lessons', '/viewer/45', '/books/japanese-n5']) expect(disallowed(open), open).toBe(false);
  });
});

describe('사이트 지도 — 실제 원천 · 공개 화면만 · 안정된 lastmod', () => {
  let sitemap;
  beforeAll(async () => {
    vi.doMock('@/lib/textbook/server', async (importOriginal) => ({
      ...(await importOriginal()),
      // e2e 대역처럼 책과 상관없이 N5 발행 행을 돌려준다 — 그 책의 행일 때만 발행으로 친다(N4 · N3는 빠져야 한다).
      readRelease: async () => ({ book_id: 'japanese-n5', edition_id: '8a8c1c1fd452773810abaf8c' }),
      readEditionStamp: async (_db, edition) => ({ book_id: 'japanese-n5', edition_id: edition, published_at: '2026-10-20T03:00:00+00:00' }),
    }));
    vi.resetModules();
    sitemap = (await import('@/app/sitemap')).default;
  });

  it('공개 화면만, 정본 호스트로 — 비공개 · 막은 경로 · 옛 장 · 리디렉트 없음', async () => {
    const entries = await sitemap();
    const publicCanonicals = new Set(publicPages().map((page) => canonicalFor(canonicalPathOf(page.concrete))));
    // 표본 판으로 확인하지 못하는 동적 공개 라우트(나라 · 문서 · 레벨 · 교재)는 해당 page 파일이 공개 분류인지로 본다.
    const publicRoutes = new Set(publicPages().map((page) => page.route));
    const origin = siteUrl();
    for (const { url } of entries) {
      expect(url.startsWith(`${origin}/`), url).toBe(true);
      const p = url.slice(origin.length);
      expect(disallowed(p), p).toBe(false);
      expect(legacyTextbookTarget(p), p).toBe(null);
      const known = publicCanonicals.has(url) || [...publicRoutes].some((route) => new RegExp(`^${route.replace(/\[[^\]]+\]/g, '[^/]+')}$`).test(p));
      expect(known, p).toBe(true);
    }
    const urls = entries.map((e) => e.url.slice(origin.length));
    expect(urls).toEqual(expect.arrayContaining(['/home', '/lessons', '/books/japanese-n5', '/discover', '/studies', '/studies/japan/jp-culture', '/japanese/vocab/n5', '/privacy']));
    expect(urls).not.toContain('/materials');
    expect(urls).not.toContain('/books/japanese-n4'); // 발행 안 한 책
    expect(urls).not.toContain('/books/japanese-n3');
    expect(urls.filter((u) => u.startsWith('/japanese/grammar'))).toEqual([]);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('lastmod는 내용 날짜 — 두 번 불러도 같고, 요청 시각이 아니다', async () => {
    const first = await sitemap();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await sitemap()).toEqual(first);
    for (const entry of first) {
      if (!('lastModified' in entry)) continue;
      expect(typeof entry.lastModified, entry.url).toBe('string');
      expect(entry.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}/);
    }
    const docs = STUDY_COUNTRIES.flatMap((c) => c.docs.map((d) => [canonicalFor(`/studies/${c.id}/${d.slug}`), d.updated]));
    for (const [url, updated] of docs) expect(first.find((e) => e.url === url)?.lastModified).toBe(updated);
    expect(first.find((e) => e.url === canonicalFor('/books/japanese-n5')).lastModified).toBe('2026-10-20T03:00:00+00:00');
  });

  it('조립 부품 — 지역학 · 레벨 · 교재 · 날짜', async () => {
    expect(koreanDate('2026년 10월 19일')).toBe('2026-10-19');
    expect(koreanDate('없음')).toBeUndefined();
    const levels = levelListEntries().map((e) => e.url.slice(siteUrl().length));
    expect(levels).toEqual(expect.arrayContaining(['/japanese/vocab/n1', '/japanese/bunkei/n5', '/chinese/vocab/h7', '/chinese/hanzi/h2']));
    expect(levels).not.toContain('/chinese/bunkei/h7'); // H7은 단어만
    expect(levels).not.toContain('/chinese/hanzi/h3');
    const studies = studiesEntries();
    expect(studies[0]).toEqual({ url: canonicalFor('/studies'), lastModified: STUDY_COUNTRIES.flatMap((c) => c.docs.map((d) => d.updated)).sort().at(-1) });
    const books = await bookEntries(async (bookId) => (bookId === 'japanese-n3' ? { published_at: '2026-11-01' } : null));
    expect(books).toEqual([{ url: canonicalFor('/books/japanese-n3'), lastModified: '2026-11-01' }]);
  });
});

describe('추천 읽을거리(RSS 외부 기사) — 기본 noindex · 사이트 지도 제외 · 스위치 한 줄', () => {
  it('기본값은 끔 — 네 판(서재 · home · discover · reading) 모두 noindex, 정본은 글 한 편', async () => {
    expect(INDEX_EXTERNAL_SUGGESTIONS).toBe(false);
    const files = pages.filter((page) => page.route.startsWith('/suggestions/[id]'));
    expect(files.length).toBe(4);
    for (const page of files) {
      expect(isNoindex(page.meta.robots), page.file).toBe(true);
      expect(page.meta.alternates.canonical).toBe(canonicalFor('/suggestions/45'));
    }
  });
  it('스위치를 켜면 자기 정본 공개 화면(robots 없음)이 된다', () => {
    const on = suggestionMetadata('45', { title: '추천 읽을거리' }, true);
    expect(on.robots).toBeUndefined();
    expect(on.alternates.canonical).toBe(canonicalFor('/suggestions/45'));
    expect(on.openGraph.images[0].url).toBe(OG_IMAGE.url);
  });
  it('사이트 지도에 추천 읽을거리 주소가 없다', async () => {
    const { default: sitemap } = await import('@/app/sitemap');
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((url) => url.includes('/suggestions/'))).toBe(false);
  });
});
