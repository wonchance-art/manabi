import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';

/**
 * 계약: v2-Q 뷰어 크롬 정돈 (#1077 설계 5486578406, 오너 "Q ㄱㄱ" 2026-09-01).
 *
 * ── 진단이 스타일 취향이 아니라 **구조 결함**이었다
 *
 * 배지 3종의 폭이 제각각인 건 의도가 아니라 **래퍼가 없어서**였다. `.page-header`는
 * flex가 아닌 블록이고, 셋이 그 **직계 자식**이라 `inline-block`인 수집 배지만 내용
 * 폭이고 나머지 둘(`div`)은 전체 폭까지 늘어났다. 같은 층위 정보인데 폭만 달라,
 * 정보 위계가 아니라 우연한 마크업 차이가 시선을 끌었다.
 *
 * 방증: 제목에 `style={{ flex: 1 }}`이 붙어 있었다 — **부모가 flex가 아니라 죽은 값**이다.
 * 누군가 이미 이 헤더를 flex로 착각하고 있었다는 자국이다.
 *
 * ── 실측이 설계의 한 항목을 무효화했다(§4 아래 계약 3 참조)
 *
 * 설계는 「시리즈 내비가 큰 채워진 바 안에 `《HSK 5》 1/20`을 띄워 제목을 반복한다」고
 * 적었다. 실측은 다르다: `.viewer-series-nav`는 `inline-flex; gap:4px`로 **배경도
 * 테두리도 없고**, 시리즈명은 `title` 툴팁일 뿐 **렌더되지 않는다**. 설계가 본 채워진
 * 바는 `.book-nav`(책 챕터 내비 — 다른 기능, 본문 바로 위)이고, 그 `《…》`는 **책 제목**이라
 * H1(이 챕터 제목)과 중복이 아니다. 그래서 이 라운드는 둘 다 손대지 않는다 —
 * 없는 문제를 고치면 있는 정보가 사라진다. 대신 현 상태를 회귀 방지로 못 박는다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const VIEWER = 'src/views/ViewerPage.jsx';
const CSS = 'src/index.css';

const header = () => sliceBetween(read(VIEWER), '<header className="page-header viewer-header">', '</header>');
const actionbar = () => sliceBetween(read(VIEWER), '<div className="viewer-actionbar">', '{/* 읽기 설정 시트');
/** 이 라운드가 새로 쓴 CSS만 — 파일 전역 검사는 남의 규칙에 걸려 헛돈다. */
const newCss = () => sliceBetween(read(CSS), '/* 뷰어 크롬 배지(v2-Q)', '.viewer-aa {');

describe('① 배지 3종이 한 컨테이너 안 — 폭 어긋남의 원인 제거', () => {
  it('셋 다 .viewer-badges 안에 있다(header 직계 자식 금지)', () => {
    const wrap = sliceBetween(header(), '<div className="viewer-badges">', '</div>\n        )}');
    for (const badge of ['개 수집 → 단어장', '개 복습 가능', '아는 단어 ']) {
      expect(wrap, `${badge} 배지가 래퍼 밖에 있다`).toContain(badge);
    }
  });

  it('래퍼가 실제로 줄을 세운다 — flex + wrap + gap', () => {
    const rule = sliceBetween(newCss(), '.viewer-badges {', '}');
    expect(rule).toMatch(/display:\s*flex/);
    expect(rule, '좁은 화면에서 넘치면 안 된다').toMatch(/flex-wrap:\s*wrap/);
    expect(rule, '간격은 gap으로 — 개별 margin은 다시 어긋난다').toMatch(/gap:/);
  });

  it('배지가 하나도 없으면 래퍼를 그리지 않는다 — 빈 여백만 남는 줄 금지', () => {
    expect(header()).toMatch(/\{\(\(user && savedCount > 0\) \|\| \(user && dueInMaterial > 0\) \|\| coverage\) && \(\s*\n\s*<div className="viewer-badges">/);
  });
});

describe('② 배지 스타일은 공용 클래스 — 인라인 하드코딩 0', () => {
  it('헤더에 인라인 색이 없다(여러 줄 style 블록까지 본다)', () => {
    // K R1 계약은 한 줄짜리라 여러 줄 style={{…}}을 놓쳤다(아래 ⑦ 참조).
    // 이 라운드가 만진 헤더만큼은 블록 단위로 본다.
    const blocks = [...header().matchAll(/style=\{\{([\s\S]*?)\}\}/g)].map((m) => m[1]);
    for (const b of blocks) {
      expect(b, `헤더 인라인 style에 색 리터럴: ${b.trim().slice(0, 60)}`).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(/);
    }
  });

  it('세 배지가 같은 공용 클래스를 쓴다 — 변형만 다르다', () => {
    const wrap = header();
    expect((wrap.match(/className="viewer-badge[ "]/g) || []).length, '래퍼(viewer-badges)는 세지 않는다').toBe(3);
    expect(wrap, '복습만 변형 클래스').toContain('viewer-badge viewer-badge--due');
  });

  it('새 CSS의 색은 토큰·color-mix로만 — 리터럴 금지', () => {
    expect(newCss(), '투명도는 color-mix로(ui-conventions §1)').not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(/);
  });
});

describe('③ 시리즈 내비 — 제목을 반복하지 않는다', () => {
  it('내비는 위치만 표시한다(시리즈명은 툴팁)', () => {
    const nav = sliceBetween(header(), '<div className="viewer-series-nav">', '</div>');
    expect(nav, '위치 표시가 사라졌다').toContain('{seriesPosition.current}/{seriesPosition.total}');
    // 시리즈명은 `title` 툴팁에만 산다 — 템플릿 리터럴과 문자열 속성을 걷어낸 뒤,
    // **화면에 찍히는 자리**에 남아 있는지만 본다(툴팁까지 금지하면 정보가 사라진다).
    const rendered = nav.replace(/`[^`]*`/g, '').replace(/title="[^"]*"/g, '');
    expect(rendered, '시리즈명을 화면에 찍으면 H1과 중복된다').not.toMatch(/seriesPosition\.series|《/);
  });

  it('내비는 채워진 바가 아니다 — 크롬이 무게를 갖지 않는다', () => {
    const rule = sliceBetween(read(CSS), '.viewer-series-nav {', '}');
    expect(rule).toMatch(/display:\s*inline-flex/);
    expect(rule, '배경을 넣으면 설계가 잘못 본 「큰 채워진 바」가 진짜로 생긴다').not.toMatch(/background/);
  });
});

describe('④ 본문 무접촉 — 이 라운드의 CSS는 리더 영역에 닿지 않는다', () => {
  it('새 CSS가 본문 셀렉터를 건드리지 않는다', () => {
    for (const sel of ['reader-area', 'word-token', '.surface', 'rt-an', 'furi-off', 'hl-']) {
      expect(newCss(), `본문 셀렉터 ${sel}에 손댔다 — 조판·성조색 회귀 위험`).not.toContain(sel);
    }
  });
});

describe('⑤ 접근성 하한 유지', () => {
  it('팝 애니메이션에 모션 축소 가드가 있다 — 옛 배지에는 없었다', () => {
    expect(newCss()).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]{0,120}viewer-badge--pop\s*\{\s*animation:\s*none/);
  });

  it('팝 자체는 살아 있다 — 색을 내린 대신 남긴 되먹임이다', () => {
    // 가드만 있고 애니메이션이 사라지면 계약은 통과하는데 되먹임은 없다(돌연변이 실측).
    expect(sliceBetween(newCss(), '.viewer-badge--pop {', '}')).toMatch(/animation:\s*vocabCounterPop/);
  });

  it('편집 버튼의 hover는 CSS가 한다 — JS로 색을 매만지지 않는다', () => {
    expect(header(), 'onMouseEnter로 style.color를 바꾸는 옛 방식 부활').not.toMatch(/onMouseEnter=\{[^}]*style\.color/);
    expect(newCss()).toContain('.viewer-title-edit:hover');
  });
});

describe('⑥ 제목 줄·액션 축 — 실측이 더한 것', () => {
  it('편집 버튼이 h1 밖이다 — 제목 그라디언트 클립에 얹히지 않는다', () => {
    const row = sliceBetween(header(), '<div className="viewer-titlerow">', '</div>');
    expect(row).toMatch(/<h1 className="page-header__title">\{material\.title\}<\/h1>/);
    expect(row, '편집은 h1 형제여야 한다').toContain('className="viewer-title-edit"');
  });

  it('죽은 flex 값이 되살아나지 않는다 — 부모가 flex가 아니다', () => {
    expect(header(), '.page-header는 블록이라 자식의 flex:1은 아무 일도 하지 않는다')
      .not.toMatch(/page-header__title"\s+style=/);
  });

  it('행동과 도구가 다른 그룹이다 — 도구는 오른쪽', () => {
    const bar = actionbar();
    const tools = bar.indexOf('viewer-actionbar__group--tools');
    expect(tools, '도구 그룹이 없다').toBeGreaterThan(0);
    // 행동 셋은 도구 그룹보다 앞(=왼쪽)에 온다.
    // ⚠ 존재부터 본다 — 없으면 indexOf가 -1이라 순서 단언이 **공허 통과**한다(M19 실측).
    for (const label of ['분석 중단', '읽기 완료', '오늘 학습 만들기']) {
      const at = bar.indexOf(label);
      expect(at, `${label} 행동이 사라졌다`).toBeGreaterThan(-1);
      expect(at, `${label}이 도구 그룹 뒤에 있다`).toBeLessThan(tools);
    }
    expect(sliceBetween(newCss(), '.viewer-actionbar__group--tools', '}')).toContain('margin-left: auto');
  });

  it('듣기가 도구 그룹 안이다 — 독립 줄 부활 금지', () => {
    const bar = actionbar();
    expect(bar).toContain('<ListenControls');
    expect(bar.indexOf('<ListenControls')).toBeGreaterThan(bar.indexOf('viewer-actionbar__group--tools'));
    // header~액션바 **밖**에 또 하나 놓이면 두 벌이 발화한다.
    expect((read(VIEWER).match(/<ListenControls/g) || []).length).toBe(1);
  });

  it('행동 둘이 같은 버튼 모양이다 — 밑줄 링크 폐기', () => {
    const bar = actionbar();
    expect(bar, '오늘 학습이 밑줄 링크로 되돌아갔다').not.toContain('study-textlink');
    expect((bar.match(/className="grammar-btn/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('크롬의 강조색은 복습 하나뿐이다', () => {
    // 수집·커버리지는 무채색 토큰만 쓴다. 되먹임은 색이 아니라 팝(움직임)이 나른다.
    const base = sliceBetween(newCss(), '.viewer-badge {', '}');
    expect(base).toContain('var(--bg-secondary)');
    expect(base, '기본 배지가 강조색을 쓰면 크롬이 본문과 색을 다툰다').not.toMatch(/--warning|--accent|--primary/);
    expect(sliceBetween(newCss(), '.viewer-badge--due {', '}')).toContain('--warning');
  });
});

/**
 * ⑦ K R1 색 계약의 **여러 줄 구멍** — 이제 0이다.
 *
 * `uiConventions.test.js`의 검사는 `style={{ … 색 }}`을 **한 줄 안에서** 찾는다.
 * 그래서 여러 줄로 펼친 inline style은 통째로 빠져나갔다. v2-Q가 없앤 복습 배지가
 * 정확히 그 꼴이었다(`style={{` 다음다음 줄에 `rgba(212,150,42,0.15)`) — **계약이
 * 있었는데도 3주를 살아남았다.**
 *
 * 그때 전수한 잔여 8건은 성격이 갈려 한 라운드로 안 묶였고, 그래서 **고치지 않고
 * 라쳇으로 잠갔다**. v2-K 잔여 라운드(2026-09-01)가 넷을 다 처리해 **0**이 됐다:
 *   · 모달 스크림 3건 → `--scrim` 토큰 + `.scrim` 유틸(값 불변 — 셋 다 0.45였다)
 *   · MaterialsPage 복습 배지 1건 → `.tag--due`가 뷰어와 **같은 `color-mix`** 를 쓴다
 *   · 비디오 레터박스 `#000` · 게임 캔버스 바닥 `#0b0d08` → **예외를 늘리지 않고**
 *     CSS 클래스로 옮겼다(규약이 금하는 것은 *인라인* 색 리터럴이다)
 *   · VocabReview 정오답 2건 → `quizOptClass` + `.quiz-opt--right/--wrong`
 *     (삼항 **안**이라 한 줄 계약도 이 라쳇도 못 잡던 자리다)
 *
 * 이제 라쳇이 아니라 **0 계약**이다 — 하나라도 생기면 여기서 실패한다.
 */
describe('⑦ 여러 줄 인라인 색 — 0', () => {
  const EXEMPT_PATHS = ['src/views/WorldPage.jsx', 'src/components/world/', 'src/app/global-error.jsx', 'src/app/opengraph-image.jsx'];
  const EXEMPT_VALUES = ['#fff', '#ffffff'];
  const KNOWN = 0;

  const walk = (dir, out = []) => {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules' || name === '__tests__') continue;
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p, out);
      else if (/\.(jsx?|tsx?)$/.test(name)) out.push(path.relative(process.cwd(), p));
    }
    return out;
  };

  it(`여러 줄 style 블록 안 색 리터럴이 ${KNOWN}건이다`, () => {
    const files = walk(path.join(process.cwd(), 'src'))
      .filter((f) => !EXEMPT_PATHS.some((e) => f.startsWith(e) || f === e));
    const found = [];
    for (const f of files) {
      const src = read(f);
      for (const m of src.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
        if (!m[1].includes('\n')) continue; // 한 줄짜리는 K R1이 이미 잡는다
        let body = m[1];
        for (const v of EXEMPT_VALUES) body = body.split(v).join('');
        if (/#[0-9a-fA-F]{3,8}|rgba?\(/.test(body)) {
          found.push(`${f}:${src.slice(0, m.index).split('\n').length}`);
        }
      }
    }
    expect(found.length, `여러 줄 인라인 색: ${found.join(', ')}`).toBeLessThanOrEqual(KNOWN);
  });

  it('없앤 자리는 토큰·클래스로 옮겨 갔다 — 값이 사라진 게 아니라 한 곳에 모였다', () => {
    // ⚠ `newCss()`는 v2-Q 크롬 절만 잘라 온다 — 여기서는 파일 전체를 봐야 한다.
    const css = read(CSS);
    // 스크림: 토큰 하나가 셋을 먹인다
    expect(css).toContain('--scrim: rgba(0, 0, 0, 0.45);');
    expect(sliceBetween(css, '.scrim {', '}')).toContain('var(--scrim)');
    for (const f of ['src/components/DictationPanel.jsx', 'src/components/DictationPicker.jsx', 'src/views/ReadingTextView.jsx']) {
      expect(read(f), `${f}가 스크림을 다시 손으로 그린다`).toContain('className="scrim');
    }
    // 복습 배지: 뷰어와 **같은 식**을 쓴다(값 복제 금지 — 2트랙 병의 재발 방지)
    const mix = 'color-mix(in srgb, var(--warning) 15%, transparent)';
    expect(sliceBetween(css, '.tag--due {', '}')).toContain(mix);
    expect(sliceBetween(css, '.viewer-badge--due {', '}')).toContain(mix);
    // 정오답: 판정이 한 함수에 있고 값은 토큰이 진다
    expect(read('src/views/VocabReview.jsx')).toContain('export function quizOptClass');
    expect(sliceBetween(css, '.quiz-opt--right {', '}')).toContain('var(--accent)');
    expect(sliceBetween(css, '.quiz-opt--wrong {', '}')).toContain('var(--danger)');
  });

  it('예외 목록이 늘지 않았다 — 옮길 수 있는 것은 옮겼다', () => {
    // 레터박스 `#000`·게임 바닥 `#0b0d08`은 예외 등재가 아니라 **CSS 이동**으로 풀었다.
    // 규약이 금하는 것은 *인라인* 색 리터럴이고, CSS 본문은 값이 사는 자리다.
    expect(EXEMPT_VALUES).toEqual(['#fff', '#ffffff']);
    expect(EXEMPT_PATHS).toHaveLength(4);
    expect(read(CSS), '레터박스가 CSS로 오지 않았다').toContain('.fr-media__frame');
    expect(read(CSS), '지도 뷰포트가 CSS로 오지 않았다').toContain('.worldmap-viewport');
  });

  it('뷰어 헤더는 이미 0이다 — 이 라운드가 없앤 자리로 되돌아가지 않는다', () => {
    const blocks = [...header().matchAll(/style=\{\{([\s\S]*?)\}\}/g)];
    expect(blocks.filter((m) => /#[0-9a-fA-F]{3,8}|rgba?\(/.test(m[1]))).toEqual([]);
  });
});

/**
 * ⑧ 오버레이 스크림 값 통합 (#1077 설계 5491002271, 오너 「우선순위대로」 2026-09-01).
 *
 * ── 설계가 센 것보다 많았다
 *
 * 설계는 「인라인 3벌 + 오버레이 클래스 **4종**」이라고 적었다. 착수 실측은 **9종**이다:
 *
 *   0.3  .overlay              (사용처 0 — 죽은 CSS)
 *   0.45 .tile-modal__overlay  (토큰과 같은 값)
 *   0.5  .vocab-detail-overlay · .source-edit-overlay · .reading-test-overlay
 *   0.55 .confirm-overlay
 *   0.6  .modal-overlay        (+ backdrop-filter: blur(5px))
 *   0.65 .onboarding-overlay
 *   0.75 .celebration-overlay  (+ blur(8px) — 사용처 0)
 *
 * **설계의 「흐림은 하나뿐」도 틀렸다** — `.celebration-overlay`도 쓴다(죽은 CSS라 화면에
 * 안 뜰 뿐이다). 목업이 「0.45와 0.65가 구분되지 않는다」고 판정한 범위 밖에 0.3과 0.75가
 * 있었으므로, 그 둘이 **살아 있었다면 이 라운드는 겉모습 변화 없음이 아니었다.**
 * 죽어 있어서 성립한다 — 그래서 그 사실 자체를 계약으로 박는다.
 *
 * 투명이 의도인 셋(`.rsheet-backdrop`·`.reanalyze-panel-overlay`·`.pdf-detail-overlay`)은
 * 스크림이 아니라 **클릭 받이**다. 배경을 아예 안 쓰므로 이 계약의 대상이 아니다
 * (뷰어 바텀시트의 「backdrop은 무광 — 시트 위 본문이 곧 미리보기」 시연 합의).
 */
describe('⑧ 오버레이 스크림 — 값이 하나다', () => {
  /** 주석을 걷어낸 규칙 목록 — 주석 속 예시가 선택자로 오독되면 계약이 헛돈다(요미 라운드 선례). */
  const rules = () => [...read(CSS).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => ({ sel: m[1].trim().split('\n').pop().trim(), body: m[2] }));
  /** 스크림 후보 = 오버레이·스크림 이름을 단 규칙 중 배경을 **실제로 칠하는** 것. */
  const scrims = () => rules()
    .filter((r) => /overlay|\bscrim\b/.test(r.sel))
    .map((r) => ({ ...r, bg: /(?<!-)\bbackground(?:-color)?\s*:\s*([^;]+)/.exec(r.body)?.[1]?.trim() }))
    .filter((r) => r.bg && r.bg !== 'transparent');

  it('스크림을 칠하는 규칙이 전부 --scrim 토큰을 쓴다 — 값이 흩어지지 않는다', () => {
    const stray = scrims().filter((r) => r.bg !== 'var(--scrim)').map((r) => `${r.sel} → ${r.bg}`);
    expect(stray, `스크림 값이 다시 갈렸다. 토큰을 쓰거나, 스크림이 아니라면 이름을 바꿔라:\n  ${stray.join('\n  ')}`)
      .toEqual([]);
  });

  it('계약이 실제로 규칙을 읽어낸다 — 파서가 죽으면 위 단언이 공허해진다', () => {
    const found = scrims().map((r) => r.sel);
    expect(found.length, '스크림 규칙을 하나도 못 읽었다 — 파서를 고쳐라').toBeGreaterThanOrEqual(8);
    for (const sel of ['.scrim', '.modal-overlay', '.confirm-overlay', '.onboarding-overlay']) {
      expect(found, `${sel}을 못 봤다`).toContain(sel);
    }
    // 토큰은 하나이고 값은 0.45다(⑦이 정한 그 값 — 두 계약이 같은 값을 본다).
    expect(read(CSS)).toContain('--scrim: rgba(0, 0, 0, 0.45);');
  });

  it('흐림은 손대지 않았다(오너 ⓐ) — 쓰는 오버레이 목록이 고정된다', () => {
    // ⓑ전부/ⓒ없앰이 아니라 **ⓐ그대로**를 골랐다. 흐림은 우리가 의도적으로 정한 적이
    // 없으므로 값 통합에 묻어가지 않는다 — 늘거나 줄면 여기서 걸린다.
    // 예전엔 둘이었다(축하 모달 계열이 하나 더 썼다). 죽은 CSS 라운드가 그 계열을 걷어내
    // **1종으로 줄었고**, 그제서야 설계 코멘트의 「흐림은 하나뿐」이 참이 됐다.
    const blurred = scrims()
      .filter((r) => /(?<!-webkit-)backdrop-filter\s*:/.test(r.body))
      .map((r) => r.sel);
    expect(blurred.sort()).toEqual(['.modal-overlay']);
    expect(sliceBetween(read(CSS), '\n.modal-overlay {', '}')).toContain('backdrop-filter: blur(5px)');
  });

  it('목업 판정 범위 밖 값이 스크림에 없다 — 「겉모습 변화 없음」의 근거가 유지된다', () => {
    // 목업이 「구분되지 않는다」고 판정한 구간은 **0.45~0.65**다. 그 밖 값(0.3·0.75)을 쓰던
    // 두 오버레이는 죽은 CSS라 통합이 성립했고, 죽은 CSS 라운드에서 규칙째 사라졌다.
    // ⚠ 이 계약은 **클래스 이름을 코드로 들지 않는다** — 이름을 적으면 죽은 CSS 판정기가
    //    그 토큰을 「사용 중」으로 읽어, 죽었다고 적은 문장이 그것을 살려 놓는다(실측).
    const alphas = scrims().map((r) => r.bg)
      .filter((v) => v !== 'var(--scrim)')
      .map((v) => Number(/([\d.]+)\s*\)$/.exec(v)?.[1]));
    expect(alphas, '토큰 밖 스크림 값이 생겼다').toEqual([]);
    expect(read(CSS)).toContain('--scrim: rgba(0, 0, 0, 0.45);');
  });
});
