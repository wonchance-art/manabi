import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

// 실제 페이지의 키 리스너를 실행해 종료 화면의 undo 도달성을 검사한다.
// 저장/계정 경계는 기존 undo 검사와 같은 핸들러가 담당한다.
const page = readFileSync(new URL('../VocabPage.jsx', import.meta.url), 'utf8');
const start = page.indexOf('  useEffect(() => {', page.indexOf('const reviewKeysRef = useRef({});'));
const effectSource = page.slice(start, page.indexOf('  const [manualDraft,', start));
const runEffect = new Function('useEffect', 'document', 'tab', 'reviewFinished', 'manualAddOpen', 'reviewKeysRef', effectSource);

function mount({ tab = 'review', finished = true, dialog = false, canUndo = true } = {}) {
  let listener;
  const cleanups = [];
  const handlers = { canUndo, undo: vi.fn(), row: 'score', score: vi.fn() };
  const document = {
    addEventListener: vi.fn((_event, callback) => { listener = callback; }),
    removeEventListener: vi.fn(),
  };
  runEffect(callback => { const cleanup = callback(); if (cleanup) cleanups.push(cleanup); }, document, tab, finished, dialog, { current: handlers });
  const key = (overrides = {}) => ({ key: 'z', metaKey: true, ctrlKey: false, altKey: false,
    target: { tagName: 'BODY' }, preventDefault: vi.fn(), ...overrides });
  return { handlers, document, key, fire: event => listener?.(event), cleanup: () => cleanups.forEach(fn => fn()) };
}

describe('last legacy grade undo keyboard reachability', () => {
  it.each(['metaKey', 'ctrlKey'])('reaches the existing undo handler after review completion with %s', modifier => {
    const session = mount();
    const event = session.key({ metaKey: false, [modifier]: true });
    session.fire(event);
    expect(session.handlers.undo).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    session.fire(session.key({ key: '3', metaKey: false }));
    expect(session.handlers.score).not.toHaveBeenCalled();
    session.cleanup();
    expect(session.document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it.each([{ tab: 'list' }, { dialog: true }])('does not bind outside the review or over a manual dialog: %j', options => {
    const session = mount(options);
    session.fire(session.key());
    expect(session.document.addEventListener).not.toHaveBeenCalled();
    expect(session.handlers.undo).not.toHaveBeenCalled();
  });

  it.each(['INPUT', 'TEXTAREA'])('preserves %s editing undo', tagName => {
    const session = mount();
    const event = session.key({ target: { tagName } });
    session.fire(event);
    expect(session.handlers.undo).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('does not consume undo without a confirmed snapshot', () => {
    const session = mount({ canUndo: false });
    const event = session.key();
    session.fire(event);
    expect(session.handlers.undo).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('keeps ordinary score keys working during the active review', () => {
    const session = mount({ finished: false });
    session.fire(session.key({ key: '3', metaKey: false }));
    expect(session.handlers.score).toHaveBeenCalledWith(3);
  });
});
