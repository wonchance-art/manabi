// 뒤로 가기 자리(LEVEL-RESTORE-001) — 긴 단어 목록에서 다른 화면에 다녀오면 그 줄로 돌아온다.
// 운영 실측(2026-10-17 KST): /chinese/vocab/h1 2500px → GNB 배움 → 뒤로 → 2231px(−269px, 다른 카드 줄).
// 원인 ① 돌아오면 처음 150개만 다시 그린다(useState(LEVEL_LIST_PAGE)) ② 묶음 생략(content-visibility)의 어림 높이 1200px.
// 계약 = 자리 값 검증(순수 함수) + 배선(남기기 · 되살리기 · 하이드레이션 기본값 · 생략 끄기). 실제 복원 정확도는 빌드 Playwright가 본다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';
import { LEVEL_PLACE_KEY, levelPlaceOf, withLevelPlace } from '../../lib/levelList.js';

const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const page = read('src/views/LevelListPage.jsx');
const css = read('src/components/levels/level-list.css');

describe('자리 값 — levelPlaceOf · withLevelPlace', () => {
  const place = { path: '/chinese/vocab/h1', limit: 600, y: 2500, query: '', key: '爱', top: 212.5 };
  it('Next의 기록 값(__NA · 트리)은 그대로 두고 우리 자리만 얹는다', () => {
    const next = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ['', {}], other: 1 };
    const state = withLevelPlace(next, place);
    expect(state).toEqual({ ...next, [LEVEL_PLACE_KEY]: place });
    expect(next[LEVEL_PLACE_KEY]).toBeUndefined(); // 원본을 바꾸지 않는다
    expect(withLevelPlace(null, place)).toEqual({ [LEVEL_PLACE_KEY]: place });
  });
  it('같은 주소의 자리만 돌려준다 — 기준 카드가 있으면 함께', () => {
    const state = withLevelPlace({ __NA: true }, place);
    expect(levelPlaceOf(state, '/chinese/vocab/h1')).toEqual({ limit: 600, y: 2500, query: '', key: '爱', top: 212.5 });
    expect(levelPlaceOf(state, '/chinese/vocab/h2')).toBeNull(); // 다른 레벨 · 다른 목록
    expect(levelPlaceOf(null, '/chinese/vocab/h1')).toBeNull(); // 새로 들어온 기록(Next가 지운 값)
    expect(levelPlaceOf({ __NA: true }, '/chinese/vocab/h1')).toBeNull();
    const bare = levelPlaceOf(withLevelPlace({}, { path: '/japanese/bunkei/n4', limit: 150, y: 900, query: 'から' }), '/japanese/bunkei/n4');
    expect(bare).toEqual({ limit: 150, y: 900, query: 'から' }); // 문형 — 기준 카드 없이 세로 위치만
  });
  it('망가진 값은 버린다(무한 그리기 · 엉뚱한 위치 방지)', () => {
    for (const bad of [{ limit: 0 }, { limit: 1.5 }, { limit: 999999 }, { limit: '600' }, { y: -1 }, { y: Number.NaN }, { y: 1e9 }]) {
      expect(levelPlaceOf(withLevelPlace({}, { ...place, ...bad }), place.path)).toBeNull();
    }
    expect(levelPlaceOf(withLevelPlace({}, { ...place, key: 7 }), place.path)).not.toHaveProperty('key');
    expect(levelPlaceOf(withLevelPlace({}, { ...place, query: 3 }), place.path).query).toBe('');
  });
});

describe('배선 — LevelListPage', () => {
  it('서버 렌더 · 하이드레이션은 늘 150개(불일치 0) — 늘리는 것은 붙은 뒤 layout effect', () => {
    expect(page).toContain('const [limit, setLimit] = useState(LEVEL_LIST_PAGE);');
    const restore = sliceBetween(page, 'const placeRef = useRef(null);', 'useLayoutEffect(() => {\n    const place = placeRef.current;');
    expect(restore).toContain('useLayoutEffect(() => {');
    expect(restore).toContain('const place = levelPlaceOf(window.history.state, window.location.pathname);');
    expect(restore).toContain('setLimit(Math.max(LEVEL_LIST_PAGE, place.limit));');
    expect(restore).toContain('setQuery(place.query);');
    expect(restore).toContain('lastQuery.current = place.query;'); // 찾던 말을 되살려도 150으로 되돌리지 않는다
    expect(restore).toContain('if (hanzi) return;');
  });
  it('찾기 말이 바뀔 때만 150개로 — 첫 그리기에서는 되살린 개수를 지우지 않는다', () => {
    const reset = sliceBetween(page, 'const lastQuery = useRef(query);', '}, [query]);');
    expect(reset).toContain('if (lastQuery.current === query) return;');
    expect(page).not.toContain('useEffect(() => setLimit(LEVEL_LIST_PAGE), [query]);');
  });
  it('보기 설정은 그리기 전에 읽는다 — 복원이 고른 보기의 카드 높이로 맞추게', () => {
    expect(sliceBetween(page, '// 보기 설정은 이 기기에 기억한다', 'localStorage.getItem(PREFS_KEY)')).toContain('useLayoutEffect(() => {');
  });
  it('되살리기: 기준 카드(없으면 세로 위치)로 · 사용자가 먼저 움직이면 멈춤 · 끝나면 묶음 실제 높이를 박고 생략을 다시 켠다', () => {
    const apply = sliceBetween(page, 'const place = placeRef.current;\n    if (!restoring || !place) return undefined;', '}, [restoring]);');
    expect(apply).toContain("const top = node ? window.scrollY + node.getBoundingClientRect().top - place.top : place.y;");
    expect(apply).toContain("window.scrollTo({ top, behavior: 'instant' });");
    expect(apply).toContain("const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'];");
    expect(apply).toContain('group.style.containIntrinsicSize = `auto ${Math.round(group.getBoundingClientRect().height)}px`;');
    expect(apply).toContain('setRestoring(false);');
    expect(apply).toContain('apply(); // 첫 그림부터 그 자리');
    expect(page).toContain('data-lv-restoring={restoring || undefined}>');
    expect(css).toContain('.lv-page[data-lv-restoring] .lv-group{content-visibility:visible}');
    expect(css).toContain('.lv-group{content-visibility:auto;contain-intrinsic-size:auto 1200px;'); // 평소 생략(DOM 예산)은 그대로
  });
  it('남기기: 굴리기 멈춤 · 링크 누름(GNB 포함, capture) · 떠날 때 — 이 기록에, 다른 주소로 떠난 뒤 · 되살리는 중에는 쓰지 않는다', () => {
    const save = sliceBetween(page, 'const remember = () => {', 'window.removeEventListener(\'pagehide\', remember);');
    expect(save).toContain('if (placeRef.current || window.location.pathname !== path) return;');
    expect(save).toContain("window.history.replaceState(withLevelPlace(window.history.state, place), '', window.location.href);");
    expect(save).toContain('const place = { path, limit: limitRef.current, query: queryRef.current, y: Math.round(window.scrollY), ...anchor() };');
    expect(save).toContain("document.addEventListener('click', click, true);");
    expect(save).toContain("window.addEventListener('pagehide', remember);");
    expect(save).toContain('timer = setTimeout(remember, 200);');
  });
  it('문형도 기준 칸으로 — 주제 칩으로 건너뛴 뒤 돌아와도 세로 위치가 아니라 같은 문형에', () => {
    expect(page).toContain('<li key={e.key} className="lv-pat" data-lv-pat={e.key}>');
    expect(sliceBetween(page, 'const anchor = () => {', 'const remember = () => {')).toContain("listRef.current?.querySelectorAll('[data-lv-card], [data-lv-pat]')");
    expect(sliceBetween(page, 'const anchor = () => {', 'const remember = () => {')).toContain('key: cards[low].dataset.lvCard ?? cards[low].dataset.lvPat');
    expect(page).toContain('listRef.current.querySelector(`[data-lv-card="${CSS.escape(place.key)}"], [data-lv-pat="${CSS.escape(place.key)}"]`)');
  });
});
