import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { splitRuby } from '../splitRuby';

/**
 * 계약: v2-R 시트·단어 카드 정돈 (#1077 설계 5486707656, 오너 "우선순위대로 ㄱㄱ").
 *
 * ── 어수선함에 구조적 원인이 있었다
 *
 * **같은 것을 여는 방법이 셋**이었다 — 하단 바 버튼 · 시트 안 섹션 헤더 · 그 헤더의 셰브런.
 * 라벨까지 같아 화면에 「번역·맥락」이 **두 번** 보였다. 게다가 **접힌 섹션도 헤더 줄을
 * 차지해** 안 보는 내용이 세로를 먹었고, 시트 상한 60svh에서 그만큼이 카드 하단 예문
 * (한자/병음/번역 3줄)을 잘라 먹었다.
 *
 * ── 설계 항목 하나는 실측으로 무효가 됐다
 *
 * 설계는 「하단 바 두 버튼 폭 불균등 — `flex: 1`로 균등하게」라 했는데, 브라우저 실측은
 * **이미 균등**이다(배지 없음/짧음/아주 김 세 경우 모두 폭 차이 **0px**). `flex: 1`도
 * `overflow: hidden`도 배지 `max-width: 80px`도 전부 있다. 없는 문제라 손대지 않는다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
/**
 * CSS 규칙을 훑기 전에 **주석을 걷어낸다.**
 * 주석에 규칙을 인용하면(예: 「`.rt-hun { top: 100% }` 우회를 뺐다」) 선택자 스캔이 그걸
 * 규칙으로 읽는다 — 요미 分散配置 라운드에서 실제로 그렇게 걸렸다. 주석은 규칙을
 * 설명해야 하는 자리이므로, 못 적게 막을 게 아니라 스캐너가 안 보면 된다.
 */
const cssRules = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '');
const SHEET = 'src/components/ViewerBottomSheet.jsx';
const VIEWER = 'src/views/ViewerPage.jsx';
const CSS = 'src/index.css';

const card = () => sliceBetween(read(VIEWER), 'const wordDetailCard = !selectedToken', '{isEditingToken && (');

describe('① 전환 경로는 하단 바 하나 — 섹션 헤더·셰브런 부활 금지', () => {
  it('시트 안에 헤더 버튼도 셰브런도 없다 — 소스·CSS·e2e 어디에도', () => {
    const src = read(SHEET);
    for (const gone of ['viewer-sheet__section-header', 'viewer-sheet__chevron', 'aria-expanded']) {
      expect(src, `${gone}가 되살아났다 — 여는 방법이 다시 둘이 된다`).not.toContain(gone);
    }
    // ⚠ 처음엔 `src/`만 봤다가 **e2e가 그 선택자로 시트를 프로브하고 있던 것**을 놓쳐
    //    CI에서 30초 타임아웃으로 터졌다. 지운 선택자를 **기다리는 쪽**까지 함께 본다.
    for (const f of ['src/index.css', 'e2e/learning-flow.e2e.mjs', 'e2e/smoke.e2e.mjs']) {
      expect(read(f), `${f}에 폐지된 선택자가 남았다`).not.toContain('viewer-sheet__section-header');
    }
  });

  it('시트는 선택된 하나만 그린다', () => {
    const body = sliceBetween(read(SHEET), '<div className="viewer-sheet__sections">', '</div>');
    // 두 콘텐츠를 나란히 렌더하면 접힌 헤더 문제가 그대로 돌아온다 — 삼항 하나가 계약이다.
    expect(body).toMatch(/tab === 'left' \? leftContent : rightContent/);
    // 시트 본문 컨테이너는 하나뿐이다(둘을 쌓으면 다시 세로를 먹는다).
    expect((read(SHEET).match(/viewer-sheet__section-body/g) || []).length).toBe(1);
  });

  it('하단 바 버튼이 선택 상태를 알린다', () => {
    const src = read(SHEET);
    expect((src.match(/aria-pressed=\{sheetOpen && tab === '(left|right)'\}/g) || []).length).toBe(2);
  });
});

describe('② 동작 변경 — 「둘 다 펼치기」 폐기(모바일 한정)', () => {
  it('상태가 열림 여부와 어느 탭인지로 갈린다 — 두 불리언이 아니다', () => {
    const src = read(SHEET);
    expect(src).toMatch(/const \[tab, setTab\] = useState\('left'\)/);
    for (const gone of ['leftOpen', 'rightOpen']) {
      expect(src, `${gone}가 되살아나면 둘 다 펼치기가 가능해진다`).not.toContain(gone);
    }
  });

  it('되돌리는 지점이 한 곳이다 — 그 사실을 주석이 말한다', () => {
    // 오너가 이 동작 변경을 물릴 수 있어야 한다. 함수 하나 + 시트 렌더가 전부라는 것을
    // 계약으로도 남긴다(설계 §3의 유일한 동작 변경).
    const head = sliceBetween(read(SHEET), '/**', 'export function resolveSignalTransition');
    expect(head).toMatch(/선택된 하나만/);
    expect(head, '데스크톱 무영향이 근거의 일부다').toMatch(/데스크톱/);
  });
});

describe('③ 카드 — 빈 줄을 메타가 쓰고, 뜻이 제 무게를 갖는다', () => {
  it('메타가 헤더 줄 왼쪽에 있다 — 단어와 뜻 사이에 끼지 않는다', () => {
    const actions = sliceBetween(card(), '<div className="word-detail-card__actions">', '{(() => {');
    expect(actions).toContain('word-detail-card__meta');
    expect(actions).toContain('<TokenPosLabel token={selectedToken} />');
    // 옛 자리(단어 아래 독립 줄)가 남아 있으면 줄을 회수하지 못한 것이다.
    expect((card().match(/<TokenPosLabel/g) || []).length, '메타가 두 곳에 있다').toBe(1);
  });

  it('▷와 ✕가 같은 줄에 있되 붙어 있지 않다 — ✕는 시트 핸들과 인접해 오조작 위험', () => {
    // ⚠ `</div>`로 끊으면 **안쪽 메타 div**에서 멈춰 버튼이 슬라이스 밖으로 나간다
    //    (그러면 indexOf가 -1이 되어 순서 단언이 공허 통과한다 — 이번 축에서 두 번째다).
    const actions = sliceBetween(card(), '<div className="word-detail-card__actions">', '{(() => {');
    expect(actions.indexOf('word-detail-card__speak'), '▷가 헤더 줄에 없다').toBeGreaterThan(-1);
    expect(actions.indexOf('word-detail-card__close'), '✕가 헤더 줄에 없다').toBeGreaterThan(-1);
    expect(actions.indexOf('word-detail-card__speak')).toBeLessThan(actions.indexOf('word-detail-card__close'));
    expect(sliceBetween(read(CSS), '.word-detail-card__speak {', '}')).toMatch(/margin-right/);
  });

  it('뜻이 메타보다 크다 — 카드에서 가장 중요한 것이 가장 약했다', () => {
    const meaning = sliceBetween(read(CSS), '.word-detail-card__meaning {', '}');
    const meta = sliceBetween(read(CSS), '.word-detail-card__meta {', '}');
    const rem = (block) => parseFloat(/font-size:\s*([\d.]+)rem/.exec(block)?.[1] ?? '0');
    expect(rem(meaning)).toBeGreaterThan(rem(meta));
    expect(rem(meaning), '본문 크기(1rem)보다도 커야 한 단계 올린 것이다').toBeGreaterThan(1);
    expect(meaning, '굵기도 함께 올린다').toMatch(/font-weight/);
  });

  it('편집이 뜻 옆에 붙는다 — 뜻 상자가 남는 폭을 다 먹으면 멀어진다', () => {
    expect(sliceBetween(read(CSS), '.word-detail-card__meaning {', '}'))
      .toMatch(/flex:\s*0 1 auto/);
    const row = sliceBetween(card(), 'word-detail-card__meaningrow', '</div>');
    expect(row).toContain('word-detail-card__meaning');
  });

  it('유의어 칩이 뜻을 시각 무게로 누르지 않는다', () => {
    const chip = sliceBetween(read(CSS), '.syn-ant__chip {', '}');
    const rem = (block) => parseFloat(/font-size:\s*([\d.]+)rem/.exec(block)?.[1] ?? '0');
    expect(chip, '테두리를 걷는다').toMatch(/border:\s*none/);
    expect(rem(chip)).toBeLessThan(rem(sliceBetween(read(CSS), '.word-detail-card__meaning {', '}')));
    // 누를 수 있다는 신호는 남아야 한다.
    expect(read(CSS)).toContain('.syn-ant__chip:hover');
  });

  it('카드 인라인 색 0 — 여러 줄 블록까지 본다(v2-Q 라쳇과 같은 잣대)', () => {
    for (const m of card().matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
      expect(m[1], `카드 인라인 style에 색 리터럴: ${m[1].trim().slice(0, 60)}`)
        .not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(/);
    }
  });
});

describe('④ 손대지 않은 것', () => {
  it('하단 바 폭 규칙은 그대로 — 실측이 이미 균등이었다', () => {
    const btn = sliceBetween(read(CSS), '.viewer-sheet-bar__btn {', '}');
    expect(btn).toMatch(/flex:\s*1/);
    expect(btn, '넘침 차단이 균등 폭의 실제 근거다').toMatch(/overflow:\s*hidden/);
    expect(sliceBetween(read(CSS), '.viewer-sheet-bar__badge {', '}'), '배지가 폭을 밀지 않는다')
      .toMatch(/max-width/);
  });

  it('데스크톱 좌우 칸 경로는 무접촉 — 시트는 1179px 이하에서만 뜬다', () => {
    const css = read(CSS);
    const guard = css.indexOf('@media (max-width: 1179px)');
    expect(guard).toBeGreaterThan(-1);
    expect(css.indexOf('.viewer-sheet__section-body'), '시트 본문 규칙은 그 미디어 쿼리 안')
      .toBeGreaterThan(guard);
  });
});

/**
 * v2-S 훈음 하단 루비 (설계 5486791778, 오너 발안 「후리가나는 위, 훈음은 아래」).
 * 기하(세로 증가 0 · 위아래 대칭 · 비겹침 · 본문 무접촉)는 브라우저가 재고
 * (`typography.e2e.mjs`), 여기서는 **적용 범위와 상수 동조**를 잡는다.
 */
describe('⑤ 훈음 하단 루비 — 범위와 동조', () => {
  it('분모가 line-height와 동조한다 — 한 상수를 바꾸면 둘 다 바꿔야 한다', () => {
    const css = read(CSS);
    const lh = /\.word-fit \.surface \{[^}]*line-height:\s*([\d.]+)/.exec(css)?.[1];
    expect(lh, '.word-fit .surface의 line-height를 못 읽었다').toBeTruthy();
    // 병음(위)과 훈음(아래)이 **같은 분모**를 쓴다 — 대칭의 근거다.
    const pin = sliceBetween(css, '.word-fit ruby[data-pinyin] > .rt-an, ', '}');
    const hun = sliceBetween(css, '> .rt-hun {', '}');
    expect(pin, `병음 분모가 ${lh}가 아니다`).toContain(`/ ${lh}) * 100%`);
    expect(hun, `훈음 분모가 ${lh}가 아니다`).toContain(`/ ${lh}) * 100%`);
    expect(pin, '병음은 위 — bottom 앵커').toMatch(/bottom:\s*calc/);
    expect(hun, '훈음은 아래 — top 앵커').toMatch(/top:\s*calc/);
  });

  it('카드 한정 — 규칙이 `.word-fit` 밖으로 새지 않는다', () => {
    // 본문은 사용자가 글자 크기를 줄일 수 있어 1em 셀이 작아진다. 위아래로 끼면 줄
    // 간격이 무너지므로 본문(.word-token)에는 절대 달지 않는다(설계 §2).
    // `^\.`로 시작을 묶으면 `:is(...)`로 시작하는 선택자를 통째로 건너뛴다(실측: 그
    // 변이가 이 계약을 무증상으로 통과했다). 시작 문자를 가리지 않는다.
    for (const [, sel] of cssRules(CSS).matchAll(/^([^\n{]*\.rt-hun[^\n{]*)\{/gm)) {
      expect(sel, `훈음 규칙이 카드 밖을 가리킨다: ${sel}`).toMatch(/\.word-fit/);
    }
    expect(read(CSS)).not.toMatch(/\.word-token[^\n{]*\.rt-hun/);
  });

  it('한 글자를 담은 칸에서만 단다 — 병음 칸도 요미 칸도(혼종 토큰 실측)', () => {
    // 훈음을 병음 칸에만 달면 잃는 글자가 있다. 라틴이 섞인 중국어 토큰은 병음 격자
    // (글자 수 == 음절 수)가 성립하지 않아 요미 경로로 흐르는데(실측 2026-09-01:
    // 한자 토큰 45개 중 `T恤`·`QQ号` 2개), 폐지한 나열 줄이 그 글자들의 유일한 훈음
    // 공급처였다. 그래서 두 칸 다 받되, 한 칸에 두 글자 이상이면 어느 글자의 훈음인지
    // 가리킬 수 없어 비운다.
    const seg = splitRuby('T恤', 'xù').find((s) => s.kanji);
    expect([...seg.kanji], '혼종 토큰의 한자 덩어리가 한 글자다').toHaveLength(1);
    expect(seg.pinyin, '혼종 토큰은 병음 표식이 없다 — 그래서 요미 칸까지 필요하다').toBeFalsy();

    const render = sliceBetween(card(), 'const hunByChar = new Map', '</ruby>');
    expect(render, '한 글자 칸 조건이 없다').toMatch(/chars\.length === 1 \? hunByChar\.get\(seg\.kanji\) : null/);
    expect(render, '뽑아만 놓고 루비로 그리지 않는다').toMatch(/\{hun && <span className="rt-hun">\{hun\}<\/span>\}/);

    // 훈음 규칙은 둘이다 — 본체(절대배치)와 요미 칸 앵커 보정. 본체가 두 칸을 다 잡지
    // 않으면 보정만 남아 요미 칸은 그냥 흐르는 텍스트가 된다. 그래서 **본체**를 짚는다.
    const main = [...cssRules(CSS).matchAll(/^([^\n{]*\.rt-hun[^\n{]*)\{([^}]*)\}/gm)]
      .find(([, , body]) => /position:\s*absolute/.test(body));
    expect(main, '훈음 절대배치 규칙을 못 찾았다').toBeTruthy();
    expect(main[1], '요미 칸이 빠졌다 — 혼종 토큰이 훈음을 잃는다').toContain('data-yomi');
    expect(main[1], '병음 칸이 빠졌다').toContain('data-pinyin');
  });

  it('훈음 나열 줄이 부활하지 않는다 — 헤더에 있는 글자를 다시 그리던 것', () => {
    // 이 블록은 `card()` 슬라이스(편집 패널 앞에서 끊긴다) 밖이라 따로 잘라 본다.
    const block = sliceBetween(read(VIEWER), '{/* 한자 대조 블록', '})()}');
    expect(block, 'huns.map 나열이 되살아났다').not.toMatch(/huns\.map/);
    // 日 자형 줄과 ⚠ 경고는 남긴다 — 훈음만 뽑아냈다.
    expect(block, '日 줄까지 지우면 안 된다').toContain('formatJaRef');
    expect(block, '⚠ 경고도 남는다').toContain('getJaWarn');
  });
});

/**
 * 계약: 요미 칸 分散配置 (JLReq / JIS X 4051, 오너 승인 2026-09-01 「권장대로 ㄱㄱ」).
 *
 * ── 우리가 정할 문제가 아니었다
 *
 * 요미가 본체보다 길 때의 처리는 일본 조판에 규범이 있다. 삐짐(はみ出し)은 한쪽 요미
 * 1글자까지 허용되지만 **줄머리·줄끝으로는 금지**이고, 길면 **본체 글자를 벌린다**.
 * 우리 카드는 둘 다 어기고 있었다 — 실측 `志望者`가 카드 왼쪽으로 47px, 요미가 줄 위로
 * 17.8px(바로 위 메타 줄과 겹쳤다).
 *
 * ── 설계와 배선이 어긋난 자리였다
 *
 * `fitDivisor`는 `max(글자수, 요미÷2)`로 **요미가 패널 폭을 꽉 채우도록** 크기를 정한다
 * (`志望者`: 요미 폭이 정확히 100%). 크기는 그렇게 잡아 놓고 **위치만 본체 기준**으로
 * 잡아서 삐졌다. 分散配置는 그 전제를 위치 쪽에도 세우는 일이다.
 *
 * 기하는 브라우저가 잰다(`typography.e2e.mjs` 4종 — 삐짐 부호·벌림 방향·세로 불변·병음
 * 무접촉). 여기서는 **배선과 상수 동조**를 잡는다.
 */
describe('⑥ 요미 칸 分散配置 — 배선과 동조', () => {
  it('폭 계산은 CSS가 한다 — JSX는 요미 글자수만 넘긴다', () => {
    // `--fit-n`과 같은 패턴이다. JSX가 px를 계산하기 시작하면 폰트 크기가 바뀔 때마다
    // 두 군데를 맞춰야 한다.
    const render = sliceBetween(card(), 'const hunByChar = new Map', '</ruby>');
    expect(render, '요미 글자수를 안 넘긴다').toMatch(/'--yomi-n': yomiN/);
    expect(render, 'JSX가 폭을 직접 계산한다').not.toMatch(/0\.5\s*\*|em'|px'/);
    expect(cssRules(CSS)).toContain('min-width: calc(var(--yomi-n, 0) * 0.5em);');
  });

  it('0.5em이 요미 크기와 동조한다 — 한 상수를 바꾸면 둘 다 바꾼다', () => {
    // 「요미 폭 = 글자수 × 0.5em」은 **요미가 본체의 절반**이라서 성립한다(일본 조판의
    // 표준이고 우리도 그렇다). 요미 크기를 바꾸면 폭 식도 같이 바꿔야 한다.
    const css = cssRules(CSS);
    const size = /\.word-fit :is\(rt, \.rt-an\) \{[^}]*font-size:\s*([\d.]+)em/.exec(css)?.[1];
    expect(size, '요미 크기를 못 읽었다').toBe('0.5');
    expect(css, `폭 식의 계수가 ${size}em이 아니다`).toContain(`var(--yomi-n, 0) * ${size}em`);
  });

  it('가나 읽기에만 건다 — 0.5em/자는 가나 전제다', () => {
    // 혼종 중국어 토큰(`T恤`)의 읽기는 병음이라 라틴이고, 라틴은 0.5em보다 훨씬 좁다.
    // 그대로 넘기면 없는 폭을 예약해 본체가 밀린다.
    const render = sliceBetween(card(), 'const hunByChar = new Map', '</ruby>');
    expect(render).toMatch(/KANA_RE\.test\(seg\.reading/);
    expect(render, '병음 경로에도 걸린다').toMatch(/!seg\.pinyin && KANA_RE/);
  });

  it('가나 판별이 한 곳에 산다 — splitRuby가 내보내고 뷰어가 쓴다', () => {
    // 같은 판별이 병음/요미 갈림길에도 있다. 두 벌이면 한쪽만 낡는다.
    const lib = read('src/lib/splitRuby.js');
    expect(lib).toContain('export const KANA_RE');
    expect(lib.match(/\[぀-ヿ\]/g), '가나 문자 범위가 두 번 이상 적혀 있다').toHaveLength(1);
    expect(read(VIEWER)).toMatch(/import \{[^}]*\bKANA_RE\b[^}]*\} from '\.\.\/lib\/splitRuby'/);
  });

  it('v2-S의 우회가 되살아나지 않는다 — 상자를 고쳤으니 필요 없다', () => {
    // S는 요미 칸 상자가 어긋나 있어 훈음을 `top: 100%`로 우회시켰다. 그 우회는 훈음을
    // 줄 아래로 3.3px 밀어내고 있었다(실측). 상자가 줄상자가 된 지금은 병음과 같은 식이
    // 서고 훈음이 줄 안에 든다 — 우회가 돌아오면 그 이득이 사라진다.
    const rules = cssRules(CSS);
    expect(rules, '요미 훈음 우회가 되살아났다').not.toMatch(/ruby\[data-yomi\][^{]*>\s*\.rt-hun\s*\{[^}]*top:\s*100%/);
    // 요미 칸 상자가 줄상자와 같아야 그 식이 선다
    // ⚠ 앵커에 줄바꿈을 붙인다 — 공용 규칙(`…[data-pinyin], …[data-yomi] {`)에도 같은
    // 문자열이 들어 있어, 안 붙이면 그 규칙을 잘라 와 계약이 엉뚱한 곳을 본다.
    const yomi = sliceBetween(rules, '\n.word-fit ruby[data-yomi] {', '}');
    expect(yomi).toContain('display: inline-flex');
    expect(yomi).toContain('justify-content: space-evenly');
  });

  it('병음 칸 규칙과 스코프가 갈린다 — 격자에 min-width가 새지 않는다', () => {
    const pin = sliceBetween(cssRules(CSS), '.word-fit ruby[data-pinyin] { display', '}');
    expect(pin, '병음 격자에 요미 폭 예약이 샜다').not.toContain('--yomi-n');
    expect(pin, '병음 격자의 1em 고정이 사라졌다').toContain('width: 1em');
  });
});
