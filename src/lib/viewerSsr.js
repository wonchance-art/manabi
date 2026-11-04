// 뷰어 본문 서버 렌더(VIEWER-SSR-001 시제품, 2026-11-02 KST). 첫 HTML에 실린 공개 자료(VIEWER-SEED-001)를 서버가 본문까지 그린다 —
// 지금은 본문이 JS를 다 받고 실행한 뒤(모바일 CPU×4 하이드레이션 뒤)에야 붙어 첫 그림이 「자료 불러오는 중…」이었다.
//
// 그리는 범위: **손님**(세션 쿠키 없음 — seed.account null)의 **분석이 끝난 공개 자료**, 주소에 returnTo 말고 다른 질의가 없을 때.
// 대화 · 작성기 원본 · 학습 노트 · 책 장은 지금 그대로.
// 로그인 계정(VIEWER-MEMBER-SSR-001, 오너 ㉠ 「처음부터 자리 잡기」 2026-11-04 KST): **남의 공개 자료를 처음 여는 것**도 같은 서버 그림이다 —
// 「처음」 = 그 계정의 읽던 곳이 없다(seed.resume === false: reading_progress.last_token_idx > 0인 행이 없음 — 서버가 그 계정 토큰으로 본 값).
// 내 자료(소유자 도구 · 제목 편집이 붙는다) · 읽던 곳이 있음(뷰어가 그 쪽으로 넘긴다) · 모름(조회 실패) · 수업에서 연 글(returnTo /class/ —
// 수업 사본 안내가 본문 위에 붙는다)은 지금 그대로(브라우저가 그린다). 서재 담김 여부는 가르지 않는다 — 버튼 글만 제자리에서 바뀐다.
// 서버 그림은 계정 확인 전(authLoading) 그림이다: 계정 줄(서재에 담기 · 신고 · 단어 현황)은 자리만 잡아 그리고(아는 것 0 — 공개 행 · 계정 id뿐),
// 계정이 확인되면 같은 자리에 채운다(본문이 밀리지 않는다).
//
// 서버는 기기 설정(localStorage)을 모른다 — 서버 그림은 늘 기본 설정이다. 첫 그림 전에 도는 작은 스크립트(viewerSsrGuardScript,
// 쪽이 본문 앞에 싣는다)가 이 기기에서 서버 그림이 그대로 맞는지 본다. 하나라도 어긋나면(읽기 설정 · 화면 언어가 기본이 아님 · 끊김 ·
// 기기에 남은 옛 문서 · 소리 기능 없음) <html data-viewer-hold>를 붙여 본문을 감추고 불러오기 그림을 보인다 — 뷰어가 설정을 다 읽은
// 뒤에 떼어 지금처럼 한 번에 보인다(서버 그림 → 다른 설정 그림으로 바뀌는 깜빡임 0). 맞으면 쪽 넘김 상자 높이를 그리기 전에 맞춘다
// (usePagedReader fitHeight와 같은 식 — 서버는 화면 높이를 몰라 CSS 대체값으로 그린다).
import { viewerDefaults, VIEWER_PREF_KEY } from './viewerPreferences';
import { VIEWER_LANGUAGE_PREF_KEY } from './viewerLanguage';
import { conversationOf } from './conversation/conversationShape';
import { composerOf } from './materialComposer';
import { isStudyNote } from './studyNoteIdentity';
import { getBook } from './bookMeta';

/** 받아들임(adoptViewerSeed)과 같은 문서 신선도 — 이보다 멀면 옛 문서로 보고 감춘다. */
export const VIEWER_SSR_MAX_SKEW_MS = 30000;
const SSR_STATUSES = new Set(['completed', 'partial']);

/**
 * 서버가 본문까지 그려도 되는 행 — 아니면 null(지금처럼 불러오기 그림). 서버 · 브라우저 첫 렌더가 같은 값을 내야 한다(props만 본다).
 * query = 주소 질의(URLSearchParams 또는 객체) — returnTo 말고 다른 키가 있으면 그리지 않는다(문장 찾아가기 · 수업 · 작성기 원본 등).
 */
export function viewerSsrRow(seed, id, query = null) {
  const row = seed?.row;
  if (!row || row.visibility !== 'public' || seed.id !== String(id)) return null;
  const member = viewerSeedAccount(seed);
  if (seed.account !== null && !(member && seed.resume === false && row.owner_id !== member)) return null;
  if (!Number.isFinite(seed.servedAt)) return null;
  const keys = query ? [...(typeof query.keys === 'function' ? query.keys() : Object.keys(query))] : [];
  if (keys.some((key) => key !== 'returnTo')) return null;
  if (member && String(queryValue(query, 'returnTo') || '').startsWith('/class/')) return null;
  const json = row.processed_json;
  if (!SSR_STATUSES.has(json?.status || row.status) || !Array.isArray(json?.sequence) || !json.sequence.length) return null;
  if (conversationOf(row) || composerOf(row) || isStudyNote(row) || getBook(json?.metadata)) return null;
  // 중국어는 지금 그대로 — 병음 칸 폭(--pinyin-cell)을 붙은 뒤에 재서(watchPinyinCell) 서버 값 44px과 달라지면 본문이 다시 흐른다
  // (390 실측: 첫 낱말 폭 132 → 117px · 40 → 34쪽). 그 칸을 첫 그림 전에 재는 길은 뷰어 요소의 인라인 스타일이라 따로 설계한다.
  if (json?.metadata?.language === 'Chinese') return null;
  return row;
}

/** 서버가 세션 쿠키 계정으로 읽은 seed의 계정 id — 손님 · 모름이면 null. 서버 · 하이드레이션이 같은 props를 본다. */
export function viewerSeedAccount(seed) {
  return typeof seed?.account === 'string' && seed.account !== '' ? seed.account : null;
}
const queryValue = (query, key) => (typeof query?.get === 'function' ? query.get(key) : query?.[key]);

/** 위쪽 단어 현황 줄 ✕(이 자료 · 이 기기의 이 계정) 저장 키 — 뷰어와 첫 그림 전 읽기(viewerBadgesPreRead)가 같은 키를 쓴다. */
export const viewerBadgesKey = (account, id) => `viewer-badges-dismissed:${account ?? 'guest'}:${id}`;

/**
 * 닫아 둔 단어 현황 줄의 이번 방문 판정(오너 결정 ① 2026-11-04 KST 「전부 권장대로」 — 본문 밀림 0).
 * closedAt = 닫을 때의 복습 가능 수(null = 닫은 적 없음), due = 지금 이 자료의 복습 가능 수.
 * - hidden: 닫아 둔 자료는 이번 방문 내내 닫힌 채다(복습 수가 늘어도 줄을 끼워 넣지 않는다 — 자리가 없어 본문이 밀린다).
 * - reopenNext: 닫은 뒤 복습 수가 늘었다 → 저장 키를 지워, 다음 열람 때 첫 그림 전 읽기가 자리를 잡고 줄을 다시 보인다.
 */
export function viewerBadgesVisit(closedAt, due) {
  const closed = closedAt !== null && closedAt !== undefined;
  return { hidden: closed, reopenNext: closed && Number(due) > Number(closedAt) };
}

/**
 * 단어 현황 줄을 닫아 둔 자료인가 — 첫 그림 전에 이 기기 값을 읽어 <html data-viewer-badges-dismissed>를 붙인다(VIEWER-MEMBER-SSR-001 ④).
 * 붙으면 CSS가 비워 둔 한 줄 자리(.viewer-badges--pending)를 그리지 않는다 — 자리를 잡았다가 거두며 본문이 올라가는 일 0.
 * 뷰어가 같은 키를 읽어 상태로 옮기면 뗀다(releaseViewerBadgesPreRead). 인라인 스크립트로 싣는다(toString — 바깥 이름 · 새 문법 없음).
 */
export function viewerBadgesPreRead(w, o) {
  try {
    if (w.localStorage.getItem(o.key) !== null) w.document.documentElement.setAttribute('data-viewer-badges-dismissed', '');
  } catch (e) { /* 저장소를 못 읽으면 자리를 잡는다(뷰어도 닫은 적 없음으로 본다) */ }
}
export function viewerBadgesPreReadScript({ account, id }) {
  const json = JSON.stringify({ key: viewerBadgesKey(account, id) }).replace(/</g, '\\u003c');
  return `(${viewerBadgesPreRead})(window,${json});`;
}
export function releaseViewerBadgesPreRead(doc = globalThis.document) {
  doc?.documentElement?.removeAttribute?.('data-viewer-badges-dismissed');
}

/**
 * 첫 그림 전 판정 — 서버 그림(기본 설정 · 한국어 화면 · 이 문서의 행)이 이 기기에서 그대로 맞지 않으면 그 까닭(문자열), 맞으면 ''.
 * 인라인 스크립트로 그대로 싣는다(toString) — 바깥 이름을 쓰지 않고 옛 문법만 쓴다. 계약 viewerSsr.test.js가 readViewerPreferences ·
 * readViewerLanguagePreferences와 같은 결론(감추지 않으면 기본값과 같음)인지 대조한다.
 */
export function viewerSsrHold(w, o) {
  var storage;
  try { storage = w.localStorage; if (!storage) return 'storage'; } catch (e) { return 'storage'; }
  var read = function (key) { var raw = storage.getItem(key); if (raw === null) return undefined; return JSON.parse(raw); };
  var differs = function (values) {
    if (values === null || values === undefined) return false;
    if (typeof values !== 'object') return true;
    for (var key in values) if (Object.prototype.hasOwnProperty.call(values, key) && key in o.defaults && values[key] !== o.defaults[key]) return true;
    return false;
  };
  try {
    var stored = read(o.prefKey);
    if (stored !== undefined && stored !== null && typeof stored !== 'object') return 'prefs';
    var v2 = stored && stored.version === 2;
    if (v2 && differs(stored.common)) return 'prefs';
    if (!(v2 && stored.languages && stored.languages[o.language])) {
      // 옛 낱개 저장값(viewer_<키>) — readViewerPreferences가 읽는 길과 같다.
      for (var key in o.defaults) {
        var legacy = read('viewer_' + key);
        if (legacy !== undefined && legacy !== null && legacy !== o.defaults[key]) return 'prefs';
      }
      var furigana = read('viewer_showFurigana');
      if (furigana !== undefined && furigana !== null && furigana !== true) return 'prefs';
    } else if (differs(stored.languages[o.language])) return 'prefs';
    var lang = read(o.langKey);
    if (lang && lang.version === 1 && ((lang.uiLocale && lang.uiLocale !== 'ko') || (lang.explanationLocale && lang.explanationLocale !== 'ko'))) return 'locale';
  } catch (e) { return 'prefs'; }
  if (w.navigator && w.navigator.onLine === false) return 'offline';
  var origin = w.performance && w.performance.timeOrigin;
  if (!(origin > 0) || Math.abs(o.servedAt - origin) > o.maxSkew) return 'stale';
  // 툴바 「듣기」(ListenControls)는 브라우저 음성이 있어야 보인다 — 서버 그림은 있다고 보고 그린다.
  if (!w.speechSynthesis || typeof w.SpeechSynthesisUtterance !== 'function') return 'tts';
  return '';
}

/**
 * 쪽 넘김 상자 높이 · 쪽 표시를 그리기 전에 맞춘다 — usePagedReader fitHeight · pageHeightFor · measure · pageLabel과 같은 식(계약이 대조한다).
 * 서버 그림은 경계 조각으로 늦게 들어와(숨긴 상자 → 제자리) 들어온 순간을 MutationObserver(마이크로태스크 — 그리기 전)로 잡는다.
 * 하이드레이션할 요소에는 손대지 않는다(속성이 서버 그림과 달라진다) — 값은 <html>(suppressHydrationWarning, 테마 스크립트 선례)에 두고
 * CSS가 읽는다(paged-reader.css). 뷰어가 붙어 쪽 제어기가 준비되면 제 값을 쓰고, 쪽 표시 표지는 뷰어가 뗀다(viewerSsrPaintDone).
 */
export function viewerSsrFit(w, d) {
  var root = d.documentElement;
  // 맞추기 전에는 본문을 감춘다(감춤 그림) — 경계가 스트리밍되지 않고 문서 순서대로 들어오면 쪽 막대가 오기 전에 한 번 그려질 수 있다.
  var done = function () { if (root.getAttribute('data-viewer-hold') === 'fit') root.removeAttribute('data-viewer-hold'); return true; };
  root.setAttribute('data-viewer-hold', 'fit');
  var fit = function () {
    var pages = d.querySelector('[data-reader-pages="paged"]');
    if (!pages) return false;
    for (var n = pages; n; n = n.parentElement) if (n.hidden) return false;
    var layout = pages.closest('.viewer-layout');
    var bar = layout && layout.querySelector('.reader-pagebar');
    if (!bar) return false; // 쪽 막대(상자 뒤)까지 들어와야 상자 안 글도 다 들어온 것이다
    // 손가락 확대 확인(fitHeight)은 두지 않는다 — 첫 그림 전에는 확대가 있을 수 없고, 휴대폰 흉내는 이 시점 scale을 0.4로 보고했다(390 실측).
    var viewport = w.visualViewport;
    var visible = (viewport && viewport.height) || w.innerHeight || 0;
    if (!visible) return done();
    var reserve = (!bar.hidden ? (bar.getBoundingClientRect().height || 0) : 0) + (parseFloat(w.getComputedStyle(layout || pages).paddingBottom) || 12);
    var box = pages.getBoundingClientRect();
    var fill = Math.floor(visible - (box.top + (w.scrollY || 0)) - reserve);
    var height = fill >= visible * 0.55 ? Math.max(160, fill) : Math.max(160, Math.floor(visible - reserve - 16));
    root.style.setProperty('--viewer-ssr-page-height', height + 'px');
    // 쪽 표시 「1 / N쪽 · P%」 — 구간으로 나뉜 긴 글(VIEWER-SECTIONS-001)은 표시가 글 전체 기준이라 뷰어에 맡긴다.
    if (pages.getAttribute('data-section-tail') !== 'off' && !pages.hasAttribute('data-section-head')) {
      var style = w.getComputedStyle(pages);
      var width = Math.max(0, (pages.clientWidth || 0) - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0));
      var gap = parseFloat(style.columnGap) || 0, step = Math.max(1, width + gap);
      var end = pages.querySelector('[data-page-end]'), left = box.left + (pages.clientLeft || 0);
      var count = end ? Math.max(1, Math.floor((end.getBoundingClientRect().left - left - (pages.clientLeft || 0) + 1) / step) + 1)
        : (width > 0 ? Math.max(1, Math.round(((pages.scrollWidth || 0) + gap) / (width + gap))) : 1);
      var percent = count > 1 ? Math.min(100, Math.max(0, Math.round(100 / count))) : 100;
      root.style.setProperty('--viewer-ssr-page-label', '"1 / ' + count + '\uCABD \u00B7 ' + percent + '%"');
      root.setAttribute('data-viewer-ssr-pagebar', count > 1 ? 'next' : '');
    }
    return done();
  };
  if (fit()) return;
  var observer = new w.MutationObserver(function () { if (fit()) observer.disconnect(); });
  observer.observe(d.documentElement, { childList: true, subtree: true });
  // 경계 조각은 load 뒤에야 제자리로 들어올 수 있다(React 19.2 Suspense 공개 묶음 — 300ms 단위로 미룬다). 늦어도 이만큼 뒤엔 뷰어가 맡는다.
  w.setTimeout(function () { observer.disconnect(); done(); }, 15000);
}

/** 쪽 제어기가 준비됐다 — 미리 그린 쪽 표시를 뗀다(높이 변수는 대체값으로만 남는다 — 상속 변수를 지우면 본문 전체 스타일을 다시 계산한다). */
export function viewerSsrPaintDone(doc = globalThis.document) {
  doc?.documentElement?.removeAttribute?.('data-viewer-ssr-pagebar');
}

/** 쪽이 본문 앞에 싣는 스크립트(서버 컴포넌트가 만든 글 — 하이드레이션은 같은 글을 받는다). */
export function viewerSsrGuardScript({ language, servedAt }) {
  const options = { language, defaults: viewerDefaults(language), prefKey: VIEWER_PREF_KEY, langKey: VIEWER_LANGUAGE_PREF_KEY, servedAt, maxSkew: VIEWER_SSR_MAX_SKEW_MS };
  // </script> 조각이 글에 섞이지 않게 < 를 풀어 쓴다(설정 기본값 · 언어 이름뿐이지만 형식으로 막는다).
  const json = JSON.stringify(options).replace(/</g, '\\u003c');
  return `(function(){try{var h=(${viewerSsrHold})(window,${json});if(h){document.documentElement.setAttribute('data-viewer-hold',h);return;}(${viewerSsrFit})(window,document);}catch(e){document.documentElement.setAttribute('data-viewer-hold','error');}})();`;
}

/**
 * 서버가 그린 행이 이 문서에서 낡았나 — 받아들임(adoptViewerSeed)이 동기로 버리는 조건(끊김 · 문서 연 시각과 서버 시각이 한도 밖)과 같다.
 * 참이면 첫 그림 전 판정이 본문을 감췄고, 뷰어가 지금처럼 새로 받는다. 받아들임의 「문서 하나에 한 번」과 따로 본다 — 하이드레이션
 * 전에 React가 서버 HTML을 버리고 새로 그리면 받아들임은 이미 쓰인 뒤다.
 */
export function viewerSsrStale(seed, { origin = globalThis.performance?.timeOrigin, online = globalThis.navigator?.onLine } = {}) {
  return online === false || !Number.isFinite(origin) || !Number.isFinite(seed?.servedAt) || Math.abs(seed.servedAt - origin) > VIEWER_SSR_MAX_SKEW_MS;
}

/** 이 문서가 서버 그림을 감췄나(첫 그림 전 판정) — 뷰어가 설정 · 자료를 다 맞춘 뒤 뗀다. */
export function viewerSsrHeld(doc = globalThis.document) {
  return doc?.documentElement?.getAttribute?.('data-viewer-hold') || '';
}
export function releaseViewerSsrHold(doc = globalThis.document) {
  doc?.documentElement?.removeAttribute?.('data-viewer-hold');
}
