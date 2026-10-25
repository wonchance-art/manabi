import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import joyoFile from '../data/jaJoyo.json';
import onkunFile from '../data/jaKanjiOnKun.json';
import { furiganaRuns, jaKanjiReadingRows, kanaPerChar, parseKanjiReadings, readingRowOf, sameReading } from '../jaKanjiReadingRows.js';

// JLPT 글자 창의 음 · 훈 표(오너 2026-10-25 KST 「상용한자 교재에서 나오는 모양」 · 시안 ⑧).
// 자료 = 常用漢字表 원문(2,136자 · 4,388음훈 · 한 자 내린 읽기 178) + 상용 밖 콘텐츠 한자(KANJIDIC2, 파일 분리 — CC BY-SA).
const joyo = joyoFile.r;
const onkun = onkunFile.r;
const tables = { joyo, onkun };
const ref = (rows) => new Map(rows.map(([word, kr, meaning, level = 5]) => [word, { kr, meaning, level }]));
const show = (model) => model.rows.map((r) => `${r.current ? '●' : ''}${r.stem}${r.okuri ? `(${r.okuri})` : ''}${r.rare ? '*' : ''}:${r.words.map((w) => w.word).join('/')}`);

describe('常用漢字表 자료', () => {
  const OFFICIAL = { '𠮟': '叱', '塡': '填', '剝': '剥', '頰': '頬' };
  const officialKeys = Object.keys(joyo).filter((k) => !Object.values(OFFICIAL).includes(k));

  it('2,136자 · 4,388음훈 · 한 자 내린 읽기 178 — 표의 꼴(𠮟 · 塡 · 剝 · 頰)은 흔한 꼴로도 같은 값', () => {
    expect(officialKeys).toHaveLength(2136);
    const all = officialKeys.flatMap((k) => parseKanjiReadings(joyo[k]));
    expect(all).toHaveLength(4388);
    expect(all.filter((r) => r.rare)).toHaveLength(178);
    for (const [official, common] of Object.entries(OFFICIAL)) expect(joyo[common]).toBe(joyo[official]);
  });

  it('표 순서 · 음 가타카나 · 훈 오쿠리가나 — 生 12 · 経 3 · 学 2, 예가 활용형뿐인 干 ひ.る', () => {
    expect(joyo['生']).toBe('セイ,ショウ,い.きる,い.かす,い.ける,う.まれる,う.む,お.う,は.える,は.やす,き,なま');
    expect(joyo['経']).toBe('ケイ,キョウ,へ.る');
    expect(joyo['学']).toBe('ガク,まな.ぶ');
    expect(joyo['干']).toBe('カン,ほ.す,ひ.る');
    expect(joyo['淫']).toContain('みだ.ら');
    expect(joyo['茨']).toBe('*いばら'); // 한 자 내림
  });

  it('상용 밖 콘텐츠 한자는 KANJIDIC2 파일에만 — 상용 글자와 겹치지 않고, 출처는 파일마다', () => {
    expect(onkun['醤']).toBe('ショウ,ひしお');
    expect(Object.keys(onkun).filter((k) => joyo[k])).toEqual([]);
    expect(joyoFile._source).toContain('常用漢字表');
    expect(onkunFile._source).toContain('CC BY-SA 4.0');
    expect(fs.readFileSync('src/lib/data/README.md', 'utf8')).toContain('jaKanjiOnKun.json');
  });
});

describe('읽기 맞추기', () => {
  const sei = parseKanjiReadings(joyo['生']);
  const row = (k, after) => { const i = readingRowOf(sei, k, after); return i < 0 ? null : `${sei[i].stem}${sei[i].okuri}`; };

  it('촉음 · 연탁도 같은 읽기(がっ ↔ ガク · ばな ↔ はな · び ↔ ひ)', () => {
    expect(sameReading('がっ', 'がく')).toBe(true);
    expect(sameReading('ばな', 'はな')).toBe(true);
    expect(sameReading('ぱい', 'はい')).toBe(true);
    expect(sameReading('び', 'ひ')).toBe(true);
    expect(sameReading('がく', 'かく')).toBe(true);
    expect(sameReading('せい', 'しょう')).toBe(false);
  });

  it('줄기가 같은 훈은 뒤 오쿠리가나로 가른다 — 生きる · 生き物 → いきる, 生け花 → いける, 生まれ → うまれる', () => {
    expect(row('い', 'きる')).toBe('いきる');
    expect(row('い', 'き')).toBe('いきる');
    expect(row('い', 'け')).toBe('いける');
    expect(row('い', 'かす')).toBe('いかす');
    expect(row('う', 'まれ')).toBe('うまれる');
    expect(row('なま', '')).toBe('なま');
    expect(row('せい', '')).toBe('セイ');
  });

  it('후리가나 덩어리 — 이어진 한자는 한 덩어리, 가나는 덩어리 밖', () => {
    expect(furiganaRuns('生き物', kanaPerChar('生き物', 'い,,もの'))).toEqual([{ t: '生', r: 'い' }, { t: 'き', r: null }, { t: '物', r: 'もの' }]);
    expect(furiganaRuns('一生懸命', kanaPerChar('一生懸命', 'いっ,しょう,けん,めい'))).toEqual([{ t: '一生懸命', r: 'いっしょうけんめい' }]);
    expect(kanaPerChar('学生', 'がく')).toBeNull();
  });
});

describe('읽기 표', () => {
  const refIndex = ref([
    ['先生', 'せん,せい', '선생님'], ['学生', 'がく,せい', '학생'], ['生徒', 'せい,と', '학생, 생도'], ['留学生', 'りゅう,がく,せい', '유학생', 4],
    ['一生懸命', 'いっ,しょう,けん,めい', '열심히, 힘껏', 4], ['生きる', 'い,,', '살다', 4], ['生き物', 'い,,もの', '생물, 생명체', 3],
    ['生け花', 'い,,ばな', '꽃꽂이', 2], ['生まれる', 'う,,,', '태어나다'], ['生ビール', 'なま,,,', '생맥주 — 이자카야 첫 주문', 5],
    ['学校', 'がっ,こう', '학교'], ['大学', 'だい,がく', '대학교'], ['学ぶ', 'まな,', '배우다', 3],
  ]);

  it('学生의 生 — 표 순서 그대로 12줄, 지금 단어의 읽기 セイ에 current, 지금 단어는 빠진다, 단어 없는 읽기도 빈 줄', () => {
    const model = jaKanjiReadingRows({ ch: '生', word: '学生', index: 1, kr: 'がく,せい', refIndex, tables });
    expect(model.reading).toBe('せい');
    expect(show(model)).toEqual(['●セイ:先生/生徒', 'ショウ:一生懸命', 'い(きる):生きる/生き物', 'い(かす):', 'い(ける):生け花', 'う(まれる):生まれる',
      'う(む):', 'お(う):', 'は(える):', 'は(やす):', 'き:', 'なま:生ビール']);
    expect(model.rows.find((r) => r.stem === 'なま').words[0].meaning).toBe('생맥주');
  });

  it('내 단어가 먼저 — 그다음 색인(N5 먼저)', () => {
    const model = jaKanjiReadingRows({ ch: '生', word: '学生', index: 1, kr: 'がく,せい', refIndex, tables,
      savedRows: [{ word_text: '留学生', language: 'Japanese' }, { word_text: '学生', language: 'Chinese' }] });
    expect(model.rows[0].words.map((w) => w.word)).toEqual(['留学生', '先生']);
  });

  it('学校의 学 — 촉음 がっ도 ガク 줄에 current', () => {
    const model = jaKanjiReadingRows({ ch: '学', word: '学校', index: 0, kr: 'がっ,こう', refIndex, tables });
    expect(show(model)).toEqual(['●ガク:学生/大学', 'まな(ぶ):学ぶ']);
  });

  it('상용 밖 醤은 KANJIDIC2로 같은 모양, 쓰이는 줄만(ひしお 빠짐) · 자료가 없는 글자는 null', () => {
    expect(show(jaKanjiReadingRows({ ch: '醤', word: '醤油', index: 0, kr: 'しょう,ゆ', refIndex, tables }))).toEqual(['●ショウ:']);
    expect(show(jaKanjiReadingRows({ ch: '醤', tables }))).toEqual(['ショウ:', 'ひしお:']);
    expect(jaKanjiReadingRows({ ch: 'あ', tables })).toBeNull();
  });

  it('한 자 내린 읽기는 그 갈래 끝으로(흐리게)', () => {
    const model = jaKanjiReadingRows({ ch: '建', tables });
    expect(show(model)).toEqual(['ケン:', 'コン*:', 'た(てる):', 'た(つ):']);
  });
});
