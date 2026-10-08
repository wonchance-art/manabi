import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { LEVELS, MATERIAL_DIRECTION } from '../../lib/constants';
import { COMPOSER_LANGUAGES, composerRow } from '../../lib/materialComposer';
import { autoSplitParagraphs } from '../../lib/splitParagraphs';

const hooks = vi.hoisted(() => ({ slots: [], cursor: 0, effects: [], mounted: false }));
const mocks = vi.hoisted(() => ({
  params: new Map(), locale: 'ko', toast: vi.fn(), push: vi.fn(), invalidate: vi.fn(),
  insert: vi.fn(), analyze: vi.fn(), user: { id: 'owner' },
}));

vi.mock('react', async importOriginal => ({
  ...await importOriginal(),
  useState(initial) {
    const slot = hooks.cursor++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = typeof initial === 'function' ? initial() : initial;
    return [hooks.slots[slot], value => {
      hooks.slots[slot] = typeof value === 'function' ? value(hooks.slots[slot]) : value;
    }];
  },
  useRef(initial) {
    const slot = hooks.cursor++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = { current: initial };
    return hooks.slots[slot];
  },
  useEffect(effect) { if (!hooks.mounted) hooks.effects.push(effect); },
  useMemo(calculate) { return calculate(); },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }), useSearchParams: () => ({ get: key => mocks.params.get(key) ?? null, has: key => mocks.params.has(key) }),
}));
vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, loading: false }) }));
vi.mock('../../lib/ToastContext', () => ({ useToast: () => mocks.toast }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock('../../lib/useViewerLanguage', () => ({ useViewerLanguage: () => ({ explanationLocale: mocks.locale, uiLocale: 'ko' }) }));
vi.mock('../../lib/analyzeText', () => ({ analyzeText: (...args) => mocks.analyze(...args) }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from(table) {
      if (table !== 'reading_materials') throw Error('Unexpected persistence table');
      const chain = {
        select() { return chain; }, eq() { return chain; }, not() { return chain; }, order() { return chain; },
        limit: async () => ({ data: [], error: null }),
        insert(rows) {
          mocks.insert(structuredClone(rows));
          return { select: async () => ({ data: rows.map((_, index) => ({ id: 'material-' + index })), error: null }) };
        },
      };
      return chain;
    },
  },
}));
vi.mock('../../components/Button', () => ({ default: 'Button' }));
vi.mock('../MaterialAddPdfSection', () => ({ default: 'PdfSection' }));
vi.mock('../../components/MaterialAddEpubSection', () => ({ default: 'EpubSection' }));
vi.mock('../../components/MaterialAddSentenceSection', () => ({ default: 'SentenceSection' }));
vi.mock('../../components/MaterialAddLinkSection', () => ({ default: 'LinkSection' }));
vi.mock('../../components/BookDraftPanel', () => ({ default: 'BookDraftPanel' }));
import MaterialAddPage from '../MaterialAddPage';

// 이벤트를 통한 합성 form 실행. Supabase/분석 호출은 위의 메모리 fixture만 사용한다.
function RenderMaterialAdd() {
  hooks.cursor = 0;
  const form = MaterialAddPage();
  return form.type(form.props);
}
function elements(tree) {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== 'object' || !tree.props) return [];
  return [tree, ...elements(tree.props.children)];
}
function find(predicate) {
  const match = elements(RenderMaterialAdd()).find(predicate);
  if (!match) throw Error('Expected form element not found');
  return match;
}
const button = label => find(node => ['button', 'Button'].includes(node.type) && node.props.children === label);
const fill = text => find(node => node.type === 'textarea').props.onChange({ target: { value: text } });
const selectedLanguage = () => find(node => node.type === 'button' && node.props.className?.includes('toggle-btn--primary') && node.props['aria-pressed'] === true).props.children;

describe('Korean ordinary text reading import', () => {
  let cleanups;
  beforeEach(() => {
    Object.assign(hooks, { slots: [], cursor: 0, effects: [], mounted: false });
    mocks.params.clear(); mocks.locale = 'ko'; mocks.user = { id: 'owner' };
    for (const key of ['toast', 'push', 'invalidate', 'insert', 'analyze']) mocks[key].mockReset();
    mocks.analyze.mockImplementation(async (_text, _signal, options) => ({ ...options.existingJson, status: 'completed' }));
    cleanups = [];
    vi.stubGlobal('React', React);
    vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: vi.fn() });
    vi.stubGlobal('document', { querySelector: () => null });
    vi.stubGlobal('requestAnimationFrame', callback => { callback(); return 1; });
  });
  afterEach(() => {
    for (const cleanup of cleanups) cleanup?.();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  function mount() {
    RenderMaterialAdd();
    hooks.mounted = true;
    cleanups = hooks.effects.map(effect => effect());
  }

  it.each(['ko', 'zh-CN', 'zh-TW'])('stores %s explanation preference and exact Korean source without inventing a level', async locale => {
    mocks.locale = locale;
    mount();
    button('한국어').props.onClick();
    const raw = '  학교에 갔어요!\r\n# 원문 제목\n한글 👨‍👩‍👧\n\t끝.  ';
    expect(autoSplitParagraphs(raw)).not.toBe(raw);
    fill(raw);
    expect(elements(RenderMaterialAdd()).filter(node => node.props.className === 'level-btn' || node.props.className?.startsWith('level-btn '))).toHaveLength(0);
    await button('저장하고 읽기 준비').props.onClick();
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    const saved = mocks.insert.mock.calls[0][0][0];
    expect(saved.raw_text).toBe(raw);
    expect(saved.direction).toBeUndefined();
    expect(saved.processed_json.metadata).toMatchObject({ language: 'Korean', level: '', explanationLocale: locale });
    expect(saved.processed_json.status).toBe('analyzing');
    expect(mocks.analyze).toHaveBeenCalledWith(raw, expect.any(AbortSignal), expect.objectContaining({ metadata: expect.objectContaining({ language: 'Korean', level: '', explanationLocale: locale }) }));
    await vi.waitFor(() => expect(button('지금 바로 읽기')).toBeTruthy());
    await button('지금 바로 읽기').props.onClick();
    expect(mocks.push).toHaveBeenCalledWith('/viewer/material-0');
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });

  it('starts Korean ordinary reading from the discoverable language query', async () => {
    mocks.params.set('language', 'ko'); mocks.locale = 'zh-CN';
    mount();
    expect(selectedLanguage()).toBe('한국어');
    fill('학교에 갔어요.');
    await button('저장하고 읽기 준비').props.onClick();
    expect(mocks.insert.mock.calls[0][0][0].processed_json.metadata).toMatchObject({ language: 'Korean', level: '', explanationLocale: 'zh-CN' });
  });

  it.each(['book', 'pdf', 'epub'])('does not promote language query to Korean for the existing %s source flow', source => {
    mocks.params.set('language', 'ko'); mocks.params.set(source, 'source');
    mount();
    expect(selectedLanguage()).toBe('일본어');
  });

  it('does not enable Korean write targets via language query or invent a target for unknown query', () => {
    mocks.params.set('language', 'ko'); mocks.params.set('direction', MATERIAL_DIRECTION.WRITE);
    mount();
    expect(selectedLanguage()).toBe('일본어');
    expect(elements(RenderMaterialAdd()).some(node => node.type === 'button' && node.props.children === '한국어')).toBe(false);
  });

  it('retains the previous default for unregistered target queries', () => {
    mocks.params.set('language', 'unknown');
    mount();
    expect(selectedLanguage()).toBe('일본어');
  });

  it('keeps Korean absent from write-note targets and never analyzes Korean note text', async () => {
    mocks.params.set('direction', MATERIAL_DIRECTION.WRITE);
    mount();
    expect(elements(RenderMaterialAdd()).some(node => node.type === 'button' && node.props.children === '한국어')).toBe(false);
    const raw = '학교에 갔다고 쓰는 내 메모.';
    fill(raw);
    await button('노트 저장하기').props.onClick();
    const saved = mocks.insert.mock.calls[0][0][0];
    expect(saved).toMatchObject({ direction: MATERIAL_DIRECTION.WRITE, visibility: 'private', raw_text: raw });
    expect(saved.processed_json).toMatchObject({ status: 'note', metadata: { language: 'Japanese', level: 'N3 중급' } });
    expect(saved.processed_json.metadata).not.toHaveProperty('explanationLocale');
    expect(mocks.analyze).not.toHaveBeenCalled();
  });

  it('preserves clipboard CRLF/NFD source through a normalized textarea edit and analysis handoff', async () => {
    mount(); button('한국어').props.onClick();
    const raw = '학교\r\n한글 😀\r\n# 원문';
    const event = {
      clipboardData: { getData: () => raw }, preventDefault: vi.fn(),
      currentTarget: { selectionStart: 0, selectionEnd: 0, setSelectionRange: vi.fn() },
    };
    find(node => node.type === 'textarea').props.onPaste(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.currentTarget.setSelectionRange).toHaveBeenCalledWith(raw.replaceAll('\r\n', '\n').length, raw.replaceAll('\r\n', '\n').length);
    fill(raw.replaceAll('\r\n', '\n') + '!');
    expect(find(node => node.type === 'textarea').props.value).toBe(raw + '!');
    await button('저장하고 읽기 준비').props.onClick();
    expect(mocks.insert.mock.calls[0][0][0].raw_text).toBe(raw + '!');
    expect(mocks.analyze.mock.calls[0][0]).toBe(raw + '!');
  });

  it('maps paste selection from textarea line endings to the exact original UTF-16 span', async () => {
    mount(); button('한국어').props.onClick();
    fill('학교\r\n에😀요\r\n끝');
    const pasted = '한\r\n# 글';
    const event = {
      clipboardData: { getData: () => pasted }, preventDefault: vi.fn(),
      currentTarget: { selectionStart: 3, selectionEnd: 7, setSelectionRange: vi.fn() },
    };
    find(node => node.type === 'textarea').props.onPaste(event);
    const expected = '학교\r\n' + pasted + '\r\n끝';
    expect(find(node => node.type === 'textarea').props.value).toBe(expected);
    fill(expected.replaceAll('\r\n', '\n').replace('# 글', '# 새 글'));
    await button('저장하고 읽기 준비').props.onClick();
    expect(mocks.insert.mock.calls[0][0][0].raw_text).toBe(expected.replace('# 글', '# 새 글'));
  });

  it('switches a Korean reading draft to a legacy write target when selecting my note', async () => {
    mount();
    button('한국어').props.onClick();
    fill('학교에 갔어요.');
    button('내 노트').props.onClick();
    expect(selectedLanguage()).toBe('일본어');
    expect(elements(RenderMaterialAdd()).some(node => node.type === 'button' && node.props.children === '한국어')).toBe(false);
    await button('노트 저장하기').props.onClick();
    expect(mocks.insert.mock.calls[0][0][0].processed_json).toMatchObject({ status: 'note', metadata: { language: 'Japanese' } });
    expect(mocks.analyze).not.toHaveBeenCalled();
  });

  it.each(['Korean', 'ko'])('does not reclassify a write-note quick draft declared %s', async language => {
    mocks.params.set('direction', MATERIAL_DIRECTION.WRITE);
    mocks.params.set('from', 'quick');
    vi.stubGlobal('sessionStorage', { getItem: () => JSON.stringify({ language, text: '내 생각 메모.' }), removeItem: vi.fn() });
    mount();
    expect(selectedLanguage()).toBe('일본어');
    await button('노트 저장하기').props.onClick();
    expect(mocks.insert.mock.calls[0][0][0].processed_json.metadata.language).toBe('Japanese');
    expect(mocks.analyze).not.toHaveBeenCalled();
  });

  it('accepts a declared Korean reading quick draft with an empty level', async () => {
    mocks.params.set('from', 'quick'); mocks.locale = 'zh-TW';
    vi.stubGlobal('sessionStorage', { getItem: () => JSON.stringify({ language: 'Korean', text: '학교에 갔어요.' }), removeItem: vi.fn() });
    mount();
    expect(selectedLanguage()).toBe('한국어');
    await button('저장하고 읽기 준비').props.onClick();
    expect(mocks.insert.mock.calls[0][0][0].processed_json.metadata).toMatchObject({ language: 'Korean', level: '', explanationLocale: 'zh-TW' });
  });

  it('retains legacy target metadata and paragraph behavior under a Chinese explanation setting', async () => {
    mocks.locale = 'zh-CN';
    mount(); button('중국어').props.onClick();
    const raw = '第一行\n# 第二行';
    fill(raw);
    await button('저장하고 읽기 준비').props.onClick();
    const saved = mocks.insert.mock.calls[0][0][0];
    expect(saved.raw_text).toBe(autoSplitParagraphs(raw));
    expect(saved.processed_json.metadata).toMatchObject({ language: 'Chinese', level: 'H3 중급' });
    expect(saved.processed_json.metadata).not.toHaveProperty('explanationLocale');
  });

  // KO-COMPOSER-001(오너 지시 2026-10-08): 자료 작성 언어는 정본 LEARNING_LANGUAGES를 따른다(한국어 포함).
  // 수준(레벨) 4언어 상수는 그대로다 — 한국어 과정/수준을 열지 않는다.
  it('keeps global level gates unchanged; the composer follows the canonical learning languages', () => {
    expect(LEVELS.Korean).toBeUndefined();
    expect(COMPOSER_LANGUAGES).toContain('Korean');
    expect(composerRow('owner', { id: 'draft', language: 'Korean', body: '학교', title: '학교', links: [], files: [] }).processed_json.metadata.language).toBe('Korean');
  });

  it('preserves chapter originals and stores locale without starting a course or eager analysis', async () => {
    mocks.locale = 'zh-TW';
    mount(); button('한국어').props.onClick();
    const first = '한 줄\n　다음 줄 ' + '가'.repeat(6000);
    const second = '마지막 😀 ' + '나'.repeat(6000);
    fill(`# 첫 글\n${first}\n# 둘째 글\n${second}`);
    button('챕터로 나눠 책으로 등록').props.onClick();
    await find(node => node.type === 'BookDraftPanel').props.onRegister();
    const saved = mocks.insert.mock.calls[0][0];
    expect(saved.map(row => row.raw_text)).toEqual([first, second]);
    for (const row of saved) expect(row.processed_json).toMatchObject({ status: 'pending', metadata: { language: 'Korean', level: '', explanationLocale: 'zh-TW' } });
    expect(mocks.analyze).not.toHaveBeenCalled();
  });

  it('does not offer Korean for PDF/EPUB sources or send unsupported Korean PDF to analysis', async () => {
    vi.useFakeTimers();
    mount(); button('한국어').props.onClick();
    find(node => node.type === 'PdfSection').props.onRangeReady({ pdf: { id: 'pdf', title: '읽기' }, pageStart: 1, pageEnd: 1, rawText: '학교에 갔어요.' });
    expect(elements(RenderMaterialAdd()).some(node => node.type === 'button' && node.props.children === '한국어')).toBe(false);
    await button('저장하고 읽기 준비').props.onClick();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.analyze).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith('한국어는 텍스트 읽기 자료로 추가해 주세요.', 'warning');
    vi.runAllTimers();
  });
});
