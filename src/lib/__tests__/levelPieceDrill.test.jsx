import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { CharTiles, PieceDrillContext } from '@/components/levels/word/WordParts';
import { PiecePopup } from '@/components/levels/word/WordSheets';
import { WordLangContext } from '@/components/levels/word/wordLang';
import { HSK_WORD_LANG } from '@/views/LevelWordPage';
import { jlptWordLang } from '@/views/JlptWordPage';
import { levelCharTiles, loadLevelCharTables } from '../levelCharTiles.js';

// 단어장 글자 칸 조각 파고들기(오너 2026-10-23 KST 「안1로. 다만 '뜻'과 '음'으로 한 글자씩」) — 역할이 확인된 조각에 「뜻」 · 「음」,
// 더 쪼갤 것이 있는 조각만 「뜻 ›」 · 「음 ›」 단추. 누르면 뷰어 한자 창과 같은 자료의 조각 창(같은 소리 글자 · 그 글자의 구성 · 같은 한자 단어).
const L = HSK_WORD_LANG;
const JLPT_WORD_LANG = jlptWordLang('N5');
const wrap = (node, drill = null, lang = L) => renderToStaticMarkup(
  <WordLangContext.Provider value={lang}><PieceDrillContext.Provider value={drill}>{node}</PieceDrillContext.Provider></WordLangContext.Provider>);

describe('글자 칸 조각 — 역할 · 열 글자', () => {
  it('观察: 見 뜻 › (구성 있음) · 雚 음 › (소리 묶음) · 宀 뜻(더 쪼갤 것 없음 — › 없음) · 祭 음 ›', async () => {
    const tiles = levelCharTiles('观察', await loadLevelCharTables());
    expect(tiles[0].pieces).toEqual([
      { ch: '見', label: '볼 견', role: 'meaning', open: '見' },
      { ch: '雚', label: '황새 관', role: 'sound', open: '雚' },
    ]);
    expect(tiles[1].pieces[0]).toEqual({ ch: '宀', label: '집 면', role: 'meaning' });
    expect(tiles[1].pieces[1]).toMatchObject({ ch: '祭', role: 'sound', open: '祭' });
  }, 60000);

  it('역할 미상 조각은 글자 · 훈음만(역할 말 · 단추 없음)', async () => {
    const [xi] = levelCharTiles('习', await loadLevelCharTables());
    expect(xi.pieces.every((p) => !p.role && !p.open)).toBe(true);
  }, 60000);
});

describe('CharTiles — 파고들기 있을 때만 역할 말 · 단추', () => {
  const tiles = [{ ch: '观', zheng: '觀', label: '볼 관', pieces: [
    { ch: '見', label: '볼 견', role: 'meaning', open: '見' }, { ch: '雚', label: '황새 관', role: 'sound', open: '雚' }] },
  { ch: '察', zheng: null, label: '살필 찰', pieces: [{ ch: '宀', label: '집 면', role: 'meaning' }, { ch: '祭', label: '제사 제', role: 'sound', open: '祭' }] }];

  it('HSK — 「뜻 ›」 「음 ›」 단추, 宀은 「뜻」 글자만', () => {
    const html = wrap(<CharTiles tiles={tiles} />, { onPiece: () => {} });
    expect(html).toContain('aria-label="見 볼 견, 뜻 조각"');
    expect(html).toContain('aria-label="雚 황새 관, 음 조각"');
    expect(html.match(/<button/g)).toHaveLength(3);
    expect(html).toContain('<span class="lw-tile__piece is-meaning"><span class="lw-tile__pch" lang="zh-CN">宀</span><span class="lw-tile__pl">집 면</span><i class="lw-tile__role">뜻</i></span>');
    expect(html).not.toContain('소리');
  });

  it('파고들기 없음(JLPT 판 · 예문 단어 창의 작은 칸) — 지금 모양 그대로', () => {
    for (const html of [wrap(<CharTiles tiles={tiles} />, null, JLPT_WORD_LANG), wrap(<CharTiles tiles={tiles} small />, { onPiece: () => {} })]) {
      expect(html).not.toContain('<button');
      expect(html).not.toContain('lw-tile__role');
    }
    expect(JLPT_WORD_LANG.pieceDrill).toBeUndefined();
    expect(HSK_WORD_LANG.pieceDrill).toBe(true);
  });
});

describe('조각 창', () => {
  const popup = async (req, extra = {}) => wrap(<PiecePopup req={{ ...req, anchor: null, id: 1 }} tables={await loadLevelCharTables()} refIndex={extra.refIndex || null}
    savedRows={extra.savedRows || []} tone onClose={() => {}} />);

  it('음 조각 雚 — 같은 소리 글자 5개 · 이 칸 글자(觀) 칠함 · 요약 한 줄 · 「음 조각」', async () => {
    const html = await popup({ kind: 'sound', ch: '雚', of: '觀' });
    expect(html.match(/class="lw-dp__fc/g)).toHaveLength(5);
    expect(html).toContain('lw-dp__fc is-hit"');
    expect(html).toMatch(/雚이 들면 대개 관/);
    expect(html).toContain('음 조각');
    expect(html).toContain('role="dialog"');
  }, 60000);

  it('뜻 조각 見 — 구성(目 · 儿, 역할 미상) · 같은 한자 단어(내 단어 먼저 → 색인, 한자어 판정 통과분 먼저)', async () => {
    const refIndex = new Map([['看见', { level: 'H1', word: { zh: '看见', pinyin: 'kànjiàn', ko: '보다' } }],
      ['意见', { level: 'H3', word: { zh: '意见', pinyin: 'yìjiàn', ko: '의견' } }], ['见面', { level: 'H2', word: { zh: '见面', pinyin: 'jiànmiàn', ko: '만나다' } }]]);
    const html = await popup({ kind: 'char', ch: '見', of: '觀' }, { refIndex, savedRows: [{ word_text: '见面', meaning: '만나다', language: 'Chinese' }] });
    expect(html).toContain('뜻 조각');
    expect(html).toContain('역할 미상');
    const words = [...html.matchAll(/<span class="lw-dp__tzh"[^>]*>(.*?)<\/span><span class="lw-dp__tpy/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));
    expect(words).toEqual(['意见', '见面', '看见']);
  }, 60000);

  it('표를 받는 중이면 빈 창(aria-busy) · 못 받으면 한 줄', () => {
    expect(wrap(<PiecePopup req={{ kind: 'sound', ch: '雚', anchor: null, id: 1 }} tables="loading" onClose={() => {}} />)).toContain('aria-busy="true"');
    expect(wrap(<PiecePopup req={{ kind: 'sound', ch: '雚', anchor: null, id: 1 }} tables={false} onClose={() => {}} />)).toContain('글자 자료를 불러오지 못했어요');
  });

  it('배선 — 표 네 벌은 화면의 한 곳(askTables)에서만 받고, 같은 조각을 다시 누르면 닫는다 · 시트는 조각 창의 Esc를 가로채지 않는다', () => {
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    const sheets = fs.readFileSync('src/components/levels/word/WordSheets.jsx', 'utf8');
    expect(screen.match(/cfg\.loadTiles\(\)/g)).toHaveLength(1);
    expect(screen).toContain('setPiece((cur) => (cur?.anchor === anchor ? null : { ...req, anchor, id: Date.now() }));');
    expect(screen).toContain('<PieceDrillContext.Provider value={drillCtx}>');
    expect(sheets).toContain("if (document.querySelector('.lw-dp')) return;");
  });
});
