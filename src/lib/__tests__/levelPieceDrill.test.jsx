import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { CharTiles, PieceDrillContext, tileIndexes } from '@/components/levels/word/WordParts';
import { JaReadingTable, PiecePopup } from '@/components/levels/word/WordSheets';
import { WordLangContext } from '@/components/levels/word/wordLang';
import { HSK_WORD_LANG } from '@/views/LevelWordPage';
import { jlptWordLang } from '@/views/JlptWordPage';
import { levelCharTiles, loadLevelCharTables } from '../levelCharTiles.js';

// 단어장 글자 칸 파고들기 — 조각은 더 파고들지 않고 왼쪽 큰 한자를 누르면 그 글자의 창(구성 · 같은 한자 단어, 지금 단어 제외)
// (오너 2026-10-25 KST · 시안 C 「선만」). 조각의 역할 말(뜻 · 음)과 창 머리의 正 꼴은 뺐다 — 긴 훈음이 … 로 잘리고,
// 정체는 글자 칸에 이미 나와 있어서(오너 2026-10-26 KST). 역할 자료(role)는 남아 있다.
const L = HSK_WORD_LANG;
const JLPT_WORD_LANG = jlptWordLang('N5');
const wrap = (node, drill = null, lang = L) => renderToStaticMarkup(
  <WordLangContext.Provider value={lang}><PieceDrillContext.Provider value={drill}>{node}</PieceDrillContext.Provider></WordLangContext.Provider>);

describe('글자 칸 조각 — 역할', () => {
  it('观察: 見 뜻 · 雚 음 · 宀 뜻 · 祭 음 — 조각에 여는 글자(open)는 없다', async () => {
    const tiles = levelCharTiles('观察', await loadLevelCharTables());
    expect(tiles[0].pieces).toEqual([
      { ch: '見', label: '볼 견', role: 'meaning' },
      { ch: '雚', label: '황새 관', role: 'sound' },
    ]);
    expect(tiles[1].pieces).toEqual([{ ch: '宀', label: '집 면', role: 'meaning' }, { ch: '祭', label: '제사 제', role: 'sound' }]);
  }, 60000);

  it('역할 미상 조각은 글자 · 훈음만', async () => {
    const [xi] = levelCharTiles('习', await loadLevelCharTables());
    expect(xi.pieces.every((p) => !p.role && !('open' in p))).toBe(true);
  }, 60000);
});

describe('CharTiles — 파고들기 판은 큰 한자가 단추, 조각 줄은 글자 · 훈음 두 칸', () => {
  const tiles = [{ ch: '汉', zheng: '漢', label: '한수 한', pieces: [
    { ch: '氵', label: '물 수', role: 'meaning' }, { ch: '又', label: '또 우', role: 'sound' }] },
  { ch: '字', zheng: null, label: '글자 자', pieces: [{ ch: '宀', label: '집 면' }, { ch: '子', label: '아들 자' }] }];

  it('HSK — 글자마다 단추 하나(조각은 단추 아님) · 조각에 역할 말(뜻 · 음)이 없다', () => {
    const html = wrap(<CharTiles tiles={tiles} word="汉字" />, { onPiece: () => {} });
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain('aria-label="汉 한수 한, 이 글자가 든 단어"');
    expect(html).toContain('aria-label="字 글자 자, 이 글자가 든 단어"');
    expect(html).toContain('<span class="lw-tile__piece is-row"><span class="lw-tile__pch" lang="zh-CN">氵</span><span class="lw-tile__pl">물 수</span></span>');
    expect(html).toContain('<span class="lw-tile__piece is-row"><span class="lw-tile__pch" lang="zh-CN">宀</span><span class="lw-tile__pl">집 면</span></span>');
    expect(html).not.toMatch(/>뜻<|>음<|lw-tile__role/);
    expect(html).not.toContain('›');
  });

  it('단어 속 자리 — 칸은 한자만이라 가나 · 기호를 건너뛰고, 같은 글자가 두 번이면 차례로', () => {
    expect(tileIndexes('字·汉', [{ ch: '字' }, { ch: '汉' }])).toEqual([0, 2]);
    expect(tileIndexes('人人', [{ ch: '人' }, { ch: '人' }])).toEqual([0, 1]);
    expect(tileIndexes('勉強する', [{ ch: '勉' }, { ch: '強' }])).toEqual([0, 1]);
    expect(tileIndexes(undefined, [{ ch: '汉' }])).toEqual([null]);
  });

  it('JLPT 판도 큰 한자가 단추(창 = 음 · 훈 읽기 표, 오너 2026-10-25 KST 시안 ⑧)', () => {
    const html = wrap(<CharTiles tiles={tiles} word="汉字" />, { onPiece: () => {} }, JLPT_WORD_LANG);
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(JLPT_WORD_LANG.pieceDrill).toBe(true);
    expect(HSK_WORD_LANG.pieceDrill).toBe(true);
  });

  it('파고들기 없음(파고들기 맥락 없음 · 예문 단어 창의 작은 칸) — 단추 없이', () => {
    for (const html of [wrap(<CharTiles tiles={tiles} word="汉字" />, null, JLPT_WORD_LANG), wrap(<CharTiles tiles={tiles} word="汉字" small />, { onPiece: () => {} })]) {
      expect(html).not.toContain('<button');
      expect(html).not.toContain('lw-tile__role');
    }
  });
});

describe('글자 창', () => {
  const popup = async (req, extra = {}) => wrap(<PiecePopup req={{ kind: 'char', ...req, anchor: null, id: 1 }} tables={await loadLevelCharTables()}
    refIndex={extra.refIndex || null} savedRows={extra.savedRows || []} tone onClose={() => {}} />);
  const wordsOf = (html) => [...html.matchAll(/<span class="lw-dp__tzh"[^>]*>(.*?)<\/span><span class="lw-dp__tpy/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));

  it('汉语의 汉 — 머리(이 단어 속 병음 hàn · 훈음, 正 꼴 없음) · 구성(氵 · 又, 역할 말 없이 · 누르지 않음) · 같은 한자 단어(지금 단어 汉语는 뺀다)', async () => {
    const refIndex = new Map([['汉语', { level: 'H1', word: { zh: '汉语', pinyin: 'hànyǔ', ko: '중국어' } }],
      ['汉字', { level: 'H1', word: { zh: '汉字', pinyin: 'hànzì', ko: '한자' } }]]);
    const html = await popup({ ch: '汉', of: '漢', word: '汉语', index: 0 }, { refIndex });
    expect(html).toContain('aria-label="汉 글자"');
    expect(html).toContain('hàn');
    expect(html).toContain('한수 한');
    expect(html).not.toContain('正');
    expect(html).not.toContain('漢');
    expect(html).toContain('물 수');
    expect(html).not.toMatch(/<i>(뜻|음)<\/i>|역할 미상/);
    expect(html).not.toContain('<button type="button" class="lw-dp__piece');
    expect(wordsOf(html)).toEqual(['汉字']);
  }, 60000);

  it('같은 한자 단어 — 내 단어 먼저 → 색인, 한자어 판정 통과분 먼저(见)', async () => {
    const refIndex = new Map([['看见', { level: 'H1', word: { zh: '看见', pinyin: 'kànjiàn', ko: '보다' } }],
      ['意见', { level: 'H3', word: { zh: '意见', pinyin: 'yìjiàn', ko: '의견' } }], ['见面', { level: 'H2', word: { zh: '见面', pinyin: 'jiànmiàn', ko: '만나다' } }]]);
    const html = await popup({ ch: '见', word: '看见', index: 1 }, { refIndex, savedRows: [{ word_text: '见面', meaning: '만나다', language: 'Chinese' }] });
    expect(wordsOf(html)).toEqual(['意见', '见面']);
  }, 60000);

  it('표를 받는 중이면 빈 창(aria-busy) · 못 받으면 한 줄', () => {
    expect(wrap(<PiecePopup req={{ kind: 'char', ch: '汉', anchor: null, id: 1 }} tables="loading" onClose={() => {}} />)).toContain('aria-busy="true"');
    expect(wrap(<PiecePopup req={{ kind: 'char', ch: '汉', anchor: null, id: 1 }} tables={false} onClose={() => {}} />)).toContain('글자 자료를 불러오지 못했어요');
  });

  it('배선 — 표 네 벌은 화면의 한 곳(askTables)에서만 받고, 같은 글자를 다시 누르면 닫는다 · 시트는 글자 창의 Esc를 가로채지 않는다', () => {
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    const sheets = fs.readFileSync('src/components/levels/word/WordSheets.jsx', 'utf8');
    const parts = fs.readFileSync('src/components/levels/word/WordParts.jsx', 'utf8');
    expect(screen.match(/cfg\.loadTiles\(\)/g)).toHaveLength(1);
    expect(screen).toContain('setPiece((cur) => (cur?.anchor === anchor ? null : { ...req, anchor, id: Date.now() }));');
    expect(screen).toContain('<PieceDrillContext.Provider value={drillCtx}>');
    expect(sheets).toContain("if (document.querySelector('.lw-dp')) return;");
    // 글자 칸을 그리는 곳은 모두 단어를 넘긴다(창이 그 단어의 읽기 · 제외에 쓴다)
    for (const f of ['LevelWordScreen.jsx', 'WordCard.jsx', 'OneWord.jsx']) {
      const src = fs.readFileSync(`src/components/levels/word/${f}`, 'utf8');
      for (const m of src.matchAll(/<CharTiles [^>]*\/>/g)) expect(m[0]).toMatch(/ word=\{/);
    }
    expect(parts).toContain("drill.onPiece({ kind: 'char', ch: t.ch, of: t.zheng || t.ch, word, index: at[i] }, e.currentTarget)");
  });
});

describe('JLPT 글자 창 — 음 · 훈 읽기 표', () => {
  const model = { reading: 'せい', rows: [
    { type: 'on', stem: 'セイ', okuri: '', rare: false, current: true, words: [{ word: '先生', at: 1, runs: [{ t: '先生', r: 'せんせい' }], meaning: '선생님' }] },
    { type: 'on', stem: 'ショウ', okuri: '', rare: false, current: false, words: [] },
    { type: 'kun', stem: 'い', okuri: 'きる', rare: false, current: false, words: [{ word: '生きる', at: 0, runs: [{ t: '生', r: 'い' }, { t: 'きる', r: null }], meaning: '살다' }] },
    { type: 'kun', stem: 'こ', okuri: '', rare: true, current: false, words: [] }] };
  const html = wrap(<JaReadingTable ch="生" model={model} />, null, JLPT_WORD_LANG);
  const rows = [...html.matchAll(/<div class="(lw-rd__row[^"]*)"/g)].map((m) => m[1]);

  it('줄 = 표 순서 · 지금 읽기 장미색 · 음/훈 경계 · 단어 없는 줄 · 내린 읽기', () => {
    expect(rows).toEqual(['lw-rd__row is-current', 'lw-rd__row is-empty', 'lw-rd__row is-kun', 'lw-rd__row is-empty is-rare']);
    expect([...html.matchAll(/<span class="lw-rd__lab" lang="ko">([^<]*)<\/span>/g)].map((m) => m[1])).toEqual(['음', '', '훈', '']);
  });

  it('훈 오쿠리가나는 괄호 · 단어는 후리가나 덩어리 · 누른 글자 강조 · 뜻은 한국어', () => {
    expect(html).toContain('<span class="lw-rd__r">い<i>(きる)</i></span>');
    expect(html).toContain('<span class="lw-rd__k">先<em>生</em><span class="lw-rd__f">せんせい</span></span>');
    expect(html).toContain('<span class="lw-rd__m" lang="ko">살다</span>');
    expect(html).not.toMatch(/상용 외|이 단어뿐|●/);
  });

  it('받는 중이면 빈 표 · 못 받으면 한 줄', () => {
    expect(wrap(<JaReadingTable ch="生" model={null} />, null, JLPT_WORD_LANG)).toContain('lw-rd is-empty');
    expect(wrap(<JaReadingTable ch="生" model={null} failed />, null, JLPT_WORD_LANG)).toContain('읽기 자료를 불러오지 못했어요');
  });
});
