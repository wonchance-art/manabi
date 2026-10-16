// 단어 목록 키보드(LEVEL-KEYS-001, 오너 목업 승인 2026-10-17 KST — 「O · X 뒤 다음 카드로 자동 이동」).
// ① 키 판정(순수) ② 서버 렌더 마크업 — roving tabindex · 카드 이름 · 안내 한 줄 ③ 훅 대역 렌더 — 자동 이동 · 무시 조건.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { levelCardLabel, levelListKeyAction, levelListMove } from '../../lib/levelListKeys';

const h = vi.hoisted(() => ({ stub: false, slots: [], index: 0, effects: [], pending: new Set(), mutate: [] }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  const on = () => h.stub;
  return {
    ...actual,
    useState(initial) {
      if (!on()) return actual.useState(initial);
      const i = h.index++;
      if (!(i in h.slots)) h.slots[i] = typeof initial === 'function' ? initial() : initial;
      return [h.slots[i], (v) => { h.slots[i] = typeof v === 'function' ? v(h.slots[i]) : v; }];
    },
    useRef(initial) { if (!on()) return actual.useRef(initial); const i = h.index++; if (!(i in h.slots)) h.slots[i] = { current: initial }; return h.slots[i]; },
    useMemo(fn, deps) { if (!on()) return actual.useMemo(fn, deps); h.index++; return fn(); },
    useCallback(fn, deps) { if (!on()) return actual.useCallback(fn, deps); h.index++; return fn; },
    useEffect(fn, deps) { if (!on()) return actual.useEffect(fn, deps); h.index++; h.effects.push(fn); },
  };
});
vi.mock('next/navigation', () => ({ usePathname: () => '/chinese/vocab/h1' }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: h.stub ? { id: 'u1' } : null }) }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/lib/useTTS', () => ({ useTTS: () => ({ speak: () => {}, supported: true }) }));
vi.mock('@/lib/useKnownWords', () => ({ useKnownWords: () => ({ rows: [], isPendingWord: (_lang, key) => h.pending.has(key),
  mutation: { mutate: (r) => h.mutate.push(r), mutateAsync: (r) => { h.mutate.push(r); return Promise.resolve(); } } }) }));
vi.mock('@/lib/useWordFacets', () => ({ useWordFacets: () => ({ available: false, rows: [], mark: () => {} }) }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));

const { default: LevelListPage, VocabCard } = await import('../LevelListPage.jsx');
const { levelListData } = await import('../../lib/levelListData.js');
const data = await levelListData('chinese', 'vocab', 'h1');

describe('① 키 판정 — 무시 조건', () => {
  const ev = (over = {}) => ({ key: 'o', target: { closest: () => null }, ...over });
  it('↑↓ · O · X · Space · Esc를 동작으로', () => {
    expect(['ArrowDown', 'ArrowUp', 'o', 'O', 'x', 'X', ' ', 'Escape', 'a'].map((key) => levelListKeyAction(ev({ key }))))
      .toEqual(['next', 'prev', 'o', 'o', 'x', 'x', 'peek', 'close', null]);
  });
  it('입력기 조합(isComposing · keyCode 229) · 입력 칸 · 수정키 · 이미 처리된 이벤트는 무시', () => {
    expect(levelListKeyAction(ev({ isComposing: true }))).toBeNull();
    expect(levelListKeyAction(ev({ keyCode: 229 }))).toBeNull();
    expect(levelListKeyAction(ev({ nativeEvent: { isComposing: true } }))).toBeNull();
    expect(levelListKeyAction(ev({ target: { closest: (sel) => (sel.includes('input') ? {} : null) } }))).toBeNull();
    for (const mod of ['ctrlKey', 'metaKey', 'altKey']) expect(levelListKeyAction(ev({ [mod]: true })), mod).toBeNull();
    expect(levelListKeyAction(ev({ defaultPrevented: true }))).toBeNull();
  });
  it('이동 — 끝이면 더 그릴 것이 있을 때만 grow, 처음 위는 없음', () => {
    expect(levelListMove(['a', 'b'], 'a', 1)).toEqual({ key: 'b' });
    expect(levelListMove(['a', 'b'], 'b', 1)).toBeNull();
    expect(levelListMove(['a', 'b'], 'b', 1, { canGrow: true })).toEqual({ grow: true });
    expect(levelListMove(['a', 'b'], 'a', -1)).toBeNull();
  });
  it('카드 이름은 그 보기에 보이는 것만 — 뜻 보기에서 글자를, 글자 보기에서 뜻을 읽어 주지 않는다', () => {
    const e = { word: '爱', meaning: '사랑하다', ex: { text: '我爱你。' } };
    expect(levelCardLabel(e, 'all')).toBe('爱 — 사랑하다');
    expect(levelCardLabel(e, 'word', { known: true })).toBe('爱 · 아는 단어');
    expect(levelCardLabel(e, 'meaning', { studying: true })).toBe('사랑하다 · 공부 중');
    expect(levelCardLabel(e, 'sentence')).toBe('我爱你。');
    expect(levelCardLabel(e, 'audio')).toBe('소리 카드');
  });
});

describe('② 서버 렌더 — roving tabindex · 이름 · 안내', () => {
  const html = renderToStaticMarkup(<LevelListPage {...data} />);
  const cards = [...html.matchAll(/<li class="lv-entry"[^>]*>/g)].map((m) => m[0]);
  it('Tab 정지는 첫 카드 하나(0), 나머지 카드는 -1 · 카드마다 listitem 이름과 단축키', () => {
    expect(cards.length).toBe(150);
    expect(cards.filter((c) => c.includes('tabindex="0"'))).toHaveLength(1);
    expect(cards[0]).toContain('tabindex="0"');
    expect(cards.slice(1).every((c) => c.includes('tabindex="-1"'))).toBe(true);
    expect(cards.every((c) => /role="listitem"/.test(c) && /aria-label="[^"]+ — [^"]+"/.test(c) && c.includes('aria-keyshortcuts="ArrowUp ArrowDown O X Space Escape"'))).toBe(true);
  });
  it('카드 안 버튼(O · X · 듣기)은 Tab 정지가 아니다(-1)', () => {
    const buttons = [...html.matchAll(/<button type="button" class="lv-(?:fab|snd)[^"]*"[^>]*>/g)].map((m) => m[0]);
    expect(buttons.length).toBe(300); // O · X × 150 (듣기는 붙은 뒤에만 그린다 — 같은 inner -1을 받는다)
    expect(buttons.filter((b) => !b.includes('tabindex="-1"'))).toEqual([]);
  });
  it('안내 한 줄은 목업 문구 그대로, 복습방 안내와 같은 표시 규칙(pointer: fine)', () => {
    expect(html).toContain('<p class="lv-keys review-keys-hint">⌨ ↑↓ 카드 이동 · O 안다 · X 모른다 · Space 펼치기</p>');
  });
});

// ③ 훅 대역 렌더 — 목록 키 처리기를 직접 부른다(DOM 없음).
const walk = (node, pick, out = []) => {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, pick, out)); return out; }
  if (pick(node)) out.push(node);
  walk(node.props?.children, pick, out);
  return out;
};
function renderStub() {
  h.index = 0; h.effects = [];
  const tree = LevelListPage(data);
  const col = walk(tree, (n) => n.props?.className === 'lv-col')[0];
  const cards = walk(tree, (n) => n.type === VocabCard);
  return { col, cards, current: cards.find((c) => c.props.current)?.props.entry.key };
}
const key = (k, over = {}) => ({ key: k, target: { closest: () => null }, preventDefault: vi.fn(), ...over });

describe('③ 키로 고르기 — 자동 이동 · 진행 중 무시', () => {
  beforeEach(() => {
    h.stub = true; h.slots = []; h.pending = new Set(); h.mutate = [];
    renderStub();
    for (const fn of h.effects) { try { fn(); } catch { /* 브라우저 전용 효과는 건너뛴다 */ } }
  });
  const keys = () => renderStub().cards.map((c) => c.props.entry.key);

  it('O → 지금 카드에 「안다」(클릭과 같은 경로) 후 다음 카드로', () => {
    const [first, second] = keys();
    const { col, current } = renderStub();
    expect(current).toBe(first);
    const event = key('o');
    col.props.onKeyDown(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(h.mutate).toEqual([{ lang: 'zh', wordText: first, known: true }]);
    expect(renderStub().current).toBe(second);
  });

  it('↓ · ↑로 옮기고, 처음에서 ↑는 그대로', () => {
    const [first, second] = keys();
    renderStub().col.props.onKeyDown(key('ArrowDown'));
    expect(renderStub().current).toBe(second);
    renderStub().col.props.onKeyDown(key('ArrowUp'));
    renderStub().col.props.onKeyDown(key('ArrowUp'));
    expect(renderStub().current).toBe(first);
  });

  it('진행 중(아는 단어 반영 중)인 카드의 O · X는 무시 — 다음으로도 넘어가지 않는다', () => {
    const [first] = keys();
    h.pending.add(first);
    renderStub().col.props.onKeyDown(key('o'));
    renderStub().col.props.onKeyDown(key('x'));
    expect(h.mutate).toEqual([]);
    expect(renderStub().current).toBe(first);
  });

  it('입력기 조합 · 수정키 조합은 아무것도 하지 않는다', () => {
    const [first] = keys();
    for (const over of [{ isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { metaKey: true }]) {
      const event = key('o', over);
      renderStub().col.props.onKeyDown(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(h.mutate).toEqual([]);
    expect(renderStub().current).toBe(first);
  });

  it('카드에 포커스가 가면(클릭 · Tab) 그 카드가 지금 카드가 된다', () => {
    const [, , third] = keys();
    renderStub().cards[2].props.onCardFocus();
    expect(renderStub().current).toBe(third);
  });
});
