import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
const deck = read('src/components/ContinueDeck.jsx');
const css = read('src/index.css');

/**
 * 계약: 홈 알림 덱(오너 지시 2026-08-24 — 홈의 알림성 진입을 한 자리에 겹치고,
 * 라벨 없이 점만, 폭 무관 동일 조작, 성격별 색, 장마다 같은 높이).
 * ⑴은 거짓 신호 방지 — 넘길 게 없는데 점과 걸침을 보이면 없는 카드를 찾게 된다.
 */
describe('홈 알림 덱 계약', () => {
  it('⑴ 한 장이면 캐러셀 껍데기를 씌우지 않는다 — 폭·점만 바꾸고 구조는 한 갈래', () => {
    expect(deck).toContain('if (list.length === 0) return null;');
    expect(deck).toContain('const solo = list.length === 1;');
    expect(deck).toContain('{!solo && <div className="continue-deck__dots">'); // 점 없음
    expect(css).toContain('.continue-deck--solo .continue-deck__slide { flex-basis: 100%; }'); // 걸침 없음
    // 단독일 때 **다른 트리**를 그리면 1→2로 늘 때 카드가 remount돼 화면이 튄다(e2e 실측).
    expect(deck).not.toMatch(/length === 1\) return </);
  });

  it('⑵ 모든 장이 같은 부품 — 렌더 경로가 하나뿐이어야 높이가 갈리지 않는다', () => {
    expect(deck.match(/<ContinueRow /g)?.length).toBe(1);
    expect(deck).toContain('className={`deck-card deck-card--${item.tone || \'progress\'}`}');
  });

  it('⑵-a 높이는 장마다 같다 — 줄 수·칩 유무가 카드 크기를 흔들지 못한다(오너 지시)', () => {
    expect(css).toMatch(/\.deck-card \{[\s\S]*?height: 112px;/);
    // 긴 제목이 높이를 밀지 못하게 2줄에서 자른다.
    expect(css).toMatch(/\.deck-card__title \{[\s\S]*?-webkit-line-clamp: 2;/);
    // 칩 줄도 상한이 있어야 예보 카드만 커지지 않는다.
    expect(css).toMatch(/\.deck-card__chips \{[^}]*max-height/);
  });

  it('⑵-b 성격을 색으로 가른다 — 함께 읽기는 진행 계열의 빨강이 아니다(오너 지시)', () => {
    expect(css).toContain('.deck-card--progress { border-left-color: var(--primary);');
    expect(css).toContain('.deck-card--review   { border-left-color: var(--warning);');
    expect(css).toContain('.deck-card--social   { border-left-color: var(--accent-text);');
    // 함께(social)가 진행(progress)의 테라코타를 재사용하면 성격 구분이 무너진다.
    const social = css.match(/\.deck-card--social\s*\{[^}]*\}/)?.[0];
    expect(social, 'social tone 규칙을 찾을 수 있어야 한다').toBeTruthy();
    expect(social).not.toContain('--primary');
    expect(social).not.toContain('--danger');
  });

  it('⑶ 점 개수 = 카드 개수, 점은 장식이 아니라 버튼', () => {
    expect(deck).toContain('list.map((item, i) => (');
    expect(deck).toContain('<button');
    expect(deck).toContain('aria-label={`${i + 1}번째 카드 보기`}');
    expect(deck).toContain('onClick={() => goTo(i)}');
  });

  it('⑷ prefers-reduced-motion을 존중한다 — JS 스크롤과 CSS 양쪽', () => {
    expect(deck).toContain("prefers-reduced-motion: reduce");
    expect(deck).toContain("behavior: reduced ? 'auto' : 'smooth'");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]{0,200}continue-deck__scroller \{ scroll-behavior: auto; \}/);
  });

  it('넘기기는 네이티브 scroll-snap — 캐러셀 라이브러리 의존성 0', () => {
    expect(css).toContain('scroll-snap-type: x mandatory');
    expect(css).toContain('scroll-snap-align: start');
    const pkg = JSON.parse(read('package.json'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(' ');
    expect(deps).not.toMatch(/embla|swiper|keen-slider|react-slick/);
  });

  it('홈의 알림성 진입이 전부 덱으로 모인다 — 흩어진 카드가 남지 않는다', () => {
    const home = read('src/views/HomePage.jsx');
    for (const key of ["key: 'forecast'", "key: 'lesson'"]) expect(home).toContain(key);
    expect(home).toContain('useRereadCandidate()');
    expect(home).toContain('useGroupEntryItem()');
    // 옛 개별 카드는 부활 금지 — 같은 알림이 두 자리에 나오면 겹치기가 무의미해진다.
    expect(home).not.toContain('<ForecastCard');
    expect(home).not.toContain('<GroupEntryCard');
    expect(fs.existsSync(path.join(process.cwd(), 'src/components/ForecastCard.jsx'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'src/components/GroupEntryCard.jsx'))).toBe(false);
  });

  it('예보의 침묵 계약은 유지된다 — 흐려질 단어가 0이면 항목 자체가 없다', () => {
    expect(read('src/views/HomePage.jsx')).toContain('forecast?.count > 0 && forecast.top3?.length > 0 &&');
  });

  it('다음 장이 걸쳐 보인다 — 넘길 게 있다는 신호(폭 무관 동일)', () => {
    expect(css).toContain('.continue-deck__slide { flex: 0 0 96%; scroll-snap-align: start; }');
    // 폭별로 조작이 갈리지 않는다 — 덱에 반응형 분기를 두지 않는다(오너 확정).
    expect(css).not.toMatch(/@media[^{]*\{[^}]*continue-deck__slide/);
  });
});
