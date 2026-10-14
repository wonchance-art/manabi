import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// WALL-STATES-001 ③④ — 닫기·확인 동작의 행동 계약. DOM 없이 훅을 직접 돌리려고 React 훅을
// 슬롯 하네스로 바꾼다(AuthProfileReadOnly.test.jsx 선례). 한 번 「렌더」 = h.index를 0으로 되돌리고
// 훅을 다시 부르는 것. effect는 쌓아 두고 runEffects()로 실행한다.
const h = vi.hoisted(() => ({ slots: [], index: 0, effects: [], gemini: null }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual,
    useState(initial) { const i = h.index++; if (!(i in h.slots)) h.slots[i] = typeof initial === 'function' ? initial() : initial; return [h.slots[i], value => { h.slots[i] = typeof value === 'function' ? value(h.slots[i]) : value; }]; },
    useRef(initial) { const i = h.index++; if (!(i in h.slots)) h.slots[i] = { current: initial }; return h.slots[i]; },
    useEffect(fn, deps) { const i = h.index++; const previous = h.slots[i]; if (!previous || !deps || deps.some((value, j) => value !== previous[j])) { h.slots[i] = deps || []; h.effects.push(fn); } },
    useCallback(fn) { h.index++; return fn; },
    useMemo(fn) { h.index++; return fn(); },
  };
});
vi.mock('../gemini', () => ({ GEMINI_TIER: 'test', callGemini: vi.fn(() => h.gemini.promise) }));
vi.mock('../useReanalyze', () => ({ getParagraphs: () => [] }));

import { useViewerQuiz } from '../useViewerQuiz';
import { DISCARD_CONFIRM, hasUnsavedEdits, useDiscardGuard } from '../useDiscardGuard';
import { useReanalyzeUI } from '../useReanalyzeUI';
import ViewerQuizModal from '../../views/ViewerQuizModal';

const render = hook => { h.index = 0; return hook(); };
const runEffects = () => { for (const fn of h.effects.splice(0)) fn(); };
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const QUIZ = JSON.stringify({ questions: [{ question: 'q', options: ['a', 'b', 'c', 'd'], answer: 0 }] });

beforeEach(() => { h.slots = []; h.index = 0; h.effects = []; h.gemini = deferred(); });

describe('이해도 퀴즈 닫기(③)', () => {
  it('생성 중에 닫으면 완료 요약으로 가고, 늦게 온 응답이 닫은 퀴즈를 다시 띄우지 않는다', async () => {
    let q = render(useViewerQuiz);
    const pending = q.generateQuiz('본문', 'French', { wordsSaved: 2 });
    q = render(useViewerQuiz);
    expect(q.quizState.status).toBe('loading');
    q.closeQuiz();
    q = render(useViewerQuiz);
    expect(q.quizState).toBeNull();
    expect(q.completionModal).toEqual({ wordsSaved: 2 });
    h.gemini.resolve(QUIZ);
    await pending;
    q = render(useViewerQuiz);
    expect(q.quizState).toBeNull();
  });

  it('생성 실패는 로딩 창을 걷고 완료 요약을 띄운다(예전에는 로딩 창이 밑에 남아 갇혔다)', async () => {
    let q = render(useViewerQuiz);
    const pending = q.generateQuiz('본문', 'Chinese', { wordsSaved: 1 });
    h.gemini.reject(new Error('down'));
    await pending;
    q = render(useViewerQuiz);
    expect(q.quizState).toBeNull();
    expect(q.completionModal).toEqual({ wordsSaved: 1 });
  });

  it('다 푼 퀴즈를 닫으면 점수를 지킨다', () => {
    let q = render(useViewerQuiz);
    q.setQuizState({ status: 'done', score: 2, total: 3, pendingCompletion: { wordsSaved: 0 } });
    q = render(useViewerQuiz);
    q.closeQuiz();
    q = render(useViewerQuiz);
    expect(q.quizState).toBeNull();
    expect(q.completionModal).toEqual({ wordsSaved: 0, quizScore: 2, quizTotal: 3 });
  });
});

describe('퀴즈·완료 창 Esc(③)', () => {
  let listeners;
  beforeEach(() => {
    listeners = [];
    vi.stubGlobal('document', {
      activeElement: null, body: {},
      addEventListener: (type, fn) => { if (type === 'keydown') listeners.push(fn); },
      removeEventListener: (type, fn) => { listeners = listeners.filter(x => x !== fn); },
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  const press = key => { const event = { key, preventDefault: vi.fn() }; for (const fn of [...listeners]) fn(event); return event; };

  it('퀴즈 창 Esc = closeQuiz', () => {
    const closeQuiz = vi.fn(), setCompletionModal = vi.fn();
    render(() => ViewerQuizModal({ quizState: { status: 'loading' }, closeQuiz, completionModal: null, setCompletionModal }));
    runEffects();
    expect(press('Enter').preventDefault).not.toHaveBeenCalled();
    expect(closeQuiz).not.toHaveBeenCalled();
    expect(press('Escape').preventDefault).toHaveBeenCalled();
    expect(closeQuiz).toHaveBeenCalledTimes(1);
    expect(setCompletionModal).not.toHaveBeenCalled();
  });

  it('완료 창 Esc = 계속 읽기(닫기)', () => {
    const closeQuiz = vi.fn(), setCompletionModal = vi.fn();
    render(() => ViewerQuizModal({ quizState: null, closeQuiz, completionModal: { streak: 1 }, setCompletionModal }));
    runEffects();
    press('Escape');
    expect(setCompletionModal).toHaveBeenCalledWith(null);
    expect(closeQuiz).not.toHaveBeenCalled();
  });

  it('닫힌 창은 Esc를 가로채지 않는다', () => {
    render(() => ViewerQuizModal({ quizState: null, closeQuiz: vi.fn(), completionModal: null, setCompletionModal: vi.fn() }));
    runEffects();
    expect(listeners).toHaveLength(0);
  });
});

describe('편집 창 버리기 확인(④)', () => {
  it('바뀐 것이 없으면 바로 닫는다', () => {
    const onClose = vi.fn();
    const g = render(() => useDiscardGuard({ dirty: false, onClose }));
    g.requestClose();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(render(() => useDiscardGuard({ dirty: false, onClose })).asking).toBe(false);
  });

  it('바뀐 것이 있으면 닫지 않고 묻는다 — 버리기만 닫고, 계속 수정·두 번째 닫기는 편집으로 돌아간다', () => {
    const onClose = vi.fn();
    let g = render(() => useDiscardGuard({ dirty: true, onClose }));
    g.requestClose();
    g = render(() => useDiscardGuard({ dirty: true, onClose }));
    expect(onClose).not.toHaveBeenCalled();
    expect(g.asking).toBe(true);
    expect(g.confirmProps).toMatchObject({ ...DISCARD_CONFIRM, open: true });
    expect(g.confirmProps.variant).toBe('danger');

    g.requestClose(); // 묻는 중 Esc(네이티브 dialog cancel) — 묻기를 거둔다
    g = render(() => useDiscardGuard({ dirty: true, onClose }));
    expect(g.asking).toBe(false);
    expect(onClose).not.toHaveBeenCalled();

    g.requestClose();
    g = render(() => useDiscardGuard({ dirty: true, onClose }));
    g.confirmProps.onCancel();
    g = render(() => useDiscardGuard({ dirty: true, onClose }));
    expect(g.asking).toBe(false);
    expect(onClose).not.toHaveBeenCalled();

    g.requestClose();
    g = render(() => useDiscardGuard({ dirty: true, onClose }));
    g.confirmProps.onConfirm();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(render(() => useDiscardGuard({ dirty: true, onClose })).asking).toBe(false);
  });

  it('한 번 등록된 키 처리기가 쥔 requestClose도 최신 dirty를 읽는다', () => {
    const onClose = vi.fn();
    const first = render(() => useDiscardGuard({ dirty: false, onClose }));
    const stale = first.requestClose;
    render(() => useDiscardGuard({ dirty: true, onClose }));
    stale();
    expect(onClose).not.toHaveBeenCalled();
    expect(first.isAsking()).toBe(true);
  });

  it('hasUnsavedEdits — 지정 필드만, 빈 값과 undefined는 같다', () => {
    const initial = { id: 1, word_text: '猫', furigana: '', meaning: '고양이', pos: '' };
    expect(hasUnsavedEdits(initial, { ...initial }, ['word_text', 'furigana', 'meaning', 'pos'])).toBe(false);
    expect(hasUnsavedEdits(initial, { ...initial, furigana: undefined }, ['furigana'])).toBe(false);
    expect(hasUnsavedEdits(initial, { ...initial, meaning: '고양이!' }, ['word_text', 'meaning'])).toBe(true);
    expect(hasUnsavedEdits(initial, { ...initial, id: 2 }, ['word_text'])).toBe(false);
    expect(hasUnsavedEdits(null, initial, ['word_text'])).toBe(false);
  });
});

describe('전체 분석 확인(④)', () => {
  it('자료 관리의 전체 분석은 확인 화면만 열고 분석을 시작하지 않는다 — 확인 뒤에만 fullReset', () => {
    const mutate = vi.fn(), onPanelChange = vi.fn();
    const ui = render(() => useReanalyzeUI({ reanalyze: { mutation: { mutate } }, material: { raw_text: '' }, panel: 'menu', onPanelChange }));
    ui.requestFullReanalyze();
    expect(onPanelChange).toHaveBeenLastCalledWith('confirm-full');
    expect(mutate).not.toHaveBeenCalled();
    ui.startFullReanalyze();
    expect(onPanelChange).toHaveBeenLastCalledWith(null);
    expect(mutate).toHaveBeenCalledWith({ fullReset: true });
  });
});
