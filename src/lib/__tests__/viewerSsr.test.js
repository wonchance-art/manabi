// VIEWER-SSR-001 — 손님의 분석된 공개 자료는 본문까지 서버가 그린다(시제품, 2026-11-02 KST).
// ① 어떤 문서만 그리나(viewerSsrRow) ② 첫 그림 전 판정(viewerSsrHold)이 감추지 않으면 이 기기의 설정 · 화면 언어가 서버 그림(기본값)과
// 정말 같은가(readViewerPreferences · readViewerLanguagePreferences와 대조) ③ 받아들임(adoptViewerSeed)이 버릴 문서는 늘 감추나
// ④ 쪽 넘김 상자 높이 식이 usePagedReader와 같은가 ⑤ 배선(쪽 · 뷰어 · 설정 · CSS).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';
import { viewerSsrRow, viewerSsrHold, viewerSsrFit, viewerSsrGuardScript, VIEWER_SSR_MAX_SKEW_MS } from '../viewerSsr';
import { readViewerPreferences, viewerDefaults, VIEWER_PREF_KEY } from '../viewerPreferences';
import { readViewerLanguagePreferences, VIEWER_LANGUAGE_PREF_KEY } from '../viewerLanguage';
import { VIEWER_SEED_MAX_SKEW_MS } from '../viewerMaterial';
import { pageHeightFor, pageLabel } from '../usePagedReader';

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const ROW = { id: 45, visibility: 'public', title: '자료', raw_text: '本', processed_json: { status: 'completed', metadata: { language: 'Japanese' }, sequence: ['id_0_0'], dictionary: {} } };
const seed = (over = {}) => ({ id: '45', row: ROW, account: null, servedAt: 1_000_000, ...over });
const withJson = (patch) => ({ ...ROW, processed_json: { ...ROW.processed_json, ...patch } });
const withMeta = (patch) => withJson({ metadata: { ...ROW.processed_json.metadata, ...patch } });

describe('① 서버가 본문까지 그리는 문서', () => {
  it('손님(세션 쿠키 없음)의 분석된 공개 자료 · 질의 없음(또는 returnTo만)', () => {
    expect(viewerSsrRow(seed(), '45')).toBe(ROW);
    expect(viewerSsrRow(seed(), '45', { returnTo: '/materials' })).toBe(ROW);
    expect(viewerSsrRow(seed(), '45', new URLSearchParams('returnTo=%2Fdiscover'))).toBe(ROW);
    expect(viewerSsrRow(seed({ row: withJson({ status: 'partial' }) }), '45')).not.toBeNull();
  });
  it.each([
    ['로그인 계정이 읽은 행', seed({ account: 'A' })],
    ['계정을 모름', seed({ account: undefined })],
    ['비공개', seed({ row: { ...ROW, visibility: 'private' } })],
    ['다른 id', seed({ id: '46' })],
    ['서버 시각 없음', seed({ servedAt: undefined })],
    ['분석 전', seed({ row: withJson({ status: 'pending' }) })],
    ['분석 중', seed({ row: withJson({ status: 'analyzing' }) })],
    ['빈 본문', seed({ row: withJson({ sequence: [] }) })],
    ['대화', seed({ row: withMeta({ conversation: { version: 1, turns: [] } }) })],
    ['작성기', seed({ row: withMeta({ composer: { version: 1 } }) })],
    ['학습 노트', seed({ row: withMeta({ studyNote: { version: 1 } }) })],
    ['행 없음', seed({ row: null })],
    ['중국어(병음 칸 폭을 붙은 뒤 잰다)', seed({ row: withMeta({ language: 'Chinese' }) })],
    ['seed 없음', null],
  ])('%s → 지금처럼(불러오기 그림)', (_, s) => { expect(viewerSsrRow(s, '45')).toBeNull(); });
  it('returnTo 말고 다른 질의가 있으면(문장 찾아가기 · 수업 · 작성기 원본) 그리지 않는다', () => {
    for (const q of ['sourceEntry=1', 'study=1', 'original=1', 'team=x', 'returnTo=%2Fa&sourceQuote=b']) expect(viewerSsrRow(seed(), '45', new URLSearchParams(q))).toBeNull();
    expect(viewerSsrRow(seed(), '45', { study: '1' })).toBeNull();
  });
});

// 판정용 가짜 창 — localStorage 사본 · 온라인 · 문서 연 시각 · 음성.
function fakeWindow(items = {}, over = {}) {
  const store = new Map(Object.entries(items));
  return { localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null) }, navigator: { onLine: true }, performance: { timeOrigin: 1_000_000 },
    speechSynthesis: {}, SpeechSynthesisUtterance: function SpeechSynthesisUtterance() {}, ...over };
}
const options = (language) => ({ language, defaults: viewerDefaults(language), prefKey: VIEWER_PREF_KEY, langKey: VIEWER_LANGUAGE_PREF_KEY, servedAt: 1_000_000, maxSkew: VIEWER_SSR_MAX_SKEW_MS });
const LANGS = ['Japanese', 'Chinese', 'English', 'Korean', 'French'];

describe('② 감추지 않으면 이 기기 설정 = 서버 그림(기본값)', () => {
  // 저장값 공간 — 기본값 · 다른 값 · 옛 기본(0.25 간격 · 훈음 끔) · 깨진 값 · 옛 낱개 저장 · 다른 언어 칸 · 표식.
  const pick = (rand, list) => list[Math.floor(rand() * list.length)];
  const rng = (seedValue) => () => { seedValue = (seedValue * 1103515245 + 12345) % 2147483648; return seedValue / 2147483648; };
  const VALUES = { fontSize: [1.6, 2.2, 0.5, '1.6'], pinyinSize: [0.75, 1], lineGap: [15, 30], charGap: [0, 0.25, 0.5], theme: ['sepia', 'dark', 'light', 'neon'], fontFamily: ['sans', 'serif', 'inter'],
    zhScript: ['hans', 'hant'], pronDisplay: ['all', 'none', 'unknown'], autoSpeakOnClick: [false, true], ttsRate: ['normal', 'fast'], showHanjaKo: [true, false], showToneColors: [false, true],
    focusMode: [false, true], wordStateHl: [false, true], showPatterns: [false, true], patternFilter: ['all', 'due'], autoPace: [false, true], paceCpm: [null, 300], paceStep: [0, 3], readerView: ['paged', 'scroll'] };
  function randomStorage(rand) {
    const items = {};
    const subset = () => Object.fromEntries(Object.keys(VALUES).filter(() => rand() < 0.15).map((k) => [k, pick(rand, VALUES[k])]));
    const shape = rand();
    if (shape < 0.6) {
      const languages = {};
      for (const l of LANGS) if (rand() < 0.5) languages[l] = subset();
      const stored = { version: rand() < 0.9 ? 2 : 1, languages, ...(rand() < 0.5 ? { common: subset() } : {}) };
      if (rand() < 0.3) stored.cjkGap0 = ['Japanese', 'Chinese'].filter(() => rand() < 0.5);
      if (rand() < 0.3) stored.hunOn = rand() < 0.5 ? ['Chinese'] : [];
      items[VIEWER_PREF_KEY] = JSON.stringify(stored);
    } else if (shape < 0.7) items[VIEWER_PREF_KEY] = pick(rand, ['{', '"x"', 'null', '[]', '42']);
    if (rand() < 0.3) for (const [k, v] of Object.entries(subset())) items[`viewer_${k}`] = JSON.stringify(v);
    if (rand() < 0.1) items.viewer_showFurigana = pick(rand, ['false', 'true', '"x"']);
    if (rand() < 0.3) items[VIEWER_LANGUAGE_PREF_KEY] = JSON.stringify({ version: pick(rand, [1, 2]), uiLocale: pick(rand, ['ko', 'en', 'ja', undefined]), explanationLocale: pick(rand, ['ko', 'zh-CN', undefined]) });
    return items;
  }
  it('무작위 저장값 4,000판 × 5언어 — 판정이 통과시킨 판은 설정 · 화면 언어가 기본값과 같다(그리고 기본과 같은 판은 넉넉히 통과)', () => {
    const rand = rng(20261102);
    let passed = 0, defaultsSeen = 0;
    for (let i = 0; i < 4000; i++) {
      const items = randomStorage(rand);
      for (const language of LANGS) {
        const w = fakeWindow(items);
        const reason = viewerSsrHold(w, options(language));
        const prefs = readViewerPreferences(w.localStorage, language);
        const lang = readViewerLanguagePreferences(w.localStorage);
        const same = JSON.stringify(prefs) === JSON.stringify(viewerDefaults(language)) && lang.uiLocale === 'ko' && lang.explanationLocale === 'ko';
        if (same) defaultsSeen++;
        if (!reason) { passed++; expect(same, JSON.stringify({ items, language })).toBe(true); }
      }
    }
    expect(passed).toBeGreaterThan(2000);
    // 기본과 같은데 감추는 판(보수적 — 깨진 값 · 옛 기본 0.25 · 쓸모없는 키처럼 읽을 때 기본으로 접히는 값)은 지금처럼 그릴 뿐이다.
    expect(passed / defaultsSeen).toBeGreaterThan(0.6);
  });
  it('기존 e2e처럼 기본과 같은 값만 저장한 기기 · 아무것도 없는 기기는 감추지 않는다', () => {
    expect(viewerSsrHold(fakeWindow(), options('Japanese'))).toBe('');
    expect(viewerSsrHold(fakeWindow({ [VIEWER_PREF_KEY]: JSON.stringify({ version: 2, languages: { Japanese: { autoSpeakOnClick: false } } }) }), options('Japanese'))).toBe('');
  });
  it('글자 크기 · 후리가나 끔 · 스크롤 보기 · 테마 · 화면 언어 · 저장소 막힘이면 감춘다', () => {
    const v2 = (languages, common) => ({ [VIEWER_PREF_KEY]: JSON.stringify({ version: 2, languages, ...(common ? { common } : {}) }) });
    expect(viewerSsrHold(fakeWindow(v2({ Japanese: { fontSize: 2.2 } })), options('Japanese'))).toBe('prefs');
    expect(viewerSsrHold(fakeWindow(v2({ Japanese: { pronDisplay: 'none' } })), options('Japanese'))).toBe('prefs');
    expect(viewerSsrHold(fakeWindow(v2({}, { readerView: 'scroll' })), options('Japanese'))).toBe('prefs');
    expect(viewerSsrHold(fakeWindow(v2({}, { theme: 'dark' })), options('English'))).toBe('prefs');
    expect(viewerSsrHold(fakeWindow({ viewer_fontSize: '2' }), options('English'))).toBe('prefs');
    expect(viewerSsrHold(fakeWindow({ [VIEWER_LANGUAGE_PREF_KEY]: JSON.stringify({ version: 1, uiLocale: 'en' }) }), options('Japanese'))).toBe('locale');
    expect(viewerSsrHold({ ...fakeWindow(), get localStorage() { throw new Error('blocked'); } }, options('Japanese'))).toBe('storage');
  });
});

describe('③ 받아들임이 버릴 문서 · 서버 그림과 다를 툴바는 감춘다', () => {
  it('신선도 한도는 받아들임과 같다', () => { expect(VIEWER_SSR_MAX_SKEW_MS).toBe(VIEWER_SEED_MAX_SKEW_MS); });
  it('끊김 · 옛 문서(문서 연 시각과 서버 시각이 한도 밖) · 시각 모름 · 브라우저 음성 없음', () => {
    expect(viewerSsrHold(fakeWindow({}, { navigator: { onLine: false } }), options('Japanese'))).toBe('offline');
    expect(viewerSsrHold(fakeWindow({}, { performance: { timeOrigin: 1_000_000 + VIEWER_SSR_MAX_SKEW_MS + 1 } }), options('Japanese'))).toBe('stale');
    expect(viewerSsrHold(fakeWindow({}, { performance: { timeOrigin: 1_000_000 - VIEWER_SSR_MAX_SKEW_MS - 1 } }), options('Japanese'))).toBe('stale');
    expect(viewerSsrHold(fakeWindow({}, { performance: {} }), options('Japanese'))).toBe('stale');
    expect(viewerSsrHold(fakeWindow({}, { performance: { timeOrigin: 1_000_000 + VIEWER_SSR_MAX_SKEW_MS } }), options('Japanese'))).toBe('');
    expect(viewerSsrHold(fakeWindow({}, { speechSynthesis: undefined }), options('Japanese'))).toBe('tts');
  });
});

// 쪽 상자 · 쪽 막대 · 레이아웃 · <html> 흉내. 쪽 끝 표지(data-page-end)는 endLeft에 있다(쪽 폭 width · 단 사이 gap).
function fakeDom({ visible = 851, top = 300, bar = 52, padding = '12px', hidden = false, scale = 1, width = 345, gap = 64, endLeft = 24, sectioned = false } = {}) {
  const set = {}, attrs = {};
  const layout = { querySelector: (sel) => (sel === '.reader-pagebar' ? { hidden: false, getBoundingClientRect: () => ({ height: bar }) } : null) };
  const pages = { parentElement: hidden ? { hidden: true, parentElement: null } : null, closest: () => layout, clientWidth: width, clientLeft: 0, scrollWidth: width,
    getBoundingClientRect: () => ({ top, left: 24 }), getAttribute: (k) => (sectioned && k === 'data-section-tail' ? 'off' : null), hasAttribute: () => false,
    querySelector: (sel) => (sel === '[data-page-end]' ? { getBoundingClientRect: () => ({ left: endLeft }) } : null) };
  const d = { querySelector: () => pages, documentElement: { style: { setProperty: (k, v) => { set[k] = v; } }, setAttribute: (k, v) => { attrs[k] = v; },
    getAttribute: (k) => attrs[k] ?? null, removeAttribute: (k) => { delete attrs[k]; } } };
  const w = { visualViewport: { height: visible, scale }, innerHeight: visible, scrollY: 0, setTimeout() {},
    getComputedStyle: (el) => (el === pages ? { paddingBottom: padding, paddingLeft: '0px', paddingRight: '0px', columnGap: `${gap}px` } : { paddingBottom: padding }),
    MutationObserver: class { constructor(cb) { w.observer = { cb, on: false }; } observe() { w.observer.on = true; } disconnect() { w.observer.on = false; } } };
  return { w, d, set, attrs, pages };
}
const heightOf = (visible, top, bar, padding) => `${pageHeightFor({ visibleHeight: visible, top, reserve: bar + (parseFloat(padding) || 12) })}px`;

describe('④ 쪽 넘김 상자 높이 · 쪽 표시 — usePagedReader와 같은 식', () => {
  it.each([[851, 300, 52, '12px'], [851, 700, 52, '12px'], [640, 120, 60, '0px'], [740, 420, 52, ''], [400, 300, 52, '12px']])('화면 %i · 위 %i · 막대 %i · 여백 %s', (visible, top, bar, padding) => {
    const { w, d, set } = fakeDom({ visible, top, bar, padding });
    viewerSsrFit(w, d);
    expect(set['--viewer-ssr-page-height']).toBe(heightOf(visible, top, bar, padding));
  });
  it.each([[24, 1], [24 + 409, 2], [24 + 409 * 3, 4], [24 + 409 * 3 - 2, 3]])('쪽 끝 표지 자리 %i → %i쪽 — pageLabel과 같은 글', (endLeft, count) => {
    const { w, d, set, attrs } = fakeDom({ endLeft });
    viewerSsrFit(w, d);
    expect(set['--viewer-ssr-page-label']).toBe(`"${pageLabel(0, count)}"`);
    expect(attrs['data-viewer-ssr-pagebar']).toBe(count > 1 ? 'next' : '');
  });
  it('구간으로 나뉜 긴 글은 쪽 표시를 뷰어에 맡긴다(높이만 맞춘다)', () => {
    const { w, d, set, attrs } = fakeDom({ sectioned: true });
    viewerSsrFit(w, d);
    expect(set['--viewer-ssr-page-height']).toBeDefined();
    expect(set['--viewer-ssr-page-label']).toBeUndefined();
    expect(attrs).toEqual({}); // 맞춘 뒤 감춤(fit)도 뗐다
  });
  it('경계 조각이 아직 숨은 상자 안이면 들어올 때(MutationObserver)까지 기다린다', () => {
    const dom = fakeDom({ hidden: true });
    viewerSsrFit(dom.w, dom.d);
    expect(dom.set['--viewer-ssr-page-height']).toBeUndefined();
    expect(dom.attrs['data-viewer-hold']).toBe('fit'); // 맞추기 전에는 감춘다(문서 순서대로 들어오는 중 한 번 그려져도 틀린 높이가 보이지 않게)
    expect(dom.w.observer.on).toBe(true);
    dom.pages.parentElement = null;
    dom.w.observer.cb();
    expect(dom.set['--viewer-ssr-page-height']).toBe(heightOf(851, 300, 52, '12px'));
    expect(dom.w.observer.on).toBe(false);
    expect(dom.attrs['data-viewer-hold']).toBeUndefined();
  });
  it('쪽 막대가 아직 안 들어왔으면(상자 안 글도 덜 들어옴) 기다린다', () => {
    const dom = fakeDom();
    const layout = dom.pages.closest();
    const query = layout.querySelector;
    layout.querySelector = () => null;
    viewerSsrFit(dom.w, dom.d);
    expect(dom.set['--viewer-ssr-page-height']).toBeUndefined();
    layout.querySelector = query;
    dom.w.observer.cb();
    expect(dom.set['--viewer-ssr-page-height']).toBe(heightOf(851, 300, 52, '12px'));
  });
  it('인라인 스크립트는 그 자체로 돈다 — 어긋나면 html에 감춤 표지, 맞으면 높이 맞춤', () => {
    const script = viewerSsrGuardScript({ language: 'Japanese', servedAt: 1_000_000 });
    expect(script).not.toMatch(/<\/script/i);
    const run = (w, d) => new Function('window', 'document', script)(w, d);
    const held = fakeDom();
    run({ ...held.w, ...fakeWindow({ [VIEWER_PREF_KEY]: JSON.stringify({ version: 2, common: { theme: 'dark' } }) }) }, held.d);
    expect(held.attrs['data-viewer-hold']).toBe('prefs');
    expect(held.set['--viewer-ssr-page-height']).toBeUndefined();
    const ok = fakeDom();
    run({ ...ok.w, ...fakeWindow() }, ok.d);
    expect(ok.attrs['data-viewer-hold']).toBeUndefined();
    expect(ok.set['--viewer-ssr-page-height']).toBe(heightOf(851, 300, 52, '12px'));
  });
});

describe('⑤ 배선', () => {
  it('쪽 — 같은 판정일 때만 본문 앞에 첫 그림 전 스크립트 · 감춤 그림을 싣는다', () => {
    const page = read('src/app/(app)/viewer/[id]/page.jsx');
    const body = sliceBetween(page, 'async function SeededViewerPage', '\n}\n');
    expect(body).toContain('const ssr = viewerSsrRow(seed, id, query);');
    expect(body.indexOf('viewerSsrGuardScript(')).toBeLessThan(body.indexOf('<ViewerPage seed={seed ?? undefined} />'));
    expect(body).toContain('{ssr && <div className="viewer-ssr-hold"><ViewerLoading /></div>}');
  });
  it('뷰어 — 하이드레이션 렌더에서만 그 행을 처음 자료로 · 기본 설정으로 그리고, 감춤은 설정 · 화면 언어 · 새로 받기가 끝난 뒤 뗀다', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain('const ssrRow = useSyncExternalStore(noopSubscribe, clientSnapshot, hydrationSnapshot) ? viewerSsrRow(seed, id, originalParams) : null;');
    expect(viewer).toContain('initialData: ssrRow ?? undefined,');
    expect(viewer).toContain('initialDataUpdatedAt: ssrRow ? seed.servedAt : undefined,');
    expect(viewer).toContain('const settings = useViewerSettings(materialLang, { serverDefaults: !!ssrRow });');
    expect(viewer).toContain('if (ssrFirst.current && viewerSsrHeld() && settings.hydrated && languageSettings.ready && !ssrRefetching) releaseViewerSsrHold();');
    expect(viewer).toContain('if (!adoption) { setSsrRefetching(true); refetch().finally(() => setSsrRefetching(false)); return undefined; }');
    expect(viewer).toContain('<ListenControls assumeSupported={!!ssrFirst.current}');
    const settings = read('src/lib/useViewerSettings.js');
    expect(settings).toContain('values:readViewerPreferences(serverDefaults ? null : browserStorage(),language), pending:serverDefaults');
  });
  it('CSS — 감춤은 자리를 그대로 두는 visibility(뗄 때 밀림 0)', () => {
    const css = read('src/components/viewer/reader-controls.css');
    expect(css).toContain('html[data-viewer-hold] .viewer-workspace-boundary {visibility:hidden;}');
    expect(css).toContain('.viewer-ssr-hold {display:none;}');
    const paged = read('src/components/viewer/paged-reader.css');
    expect(paged).toContain('height: var(--reader-page-height, var(--viewer-ssr-page-height, calc(100dvh - 180px)));');
    expect(paged).toContain('html[data-viewer-ssr-pagebar] .reader-pagebar:not([data-ready]) .reader-pagebar__pos:empty::after { content: var(--viewer-ssr-page-label, none); }');
  });
});
