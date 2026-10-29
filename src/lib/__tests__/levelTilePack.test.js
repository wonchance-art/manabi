import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { levelCharTilePack, levelListData } from '../levelListData.js';
import { levelGroupsOf } from '../levelList.js';
import { jaCharTiles, levelCharTiles, levelPackTiles, levelTilePack, loadJaCharTables, loadLevelCharTables } from '../levelCharTiles.js';
import { GET } from '../../app/api/level-tiles/[lang]/[level]/route.js';

// 글자 칸 묶음(오너 10-22 「1번 진행」) — 레벨 단어의 칸을 빌드 때 계산해 싣고, 화면은 묶음 → (없는 단어만) 표 네 벌 순으로 쓴다.
// 묶음에서 되살린 칸 = 표로 계산한 칸(값 손실 0). 다르면 화면 칸이 레벨 단어와 찾기 단어에서 갈린다.
describe('글자 칸 묶음', () => {
  it.each([['chinese', 'H1'], ['chinese', 'H4'], ['japanese', 'N5'], ['japanese', 'N3']])('%s %s — 묶음 칸 = 표로 계산한 칸(모든 단어 · kr 포함)', async (lang, lv) => {
    const ja = lang === 'japanese';
    const tables = await (ja ? loadJaCharTables() : loadLevelCharTables());
    const pack = await levelCharTilePack(lang, lv);
    const entries = levelGroupsOf((await levelListData(lang, 'vocab', lv)).groups).flatMap((g) => g.entries);
    for (const e of entries) {
      const want = ja ? jaCharTiles(e.word, e.kr, tables) : levelCharTiles(e.word, tables);
      expect(levelPackTiles(pack, e.word, e.kr), `${lv} ${e.word}`).toEqual(want);
    }
    expect(pack.t.length).toBeLessThan(entries.length * 2);
  }, 120000);

  it('가나만 단어도 빈 칸으로 싣는다 · 없는 단어는 undefined(표로 계산)', () => {
    const pack = levelTilePack(['ことば', '学生'], (w) => (w === '学生' ? [{ ch: '学', label: '배울 학', pieces: [] }, { ch: '生', label: '날 생', pieces: [] }] : []));
    expect(levelPackTiles(pack, 'ことば')).toEqual([]);
    expect(levelPackTiles(pack, '学生', 'がく,せい')).toEqual([{ ch: '学', label: '배울 학', pieces: [], kana: 'がく' }, { ch: '生', label: '날 생', pieces: [], kana: 'せい' }]);
    expect(levelPackTiles(pack, '学生', 'がくせい')).toEqual([{ ch: '学', label: '배울 학', pieces: [] }, { ch: '生', label: '날 생', pieces: [] }]);
    expect(levelPackTiles(pack, '先生')).toBeUndefined();
  });

  it('정적 응답 — 레벨마다 묶음, 없는 언어 · 레벨은 404', async () => {
    const ok = await GET(new Request('http://x/api/level-tiles/chinese/h1'), { params: Promise.resolve({ lang: 'chinese', level: 'h1' }) });
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.version).toBe(1);
    expect(Object.keys(body.w).length).toBeGreaterThan(250);
    for (const [lang, level] of [['chinese', 'h9'], ['korean', 'h1']]) {
      expect((await GET(new Request('http://x'), { params: Promise.resolve({ lang, level }) })).status).toBe(404);
    }
  }, 60000);

  it('화면은 묶음을 먼저 받고, 묶음에 없는 단어가 그려질 때만 표 네 벌을 받는다', () => {
    const src = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    expect(src).toContain('fetch(`/api/level-tiles/${cfg.lang}/${String(levelKey || \'\').toLowerCase()}`)');
    expect(src).toContain('const packed = tilePack ? levelPackTiles(tilePack, word, kr) : undefined;');
    expect(src.match(/cfg\.loadTiles\(\)/g)).toHaveLength(1);
    expect(src).toContain('queueMicrotask(askTables)');
  });
});
