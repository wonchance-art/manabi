// PINYIN-CELL-RACE-001 — 병음 칸 폭은 본문이 늦게 붙어도 재고, 병음 글꼴 조각이 받아지면 다시 잰다.
// 실측(2026-10-24 KST, e2e viewer-paged-reader 390): 비공개 자료가 계정보다 먼저 오면 「비공개 자료예요」가 잠깐 그려지고 본문은 늦게 붙었다.
// 예전 재기는 본문이 없으면 건너뛰었고 fonts.ready는 이미 끝나 있어, 칸이 기본값 44px(정상 37px)로 굳어 쪽 나뉨이 열 때마다 달랐다.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { watchPinyinCell, PINYIN_MEASURE_SYLLABLES } from '../pinyinLayout';

/** 글꼴이 받아졌는지에 따라 폭이 바뀌는 캔버스 · 이미 끝난 fonts.ready · 나중에 끝나는 fonts.load. */
function fakeDom({ loaded = false } = {}) {
  const state = { loaded, listeners: new Set(), loads: [] };
  let finishLoad;
  const body = { vars: { '--font-noto-sans': "'Noto Sans', 'Noto Sans Fallback'" } };
  const doc = {
    documentElement: { vars: {}, fontSize: '16px' },
    body,
    createElement: () => ({ getContext: () => ({ font: '', measureText(text) { return { width: text.length * (state.loaded ? 5.5 : 7) }; } }) }),
    fonts: {
      ready: Promise.resolve(),
      load(font, text) { state.loads.push({ font, text }); return new Promise(resolve => { finishLoad = () => { state.loaded = true; resolve([]); }; }); },
    },
  };
  const win = {
    getComputedStyle: node => ({ fontSize: node.fontSize || '16px', getPropertyValue: name => node.vars?.[name] ?? '' }),
    addEventListener: (type, fn) => state.listeners.add(fn),
    removeEventListener: (type, fn) => state.listeners.delete(fn),
  };
  return { doc, win, state, finishLoad: () => finishLoad() };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('병음 칸 폭 재기(PINYIN-CELL-RACE-001)', () => {
  it('본문이 아직 없어도 body의 글꼴 변수로 잰다 — 기본값으로 굳지 않는다', async () => {
    const { doc, win, finishLoad } = fakeDom({ loaded: true });
    const cells = [];
    watchPinyinCell({ win, doc, root: () => null, pinyinRem: 0.75, fontRem: 1.6, onCell: cell => cells.push(cell) });
    await flush(); finishLoad(); await flush();
    expect(cells.length).toBeGreaterThan(0);
    // 'chuàng' 6자 × 5.5 = 33 → ceil(max(25.6 + 2, 33 + 4)) = 37 (병음이 넓으면 여유 +4 — #1546 뷰어 점검 결정 1)
    expect(cells.at(-1)).toBe(37);
  });
  it('fonts.ready가 이미 끝났어도 잴 글자의 조각을 직접 받고 받은 뒤 다시 잰다', async () => {
    const { doc, win, state, finishLoad } = fakeDom({ loaded: false });
    const cells = [];
    const stop = watchPinyinCell({ win, doc, root: () => null, pinyinRem: 0.75, fontRem: 1.6, onCell: cell => cells.push(cell) });
    await flush();
    expect(cells.at(-1)).toBe(46); // 대체 글꼴 폭(6 × 7 = 42) + 병음 여유 4
    expect(state.loads).toEqual([{ font: "12px 'Noto Sans', 'Noto Sans Fallback'", text: PINYIN_MEASURE_SYLLABLES.join(' ') }]);
    finishLoad(); await flush();
    expect(cells.at(-1)).toBe(37); // 받은 뒤 실제 글꼴 폭(33) + 병음 여유 4
    stop();
    expect(state.listeners.size).toBe(0);
  });
  it('해제 뒤에 끝난 받기는 칸을 바꾸지 않는다', async () => {
    const { doc, win, finishLoad } = fakeDom({ loaded: false });
    const cells = [];
    const stop = watchPinyinCell({ win, doc, root: () => null, pinyinRem: 0.75, fontRem: 1.6, onCell: cell => cells.push(cell) });
    await flush(); const seen = cells.length; stop();
    finishLoad(); await flush();
    expect(cells.length).toBe(seen);
  });
  it('뷰어는 본문 유무로 재기를 건너뛰지 않는다(옛 !readerRef.current 조기 반환 부활 금지)', () => {
    const viewer = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(viewer).toContain('watchPinyinCell({win:window,doc:document,root:()=>readerRef.current');
    expect(viewer).not.toMatch(/materialLang!=='Chinese'\|\|!readerRef\.current\)return/);
  });
});
