// HANJA-LAZY-001 계약(로그인 점검 F3① ㉣ — 오너 「권장대로」 2026-10-25 KST):
//   ⑴ 뷰어 첫 JS(정적 import 사슬)에 훈음 표 세 벌(hanjaKo · hanjaHun · hanjaTrad.json)이 없다.
//   ⑵ 표는 지연 로드 정본(hanjaTables.js) 하나가 표마다 약속 한 벌로 받는다 — 다른 로더는 그 약속을 그대로 쓴다.
//   ⑶ 판서 카드(TeachingWord)는 표가 오기 전 훈음 줄 자리만 비워 두고(같은 높이 · 같은 글자 자리), 오면 같은 글 · 같은 순서로 그린다.
//   ⑷ 훈음 글자를 캔버스에 저장하는 판서 캔버스만 표를 정적으로(hanjaTablesEager) 채운다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  HANJA_TABLE_NAMES, hanjaTableNamesFor, hanjaTablesNow, hasHanjaTables, loadHanjaTable, loadHanjaTables, preloadHanjaTables,
  resetHanjaTablesForTest, seedHanjaTables, subscribeHanjaTables,
} from '../hanjaTables';
import { loadZhengTable } from '../glyphTables';
import { teachingWordLayout } from '../teachingWordLayout';
import TeachingWord from '../../components/classroom/TeachingWord';

const ROOT = process.cwd();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readData = (f) => JSON.parse(read(`src/lib/data/${f}`));
const LOADED = { koTable: readData('hanjaKo.json'), hunTable: readData('hanjaHun.json'), tradTable: readData('hanjaTrad.json') };
const NONE = { koTable: null, hunTable: null, tradTable: null };
const TABLE_FILES = ['src/lib/data/hanjaKo.json', 'src/lib/data/hanjaHun.json', 'src/lib/data/hanjaTrad.json'];

// ── 정적 import 그래프(첫 JS = 정적 사슬, import() · dynamic() · lazyPanel()은 지연 청크) ─────────────
const STATIC = /(?:^|[\n;])\s*(?:import|export)\s+(?:type\s+)?[^'"`;]*?\sfrom\s*['"]([^'"]+)['"]|(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g;
const EXT = ['', '.js', '.jsx', '.mjs', '.ts', '.tsx', '/index.js', '/index.jsx'];
function resolve(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(ROOT, 'src', spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null; // 패키지 — 우리 표를 부르지 않는다
  for (const ext of EXT) { const p = base + ext; if (fs.existsSync(p) && fs.statSync(p).isFile()) return p; }
  throw new Error(`unresolved import ${spec} from ${path.relative(ROOT, from)}`);
}
function staticGraph(entry) {
  const seen = new Set();
  const stack = [path.join(ROOT, entry)];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.(m?jsx?|tsx?)$/.test(file)) continue; // json · css는 잎
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(STATIC)) {
      const next = resolve(file, m[1] || m[2]);
      if (next) stack.push(next);
    }
  }
  return new Set([...seen].map((f) => path.relative(ROOT, f)));
}

describe('⑴ 뷰어 첫 JS에 훈음 표가 없다', () => {
  const graph = staticGraph('src/app/(app)/viewer/[id]/page.jsx');
  it('그래프가 실제 사슬을 따라간다(판서 카드 · 레이아웃 · 정본 로더까지 닿는다)', () => {
    for (const f of ['src/views/ViewerPage.jsx', 'src/components/classroom/TeachingWord.jsx', 'src/lib/teachingWordLayout.js', 'src/lib/hanjaTables.js', 'src/lib/glyphTables.js'])
      expect(graph.has(f), f).toBe(true);
  });
  it('세 표와 정적 채움 모듈(hanjaTablesEager)은 그래프 밖', () => {
    for (const f of [...TABLE_FILES, 'src/lib/hanjaTablesEager.js']) expect(graph.has(f), f).toBe(false);
  });
  it('대조: 판서 캔버스(지연 청크)는 표를 정적으로 채운다 — 훈음 글자를 저장하므로', () => {
    const canvas = staticGraph('src/components/classroom/TeachingBoardCanvas.jsx');
    for (const f of [...TABLE_FILES, 'src/lib/hanjaTablesEager.js']) expect(canvas.has(f), f).toBe(true);
    expect(read('src/components/classroom/TeachingBoard.jsx')).toContain("dynamic(() => import('./TeachingBoardCanvas')");
  });
  it('세 표를 정적으로 부르는 곳은 hanjaTablesEager 하나(테스트 밖 소스 전수)', () => {
    const offenders = [];
    const walk = (dir) => {
      for (const ent of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${ent.name}`;
        if (ent.isDirectory()) { if (ent.name !== '__tests__' && ent.name !== 'node_modules') walk(rel); continue; }
        if (!/\.(m?jsx?|tsx?)$/.test(ent.name)) continue;
        const src = read(rel);
        for (const m of src.matchAll(STATIC)) if (/hanja(Ko|Hun|Trad)\.json$/.test(m[1] || m[2] || '')) offenders.push(rel);
      }
    };
    walk('src');
    expect(offenders).toEqual(['src/lib/hanjaTablesEager.js', 'src/lib/hanjaTablesEager.js', 'src/lib/hanjaTablesEager.js']);
  });
  it('세 표의 import()는 정본 로더에만 있다(다른 로더 · 화면은 loadHanjaTable을 거친다)', () => {
    const owners = [];
    const walk = (dir) => {
      for (const ent of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${ent.name}`;
        if (ent.isDirectory()) { if (ent.name !== '__tests__') walk(rel); continue; }
        if (/\.(m?jsx?|tsx?)$/.test(ent.name) && /import\(\s*['"][^'"]*hanja(Ko|Hun|Trad)\.json['"]\s*\)/.test(read(rel))) owners.push(rel);
      }
    };
    walk('src');
    expect(owners).toEqual(['src/lib/hanjaTables.js']);
  });
});

describe('⑵ 정본 로더 — 표마다 약속 한 벌', () => {
  afterEach(() => resetHanjaTablesForTest());
  it('같은 표는 같은 약속 · 같은 객체, 정체 표는 자형 열 로더와 공유', async () => {
    resetHanjaTablesForTest();
    const a = loadHanjaTable('ko');
    expect(loadHanjaTable('ko')).toBe(a);
    expect(loadZhengTable()).toBe(loadHanjaTable('trad'));
    const [ko, trad] = await Promise.all([a, loadZhengTable()]);
    expect(ko).toEqual(LOADED.koTable);
    expect(trad.amb).toEqual(LOADED.tradTable.amb);
    expect(hanjaTablesNow().koTable).toBe(ko);
    expect(hanjaTablesNow().hunTable).toBeNull(); // 부르지 않은 표는 받지 않는다
  });
  it('스냅숏은 표가 들어올 때만 바뀌고 구독자에게 알린다', async () => {
    resetHanjaTablesForTest();
    const before = hanjaTablesNow();
    expect(before).toEqual(NONE);
    let calls = 0;
    const off = subscribeHanjaTables(() => { calls++; });
    const tables = await loadHanjaTables(hanjaTableNamesFor('Japanese'));
    expect(calls).toBe(2);
    expect(tables).toBe(hanjaTablesNow());
    expect(hasHanjaTables(['ko', 'hun'])).toBe(true);
    expect(hasHanjaTables(HANJA_TABLE_NAMES)).toBe(false);
    await loadHanjaTables(['ko', 'hun']);
    expect(calls).toBe(2); // 다시 불러도 요청 · 알림 없음
    off();
    await loadHanjaTable('trad');
    expect(calls).toBe(2);
  });
  it('언어별 필요한 표 — 중국어 셋(정체 꼴 조회), 일본어 음 · 훈, 그 밖 없음', () => {
    expect(hanjaTableNamesFor('Chinese')).toEqual(['ko', 'hun', 'trad']);
    expect(hanjaTableNamesFor('Japanese')).toEqual(['ko', 'hun']);
    expect(hanjaTableNamesFor('English')).toEqual([]);
    return expect(loadHanjaTable('nope')).rejects.toThrow();
  });
  it('정적 채움(seed)은 같은 캐시 — 뒤이은 loadHanjaTable이 그 표를 바로 돌려준다', async () => {
    resetHanjaTablesForTest();
    seedHanjaTables(LOADED);
    expect(hanjaTablesNow().koTable).toBe(LOADED.koTable);
    expect(await loadHanjaTable('hun')).toBe(LOADED.hunTable);
  });
});

describe('유휴 미리 받기(preloadHanjaTables)', () => {
  afterEach(() => resetHanjaTablesForTest());
  it('유휴 예약(timeout 2000)으로 받고, 취소하면 받지 않는다 · 필요한 표가 없으면 예약도 없다', async () => {
    resetHanjaTablesForTest();
    const idle = vi.fn(() => 7), cancelIdle = vi.fn();
    const cancel = preloadHanjaTables(['ko'], { scheduler: { idle, cancelIdle } });
    expect(idle).toHaveBeenCalledWith(expect.any(Function), { timeout: 2000 });
    cancel();
    expect(cancelIdle).toHaveBeenCalledWith(7);
    idle.mock.calls[0][0](); // 취소 뒤 늦게 불려도 받지 않는다
    await Promise.resolve();
    expect(hanjaTablesNow().koTable).toBeNull();
    let run = null;
    preloadHanjaTables(hanjaTableNamesFor('Japanese'), { scheduler: { idle: (fn) => { run = fn; return 1; } } });
    run();
    await vi.waitFor(() => expect(hasHanjaTables(['ko', 'hun'])).toBe(true));
    const none = vi.fn();
    preloadHanjaTables(hanjaTableNamesFor('English'), { scheduler: { idle: none } });
    expect(none).not.toHaveBeenCalled();
  });
});

describe('⑶ 판서 카드 — 기다리는 동안 훈음 자리만 비우고, 오면 같은 자리에 같은 글', () => {
  const geometry = (layout) => ({ height: layout.height, text: layout.parts.filter((p) => p.role !== 'hun').map(({ role, text, x, y }) => ({ role, text, x, y })) });
  const SAMPLES = [
    [{ text: '学习', reading: 'xué xí', meaning: '배우다, 공부하다', language: 'Chinese' }, {}],
    [{ text: '图书馆', reading: 'tú shū guǎn', meaning: '도서관', language: 'Chinese' }, { maxWidth: 320, fontSize: 40 }],
    [{ text: '技术', reading: 'jì shù', meaning: '기술', language: 'Chinese' }, {}],
    [{ text: '学習', reading: 'がくしゅう', meaning: '학습', language: 'Japanese' }, {}],
    [{ text: '食べる', reading: 'たべる', meaning: '먹다', language: 'Japanese' }, { maxWidth: 320, fontSize: 40 }],
  ];
  it.each(SAMPLES)('%o — 높이 · 병음/후리가나 · 글자 · 뜻 자리가 표 전후 같다', (value, opts) => {
    const pending = teachingWordLayout(value, { ...opts, tables: NONE });
    const loaded = teachingWordLayout(value, { ...opts, tables: LOADED });
    expect(pending.hunPending).toBe(true);
    expect(loaded.hunPending).toBe(false);
    expect(pending.parts.some((p) => p.role === 'hun')).toBe(false);
    expect(loaded.parts.some((p) => p.role === 'hun')).toBe(true);
    expect(geometry(pending)).toEqual(geometry(loaded));
  });
  it('받은 뒤의 훈음은 정적 표 시절과 같은 글 · 같은 순서(정체 꼴 조회 포함)', () => {
    const hun = (value) => teachingWordLayout(value, { tables: LOADED }).parts.filter((p) => p.role === 'hun').map((p) => p.text);
    expect(hun({ text: '学习', reading: 'xué xí', meaning: '', language: 'Chinese' }).join(' ')).toBe('배울 학 익힐 습');
    expect(hun({ text: '技术', reading: 'jì shù', meaning: '', language: 'Chinese' }).join(' ')).toContain('재주 술');
    expect(hun({ text: '台', reading: 'たい', meaning: '', language: 'Japanese' })).toEqual(['별 태']);
  });
  it('표가 필요 없는 말(영어 · 가나뿐)은 기다리지도 자리를 잡지도 않는다', () => {
    expect(teachingWordLayout({ text: 'table', meaning: '탁자', language: 'English' }, { tables: NONE }).hunPending).toBe(false);
    const kana = { text: 'いかが', reading: '', meaning: '어떠세요', language: 'Japanese' };
    expect(teachingWordLayout(kana, { tables: NONE }).height).toBe(teachingWordLayout(kana, { tables: LOADED }).height);
  });
  it('첫 그림(서버 · 하이드레이션)은 자리 표시 — 같은 높이의 SVG, 훈음 글 없음, aria-busy', () => {
    resetHanjaTablesForTest();
    const entry = { text: '学习', reading: 'xué xí', meaning: '배우다, 공부하다' };
    const html = renderToStaticMarkup(createElement(TeachingWord, { entry, language: 'Chinese', display: {} }));
    expect(html).toContain('data-hun-pending="true"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('teaching-word-part--hun');
    const loaded = teachingWordLayout({ ...entry, language: 'Chinese' }, { fontSize: 40, maxWidth: 320, tables: LOADED });
    expect(html).toContain(`height="${loaded.height}"`);
  });
  it('TeachingWord는 구독한 표를 레이아웃에 넘기고 표가 바뀌면 다시 잰다', () => {
    const src = read('src/components/classroom/TeachingWord.jsx');
    expect(src).toContain('const {tables}=useHanjaTables(language);');
    expect(src).toMatch(/maxWidth:width,tables\}\),\[entry,language,display,width,presentation,tables\]\)/);
    const hook = read('src/lib/useHanjaTables.js');
    expect(hook).toContain('useSyncExternalStore(subscribeHanjaTables, hanjaTablesNow, serverSnapshot)');
    expect(hook).toMatch(/if \(!want\) return;\s*loadHanjaTables\(hanjaTableNamesFor\(language\)\)/);
  });
});

describe('뷰어 배선 — 유휴 시간 미리 받기 + 필요한 상호작용에서 바로', () => {
  const viewer = read('src/views/ViewerPage.jsx');
  it('중국어 · 일본어 자료는 첫 그림 뒤 유휴 시간에 그 언어의 표를 받는다(수업 입력판 · 뷰어 수업 모드도)', () => {
    // 자료가 오기 전 기본 언어(일본어)로 예약하지 않는다 — 본문이 그려진 뒤 · 그 자료의 언어로만.
    expect(viewer).toContain("const materialLang = material?.processed_json?.metadata?.language || 'Japanese';");
    expect(viewer).toContain('const hanjaPreloadLang = material ? materialLang : null;');
    expect(viewer).toContain('useEffect(() => preloadHanjaTables(hanjaTableNamesFor(hanjaPreloadLang)), [hanjaPreloadLang]);');
    expect(hanjaTableNamesFor(null)).toEqual([]);
    expect(read('src/components/classroom/ClassroomReader.jsx')).toContain('useEffect(()=>preloadHanjaTables(hanjaTableNamesFor(team.lang)),[team.lang]);');
  });
  it('토글 · 글자 탭 · 단어창 조건의 즉시/유휴 로드도 같은 정본을 쓴다', () => {
    expect(viewer).not.toMatch(/import\(['"][^'"]*hanja(Ko|Hun|Trad)\.json/);
    expect(viewer.match(/loadHanjaTable\('ko'\)/g)).toHaveLength(2);
    expect(viewer.match(/loadHanjaTable\('hun'\)/g)).toHaveLength(2);
    expect(viewer).toContain("loadHanjaTable('trad')");
  });
});
