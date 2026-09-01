import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';

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
const SHEET = 'src/components/ViewerBottomSheet.jsx';
const VIEWER = 'src/views/ViewerPage.jsx';
const CSS = 'src/index.css';

const card = () => sliceBetween(read(VIEWER), 'const wordDetailCard = !selectedToken', '{isEditingToken && (');

describe('① 전환 경로는 하단 바 하나 — 섹션 헤더·셰브런 부활 금지', () => {
  it('시트 안에 헤더 버튼도 셰브런도 없다', () => {
    const src = read(SHEET);
    for (const gone of ['viewer-sheet__section-header', 'viewer-sheet__chevron', 'aria-expanded']) {
      expect(src, `${gone}가 되살아났다 — 여는 방법이 다시 둘이 된다`).not.toContain(gone);
    }
    expect(read(CSS), 'CSS에도 남으면 안 된다').not.toContain('viewer-sheet__section-header');
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
