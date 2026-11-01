import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 계약(THEME-INIT-001, 2026-11-01 KST): 머리 스크립트(app/layout.jsx)와 useTheme이 같은 규칙으로 첫 테마를 정한다 —
// 저장값 dark · light가 정본, 없거나 다른 값이면 OS prefers-color-scheme(light면 light, 그 밖은 dark).
// 예전 머리 스크립트는 저장값이 없으면 늘 dark였고 useTheme은 첫 값 'dark'를 붙였다가 light로 바꿔, OS 라이트 사용자는
// 페이지를 열 때마다 붙기(hydration) 직후 data-theme을 두 번 바꾸며(dark → dark · dark → light) 페이지 전체 스타일을 다시 계산했다
// (로컬 운영 빌드 실측 /discover · /home, 390 · CPU×4). 여기서는 실제 두 코드를 그대로 돌린다 — 머리 스크립트는 layout.jsx의
// 글자에서 잘라 실행하고, useTheme은 React 훅 대역(상태 · effect 순서는 React와 같게: effect는 선언 순, 바뀐 상태면 다시 그림)으로.

const h = vi.hoisted(() => ({ slots: [], index: 0, effects: [], dirty: false }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useState(initial) {
      const i = h.index++;
      if (!(i in h.slots)) h.slots[i] = typeof initial === 'function' ? initial() : initial;
      return [h.slots[i], (value) => {
        const next = typeof value === 'function' ? value(h.slots[i]) : value;
        if (!Object.is(next, h.slots[i])) { h.slots[i] = next; h.dirty = true; }
      }];
    },
    useEffect(fn, deps) {
      const i = h.index++;
      const previous = h.slots[i];
      if (!previous || deps?.some((value, j) => !Object.is(value, previous[j]))) { h.effects.push(fn); h.slots[i] = deps; }
    },
  };
});

const layout = fs.readFileSync(path.join(process.cwd(), 'src/app/layout.jsx'), 'utf8');
const start = layout.indexOf("var t=localStorage.getItem('theme')");
const end = layout.indexOf("document.documentElement.setAttribute('data-theme',t);", start);
const HEAD_SCRIPT = layout.slice(start, end + "document.documentElement.setAttribute('data-theme',t);".length);

function environment({ saved, osLight, storageThrows = false, matchMedia = true }) {
  const attrs = new Map(), writes = [];
  const documentElement = {
    getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
    setAttribute: (k, v) => { writes.push([k, attrs.has(k) ? attrs.get(k) : null, String(v)]); attrs.set(k, String(v)); },
  };
  const localStorage = {
    getItem: (k) => { if (storageThrows) throw new Error('SecurityError'); return k === 'theme' && saved !== undefined ? saved : null; },
    setItem: () => {},
  };
  const window = matchMedia ? { matchMedia: (q) => ({ matches: q === '(prefers-color-scheme: light)' ? osLight : !osLight }) } : {};
  return { document: { documentElement }, localStorage, window, writes };
}

// 붙기 대역: 그리기 → effect(선언 순) → 상태가 바뀌었으면 다시 그리기. 훅은 모듈 멤버로 부른다(이 함수는 컴포넌트가 아니다).
async function mountTheme(env) {
  vi.stubGlobal('document', env.document);
  vi.stubGlobal('localStorage', env.localStorage);
  vi.stubGlobal('window', env.window);
  const themeModule = await import('../useTheme.js');
  for (let pass = 0; pass < 10; pass++) {
    h.index = 0; h.dirty = false;
    themeModule.useTheme();
    h.effects.splice(0).forEach((fn) => fn());
    if (!h.dirty) break;
  }
}

function resetHooks() { h.slots = []; h.index = 0; h.effects = []; h.dirty = false; vi.resetModules(); }

async function loadPage(env) {
  resetHooks();
  // 머리 스크립트 — 던지면(사생활 모드 localStorage) 예전처럼 속성 없이 넘어간다.
  try { new Function('localStorage', 'window', 'document', HEAD_SCRIPT)(env.localStorage, env.window, env.document); } catch { /* 그대로 */ }
  const headWrites = env.writes.length;
  await mountTheme(env);
  return { head: env.writes.slice(0, headWrites), hydration: env.writes.slice(headWrites), final: env.document.documentElement.getAttribute('data-theme') };
}

// 같은 경우에 useTheme만 돌렸을 때(머리 스크립트 없이) 정하는 값 = 훅의 규칙.
async function hookRule(cfg) {
  resetHooks();
  const env = environment(cfg);
  await mountTheme(env);
  return env.document.documentElement.getAttribute('data-theme');
}

beforeEach(() => resetHooks());
afterEach(() => { vi.unstubAllGlobals(); });

const CASES = [];
for (const saved of [undefined, 'dark', 'light', 'sepia', ''])
  for (const osLight of [true, false]) CASES.push({ saved, osLight });
CASES.push({ saved: undefined, osLight: true, matchMedia: false });

describe('머리 스크립트 = useTheme 규칙 — 붙기 뒤 data-theme을 바꾸지 않는다', () => {
  it('머리 스크립트를 layout.jsx에서 찾았다', () => {
    expect(start).toBeGreaterThan(0);
    expect(HEAD_SCRIPT).toContain('prefers-color-scheme: light');
  });

  it.each(CASES)('저장값 %o', async (cfg) => {
    const rule = await hookRule(cfg);
    const page = await loadPage(environment(cfg));
    expect(page.head).toEqual([['data-theme', null, rule]]); // 첫 그림부터 최종 테마
    expect(page.hydration).toEqual([]); // 붙기 뒤 다시 쓰기 0(같은 값 다시 쓰기도 없음)
    expect(page.final).toBe(rule);
  });

  it('규칙 자체 — 저장값이 정본, 없거나 다른 값이면 OS', async () => {
    expect(await hookRule({ saved: 'dark', osLight: true })).toBe('dark');
    expect(await hookRule({ saved: 'light', osLight: false })).toBe('light');
    expect(await hookRule({ saved: undefined, osLight: true })).toBe('light');
    expect(await hookRule({ saved: 'sepia', osLight: false })).toBe('dark');
    expect(await hookRule({ saved: undefined, osLight: true, matchMedia: false })).toBe('dark');
  });

  it('localStorage가 던지면 머리 스크립트는 넘어가고 useTheme이 OS 규칙으로 붙인다(예전 그대로)', async () => {
    const page = await loadPage(environment({ storageThrows: true, osLight: false }));
    expect(page.head).toEqual([]);
    expect(page.final).toBe('dark');
  });
});
