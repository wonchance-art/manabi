// 단어 목록 키보드(LEVEL-KEYS-001, 오너 목업 승인 2026-10-17 KST — 「O · X 뒤 다음 카드로 자동 이동」).
// ① 키 판정(순수) ② 서버 렌더 마크업 — roving tabindex · 카드 이름 · 안내 한 줄 ③ 훅 대역 렌더 — 자동 이동 · 무시 조건.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { levelCardLabel, levelListKeyAction, levelListMove, levelListNearest } from '../../lib/levelListKeys';

const h = vi.hoisted(() => ({ stub: false, slots: [], index: 0, effects: [], pending: new Set(), mutate: [], user: 'u1', rows: [], facets: null,
  saved: [], answers: new Map(), answered: [], cancelled: [], sameDay: false, rounds: null, before: null, started: [], replaced: [] }));
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
    // 보기 설정 읽기 · 뒤로 가기 자리(LEVEL-RESTORE-001)는 그리기 전 효과다 — 대역에서는 useEffect와 같이 모아 둔다.
    useLayoutEffect(fn, deps) { if (!on()) return actual.useLayoutEffect(fn, deps); h.index++; h.effects.push(fn); },
  };
});
vi.mock('next/navigation', () => ({ usePathname: () => '/chinese/vocab/h1' }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: h.stub && h.user ? { id: h.user } : null }) }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/lib/useTTS', () => ({ useTTS: () => ({ speak: () => {}, supported: true }) }));
vi.mock('@/lib/useKnownWords', () => ({ useKnownWords: () => ({ rows: h.rows, isPendingWord: (_lang, key) => h.pending.has(key),
  mutation: { mutate: (r) => h.mutate.push(r), mutateAsync: (r) => { h.mutate.push(r); return Promise.resolve(); } } }) }));
vi.mock('@/lib/useWordFacets', () => ({ useWordFacets: () => h.facets || ({ available: false, rows: [], mark: () => {} }) }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
// 단어장 대조 · 바퀴 답(LEVEL-ROUND-001) 대역 — 공부 중인 단어는 h.saved, 바퀴 답은 h.answers(키 `단어|보기`)로 준다.
vi.mock('@/lib/levelList', async (importOriginal) => ({ ...await importOriginal(),
  fetchSavedLevelKeysAll: () => Promise.resolve(new Set(h.saved)),
  fetchSavedLevelKeys: (_c, _u, _l, keys) => Promise.resolve(new Set(keys.filter((k) => h.saved.includes(k)))) }));
vi.mock('@/lib/useLevelAnswers', () => ({ useLevelAnswers: () => ({
  answers: h.answers,
  roundOf: (v) => h.rounds?.[v] || { round: 1, scope: 'all', startedAt: null, recorded: false },
  before: () => h.before || new Map(),
  roundRows: h.roundRows || [],
  roundsAvailable: !!h.rounds,
  startRound: (v, scope) => { h.started.push([v, scope]); return Promise.resolve({ view: v, round_no: 2, scope }); },
  undoRound: () => Promise.resolve(),
  replaceRounds: (rows) => { h.replaced.push(rows); return Promise.resolve([]); },
  get: (w, v) => h.answers.get(`${w}|${v}`) || null,
  answer: (w, v, correct) => { h.answered.push([w, v, correct]); return { sameDay: h.sameDay }; },
  cancel: (w, v) => { h.cancelled.push([w, v]); },
}) }));

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
  it('누르고 있는 키(반복)는 ↑↓만 — O · X · Space · Esc 반복은 무시', () => {
    expect(['o', 'x', ' ', 'Escape', 'ArrowDown', 'ArrowUp'].map((key) => levelListKeyAction(ev({ key, repeat: true }))))
      .toEqual([null, null, null, null, 'next', 'prev']);
  });
  it('사라진 카드의 가장 가까운 남은 카드 — 뒤쪽 먼저, 마지막이면 앞쪽, 하나도 없으면 null', () => {
    const present = (...k) => new Map(k.map((x) => [x, {}]));
    expect(levelListNearest(['a', 'b', 'c'], 'b', present('a', 'c'))).toBe('c');
    expect(levelListNearest(['a', 'b', 'c'], 'c', present('a', 'b'))).toBe('b');
    expect(levelListNearest(['a', 'b', 'c'], 'b', present('a'))).toBe('a');
    expect(levelListNearest(['a'], 'a', present())).toBeNull();
    expect(levelListNearest([], 'z', present('q'))).toBe('q');
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
  it('카드 안 버튼(O · X · 듣기)은 지금 카드에서만 Tab으로 닿는다(0) — 다른 카드는 -1', () => {
    const buttons = [...html.matchAll(/<button type="button" class="lv-(?:fab|snd)[^"]*"[^>]*>/g)].map((m) => m[0]);
    expect(buttons.length).toBe(300); // O · X × 150 (듣기는 붙은 뒤에만 그린다 — 같은 inner를 받는다)
    expect(buttons.slice(0, 2).every((b) => b.includes('tabindex="0"'))).toBe(true); // 첫 카드(지금 카드)의 O · X
    expect(buttons.slice(2).filter((b) => !b.includes('tabindex="-1"'))).toEqual([]);
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
function renderStub(d = data) {
  h.index = 0; h.effects = [];
  const tree = LevelListPage(d);
  const col = walk(tree, (n) => n.props?.className === 'lv-col')[0];
  const cards = walk(tree, (n) => n.type === VocabCard);
  return { tree, col, cards, current: cards.find((c) => c.props.current)?.props.entry.key };
}
const runEffects = () => { for (const fn of h.effects) { try { fn(); } catch { /* 브라우저 전용 효과는 건너뛴다 */ } } };
// 카드 노드 대역 — closest('[data-lv-card]')는 자기 자신, 버튼 · 입력 칸은 아니다.
const cardTarget = (k) => { const t = { dataset: { lvCard: k }, closest: (sel) => (sel === '[data-lv-card]' ? t : null) }; return t; };
const key = (k, over = {}) => ({ key: k, target: cardTarget(renderStub().current), preventDefault: vi.fn(), ...over });
const without = (gone) => ({ ...data, groups: data.groups.map((g) => ({ ...g, entries: g.entries.filter((e) => (e.key ?? e.word) !== gone) })) });

describe('③ 키로 고르기 — 자동 이동 · 진행 중 무시', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    h.stub = true; h.slots = []; h.pending = new Set(); h.mutate = []; h.user = 'u1'; h.rows = []; h.facets = null;
    renderStub();
    runEffects();
  });
  const keys = () => renderStub().cards.map((c) => c.props.entry.key);

  it('O → 지금 카드에 「안다」(클릭과 같은 경로) 후 다음 카드로', async () => {
    const [first, second] = keys();
    const { col, current } = renderStub();
    expect(current).toBe(first);
    const event = key('o');
    col.props.onKeyDown(event);
    expect(event.preventDefault).toHaveBeenCalled();
    // 공부 중인 단어인지 먼저 확인한다(LEVEL-ROUND-001) — 단어장 대조 전이면 묻고 난 뒤에 옮긴다.
    await new Promise((r) => setTimeout(r));
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

  it('이미 아는 카드에서 O — 풀지 않고(토글 아님) 다음 카드로만', () => {
    const [first, second] = keys();
    h.rows = [{ lang: 'zh', word_text: first }];
    expect(renderStub().cards[0].props.known).toBe(true);
    renderStub().col.props.onKeyDown(key('o'));
    expect(h.mutate).toEqual([]);
    expect(renderStub().current).toBe(second);
  });

  it('O를 누르고 있으면(반복) 아무것도 하지 않는다 — 카드가 한꺼번에 바뀌지 않게', () => {
    const [first] = keys();
    const event = key('o', { repeat: true });
    renderStub().col.props.onKeyDown(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(h.mutate).toEqual([]);
    expect(renderStub().current).toBe(first);
  });

  it('카드 밖(「더 보기」) · 카드 안 버튼(듣기 등)의 키는 그 버튼 몫 — Space · O를 가로채지 않는다', () => {
    const [first] = keys();
    const more = { closest: () => null };
    const card = cardTarget(first);
    const inButton = { closest: (sel) => (sel === '[data-lv-card]' ? card : sel === 'button, a' ? {} : null) };
    for (const target of [more, inButton]) {
      for (const k of [' ', 'o', 'ArrowDown']) {
        const event = key(k, { target });
        renderStub().col.props.onKeyDown(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
      }
    }
    expect(h.mutate).toEqual([]);
    expect(renderStub().current).toBe(first);
  });

  it('게스트의 O · X — 로그인 안내만 띄우고 그 카드에 머문다', () => {
    h.user = null;
    const [first] = keys();
    renderStub().col.props.onKeyDown(key('o'));
    renderStub().col.props.onKeyDown(key('x'));
    expect(h.mutate).toEqual([]);
    expect(renderStub().current).toBe(first);
    const toast = walk(renderStub().tree, (n) => n.props?.className === 'lv-toast')[0];
    expect(toast).toBeTruthy();
  });

  it('지금 카드가 사라지면(숨기기 켠 채 O 등) 가장 가까운 남은 카드가 지금 카드 — 포커스를 body에 두지 않는다', () => {
    const ks = keys();
    renderStub().cards[2].props.onCardFocus();
    renderStub(); runEffects(); // 직전 카드 순서를 기억
    const body = {};
    vi.stubGlobal('document', { body, activeElement: body });
    renderStub(without(ks[2])); runEffects();
    expect(renderStub(without(ks[2])).current).toBe(ks[3]);
    expect(renderStub(without(ks[2])).cards.find((c) => c.props.current)?.props.entry.key).toBe(ks[3]);
  });
});

describe('④ 탭 보기(탭별 O · X) — 켜기만 · 보내는 중 무시', () => {
  beforeEach(() => {
    h.stub = true; h.slots = []; h.pending = new Set(); h.mutate = []; h.user = 'u1'; h.rows = [];
    h.facets = { available: true, rows: [], marks: [], sending: new Set(),
      mark(body) { this.marks.push(body); return true; }, isPending(k) { return this.sending.has(k); } };
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ view: 'word' }), setItem() {}, removeItem() {} });
    renderStub(); runEffects(); renderStub(); runEffects();
  });
  const keys = () => renderStub().cards.map((c) => c.props.entry.key);

  it('탭 O — 그 탭에 O를 남기고 다음 카드로', () => {
    const [first, second] = keys();
    expect(renderStub().cards[0].props.view).toBe('word');
    renderStub().col.props.onKeyDown(key('o'));
    expect(h.facets.marks).toEqual([{ wordText: first, facet: 'word', mark: 'o' }]);
    expect(renderStub().current).toBe(second);
  });

  it('탭 기록을 보내는 중인 카드의 O · X는 무시 — 넘어가지도 않는다', () => {
    const [first] = keys();
    h.facets.sending.add(first);
    renderStub().col.props.onKeyDown(key('o'));
    renderStub().col.props.onKeyDown(key('x'));
    expect(h.facets.marks).toEqual([]);
    expect(renderStub().current).toBe(first);
  });

  it('이미 그 탭에서 X인 카드의 X — 풀지 않고 다음 카드로만', () => {
    const [first, second] = keys();
    h.facets.rows = [{ word_text: first, facet: 'word', mark: 'x' }];
    renderStub().col.props.onKeyDown(key('x'));
    expect(h.facets.marks).toEqual([]);
    expect(renderStub().current).toBe(second);
  });
});


describe('⑤ 바퀴 답 · 공부 중인 단어의 O(LEVEL-ROUND-001 — 설계 2판 1번)', () => {
  const tick = () => new Promise((r) => setTimeout(r));
  const toastOf = () => walk(renderStub().tree, (n) => n.props?.className === 'lv-toast')[0];
  const setup = async (view) => {
    vi.unstubAllGlobals();
    h.stub = true; h.slots = []; h.pending = new Set(); h.mutate = []; h.user = 'u1'; h.rows = [];
    h.answers = new Map(); h.answered = []; h.cancelled = []; h.sameDay = false; h.rounds = null; h.before = null; h.started = []; h.replaced = [];
    h.facets = view ? { available: true, rows: [], marks: [], sending: new Set(), mark(body) { this.marks.push(body); return true; }, isPending() { return false; } } : null;
    const store = new Map(view ? [['manabi:level-list-view', JSON.stringify({ view })]] : []);
    vi.stubGlobal('localStorage', { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) });
    renderStub(); runEffects(); await tick(); renderStub(); runEffects(); await tick();
  };
  const keys = () => renderStub().cards.map((c) => c.props.entry.key);

  it('전체 보기: 공부 중인 단어의 O는 아는 단어로 옮기지 않고 이번 바퀴 O만 — 처음 한 번 안내', async () => {
    h.saved = [];
    await setup();
    const [first] = keys();
    h.saved = [first];
    await setup();
    renderStub().col.props.onKeyDown(key('o'));
    await tick();
    expect(h.mutate).toEqual([]);
    expect(h.answered).toEqual([[first, 'all', true]]);
    expect(toastOf()?.props.children[0].props.children).toBe('공부 중인 단어라 복습에는 그대로 나와요');
    // O가 켜진 카드 = 이번 바퀴 O. 화면 읽기 이름은 「복습은 그대로」.
    h.answers.set(`${first}|all`, { correct: true });
    const card = renderStub().cards[0].props;
    expect([card.known, card.keepReview]).toEqual([true, true]);
  });

  it('전체 보기: 원래 몰랐던(공부 중 아닌) 단어의 O는 지금처럼 아는 단어로 + 이번 바퀴 O', async () => {
    h.saved = [];
    await setup();
    const [first] = keys();
    renderStub().col.props.onKeyDown(key('o'));
    await tick();
    expect(h.mutate).toEqual([{ lang: 'zh', wordText: first, known: true }]);
    expect(h.answered).toEqual([[first, 'all', true]]);
  });

  it('전체 보기 X — 이번 바퀴 X 한 건, 이미 X면 그 답만 취소(클릭)', async () => {
    h.saved = [];
    await setup();
    const [first] = keys();
    renderStub().cards[0].props.onX();
    expect(h.answered).toEqual([[first, 'all', false]]);
    h.answers.set(`${first}|all`, { correct: false });
    renderStub().cards[0].props.onX();
    expect(h.cancelled).toEqual([[first, 'all']]);
    expect(h.answered).toHaveLength(1);
  });

  it('탭 O · X도 그 탭의 바퀴 답 — 탭 표시를 지우면 그 답도 취소', async () => {
    h.saved = [];
    await setup('word');
    const [first, second] = keys();
    renderStub().col.props.onKeyDown(key('o'));
    expect(h.answered).toEqual([[first, 'word', true]]);
    h.facets.rows = [{ word_text: second, facet: 'word', mark: 'x' }];
    renderStub().cards[1].props.onX();
    expect(h.cancelled).toEqual([[second, 'word']]);
  });

  it('「네 탭 모두 알아요 → 아는 단어로?」는 원래 알던 단어만 · 같은 날 다른 탭에서 본 뒤의 O는 세지 않는다', async () => {
    const three = (w) => ['sentence', 'meaning', 'audio'].map((facet) => ({ word_text: w, facet, mark: 'o' }));
    h.saved = [];
    await setup('word');
    const [first] = keys();
    const ask = '네 탭 모두 알아요. 아는 단어로 옮길까요?';
    const fourth = () => { h.facets.rows = three(first); renderStub().cards[0].props.onO(); return toastOf()?.props.children[0].props.children; };
    expect(fourth()).toBe(ask);
    h.slots = []; await setup('word'); h.sameDay = true;
    expect(fourth()).not.toBe(ask); // 이번 O가 같은 날 다른 탭 뒤
    h.slots = []; await setup('word'); h.answers.set(`${first}|meaning`, { correct: true, sameDay: true });
    expect(fourth()).not.toBe(ask); // 앞서 누른 탭 O가 같은 날 다른 탭 뒤
    h.saved = [first]; h.slots = []; await setup('word');
    expect(fourth()).not.toBe(ask); // 공부 중인 단어 — 복습이 맡는다
  });
});

describe('⑥ 새 바퀴 · 끝 카드 · 초기화(LEVEL-ROUND-001 ②)', () => {
  const tick = () => new Promise((r) => setTimeout(r));
  const find = (cls) => walk(renderStub().tree, (n) => typeof n.props?.className === 'string' && n.props.className.split(' ').includes(cls));
  const textOf = (node) => (node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node)
    : Array.isArray(node) ? node.map(textOf).join('') : textOf(node.props?.children));
  const setup = async ({ rounds = null, answers = [], before = null, saved = [] } = {}) => {
    vi.unstubAllGlobals();
    h.stub = true; h.slots = []; h.pending = new Set(); h.mutate = []; h.user = 'u1'; h.rows = []; h.facets = null;
    h.saved = saved; h.answered = []; h.cancelled = []; h.sameDay = false; h.started = []; h.replaced = [];
    h.rounds = rounds; h.before = before; h.answers = new Map(answers.map(([w, c, at]) => [`${w}|all`, { correct: c, at }])); h.roundRows = [];
    const store = new Map();
    vi.stubGlobal('localStorage', { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) });
    renderStub(); runEffects(); await tick(); renderStub(); runEffects(); await tick();
  };
  const allKeys = data.groups.flatMap((g) => g.entries.map((e) => e.key ?? e.word));
  const two = { all: { round: 2, scope: 'missed', startedAt: 1, recorded: true } };

  it('「모른 것만」 바퀴 — 범위(시작 직전 X) 단어만 목록에, 카드 O · X는 이번 바퀴 답, 진도 줄은 「두 바퀴째 · N개 남음」', async () => {
    const [a, b, c] = allKeys;
    await setup({ rounds: two, before: new Map([[`${a}|all`, { correct: false }], [`${b}|all`, { correct: false }], [`${c}|all`, { correct: true }]]),
      answers: [[a, true]] });
    const { cards } = renderStub();
    expect(cards.map((x) => x.props.entry.key)).toEqual([a, b]);
    expect(cards.map((x) => [x.props.known, x.props.studying])).toEqual([[true, false], [false, false]]);
    expect(textOf(find('lv-prog__left')[0])).toBe('두 바퀴째 · 1개 남음');
  });

  it('범위를 다 답하면 진도 줄 자리에 끝 카드 — 「모른 N개만 다시」 · 「처음부터 전부」 · 복습하기', async () => {
    const [a, b] = allKeys;
    await setup({ rounds: two, before: new Map([[`${a}|all`, { correct: false }], [`${b}|all`, { correct: false }]]), answers: [[a, true], [b, false]] });
    const end = find('lv-end')[0];
    expect(textOf(end)).toContain('두 바퀴째 끝');
    expect(textOf(end)).toContain('모른 단어 1개');
    expect(find('lv-prog')).toHaveLength(0);
    const buttons = walk(end, (n) => n.type === 'button');
    expect(buttons.map(textOf)).toEqual(['모른 1개만 다시', '처음부터 전부']);
    buttons[0].props.onClick();
    buttons[1].props.onClick();
    expect(h.started).toEqual([['all', 'missed'], ['all', 'all']]);
  });

  it('바퀴 표가 없으면 끝 카드 · ⚙ 바퀴 단추 없이 지금처럼(1바퀴)', async () => {
    await setup({ rounds: null });
    expect(find('lv-end')).toHaveLength(0);
    expect(find('lv-rounds')).toHaveLength(0);
  });

  it('새 바퀴에서 O를 다시 누르면 이번 바퀴 답만 취소 — 아는 단어 표시는 그대로(해제는 X로)', async () => {
    const [a] = allKeys;
    h.rows = [{ lang: 'zh', word_text: a }];
    await setup({ rounds: { all: { round: 2, scope: 'all', startedAt: 1, recorded: true } }, answers: [[a, true]] });
    h.rows = [{ lang: 'zh', word_text: a }];
    renderStub().cards.find((c) => c.props.entry.key === a).props.onO(); // 2바퀴부터는 섞인 순서
    await tick();
    expect(h.cancelled).toEqual([[a, 'all']]);
    expect(h.mutate).toEqual([]);
  });

  it('⚙ 「이 레벨 기록 초기화」 — 한 번 더 묻고, 보기마다 새 1바퀴 + 이 레벨 아는 단어 표시만 지운다', async () => {
    const [a] = allKeys;
    await setup({ rounds: { all: { round: 3, scope: 'all', startedAt: 1, recorded: true } } });
    h.rows = [{ lang: 'zh', word_text: a }, { lang: 'zh', word_text: '不在这个级别' }];
    walk(renderStub().tree, (n) => n.props?.className === 'lv-gear' && n.props['aria-label'] === '설정')[0].props.onClick();
    const ask = () => walk(renderStub().tree, (n) => n.type === 'button' && textOf(n).startsWith('이 레벨 기록 초기화'))[0];
    ask().props.onClick();
    const confirm = walk(renderStub().tree, (n) => n.props?.className === 'lv-rounds__danger')[0];
    expect(textOf(walk(renderStub().tree, (n) => n.props?.className === 'lv-rounds__ask')[0])).toContain('단어장 카드와 복습 일정은 그대로예요');
    await confirm.props.onClick();
    await tick();
    expect(h.replaced).toHaveLength(1);
    expect(h.replaced[0].map((r) => [r.view, r.round_no, r.scope])).toEqual(['all', 'word', 'sentence', 'meaning', 'audio'].map((v) => [v, 1, 'all']));
    expect(h.mutate).toEqual([{ lang: 'zh', wordText: '#reset:H1:0', known: false, removeKeys: [a] }]);
  });

  it('2바퀴부터 묶음 안에서 섞는다 — 바퀴 번호가 씨앗(다시 그려도 같은 순서), 새 1바퀴는 교재 순서', async () => {
    await setup({ rounds: { all: { round: 1, scope: 'all', startedAt: 1, recorded: true } } });
    const keysNow = () => renderStub().cards.map((c) => c.props.entry.key);
    const textbook = keysNow();
    expect(textbook).toEqual(allKeys.slice(0, textbook.length));
    await setup({ rounds: { all: { round: 2, scope: 'all', startedAt: 1, recorded: true } } });
    const second = keysNow();
    expect(second).not.toEqual(textbook);
    expect(keysNow()).toEqual(second);
    await setup({ rounds: { all: { round: 3, scope: 'all', startedAt: 1, recorded: true } } });
    expect(keysNow()).not.toEqual(second);
  });

  it('끝 카드 — 잊은 수(같은 날 다른 탭의 O는 빼고) · 다음 바퀴는 뜻 탭으로 · 「전부」 간격 날짜', async () => {
    const [a, b, ...rest] = allKeys;
    const at = Date.UTC(2026, 9, 18, 3); // 2026-10-18 12:00 KST
    await setup({ rounds: { all: { round: 2, scope: 'all', startedAt: 1, recorded: true } },
      before: new Map([[`${a}|all`, { correct: true }], [`${b}|all`, { correct: true, sameDay: true }]]),
      answers: [[a, false, at], [b, false, at], ...rest.map((k) => [k, true, at])] });
    const end = find('lv-end')[0];
    expect(textOf(end)).toContain('모른 단어 2개 · 지난번에 안 단어 중 1개를 잊었어요');
    // 바퀴 줄이 없으면(목 · 1바퀴) 첫 「전부」 끝 → 1주 뒤
    expect(textOf(find('lv-end__next')[0])).toMatch(/^다음 바퀴는 뜻 탭으로 — /);
  });
});
