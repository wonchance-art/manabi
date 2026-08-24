import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
const deck = read('src/components/ContinueDeck.jsx');
const css = read('src/index.css');

/**
 * 계약: '이어서' 덱(오너 승인 2026-08-24 — 라벨 없이 점만, 폭 무관 동일 조작).
 * 설계에서 약속한 네 가지를 못 박는다. 특히 ⑴은 거짓 신호 방지 —
 * 넘길 게 없는데 점과 걸침을 보이면 사용자가 없는 카드를 찾는다.
 */
describe("'이어서' 덱 계약", () => {
  it('⑴ 한 장이면 캐러셀 껍데기를 씌우지 않는다 — 폭·점만 바꾸고 구조는 한 갈래', () => {
    expect(deck).toContain('if (list.length === 0) return null;');
    expect(deck).toContain('const solo = list.length === 1;');
    expect(deck).toContain('{!solo && <div className="continue-deck__dots">'); // 점 없음
    expect(css).toContain('.continue-deck--solo .continue-deck__slide { flex-basis: 100%; }'); // 걸침 없음
    // 단독일 때 **다른 트리**를 그리면 1→2로 늘 때 카드가 remount돼 화면이 튄다(e2e 실측).
    expect(deck).not.toMatch(/length === 1\) return </);
  });

  it('⑵ 모든 장이 같은 부품(.lessons-continue) — 높이가 같아야 넘길 때 안 튄다', () => {
    // 카드 렌더는 ContinueRow 한 곳뿐이어야 한다(장마다 다른 마크업이면 높이가 갈린다).
    expect(deck.match(/className="lessons-continue"/g)).toHaveLength(1);
    expect(deck.match(/<ContinueRow /g)?.length).toBe(1); // 렌더 경로는 하나뿐
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

  it('다음 장이 걸쳐 보인다 — 넘길 게 있다는 신호(폭 무관 동일)', () => {
    expect(css).toContain('.continue-deck__slide { flex: 0 0 92%; scroll-snap-align: start; }');
    // 폭별로 조작이 갈리지 않는다 — 덱에 반응형 분기를 두지 않는다(오너 확정).
    expect(css).not.toMatch(/@media[^{]*\{[^}]*continue-deck__slide/);
  });
});
