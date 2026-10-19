import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import readings from '../data/jaKanjiReadings.json';
import jeongja from '../data/jaJeongja.json';
import { splitKanjiReadings } from '../jaKanjiReading.js';
import { jaCharTiles, loadJaCharTables } from '../levelCharTiles.js';
import { indexEntry, kanaKey, queryKind, searchLevelIndex } from '../levelWordIndex.js';
import { entriesInRange, rangeOfPos } from '../levelWordStatus.js';
import { japaneseLevelIndex } from '../levelListData.js';
import { JAPANESE_VOCAB_REF } from '../japaneseVocabRegistry';

// 계약: JLPT 단어 페이지(오너 확정 2026-10-19 KST · 문서 「일본어 판에서 달라지는 점」 · 시안 ⑰–㉑).
const read = (f) => fs.readFileSync(f, 'utf8');
const HAN = /\p{Script=Han}/u;

describe('글자 칸 첫 줄 — 단어 속 읽기(経 날 경 けい)', () => {
  const split = (w, r) => splitKanjiReadings(w, r, readings.r);
  it('음독 · 연탁 · 촉음 · 々를 글자마다 나눈다', () => {
    expect(split('経験', 'けいけん')).toEqual(['けい', 'けん']);
    expect(split('学校', 'がっこう')).toEqual(['がっ', 'こう']);
    expect(split('手紙', 'てがみ')).toEqual(['て', 'がみ']);
    expect(split('人々', 'ひとびと')).toEqual(['ひと', 'びと']);
    expect(split('話し合う', 'はなしあう')).toEqual(['はな', '', 'あ', '']);
  });
  it('읽기 표기 흔들림(괄호 する · 끝 する) — 표제어 글자만 나눈다', () => {
    expect(split('結婚', 'けっこん (する)')).toEqual(['けっ', 'こん']);
    expect(split('運動', 'うんどうする')).toEqual(['うん', 'どう']);
  });
  it('숙자훈(今日 きょう) · 가나만 있는 단어(メモ)는 읽기를 붙이지 않는다 — 틀린 읽기 대신 빈칸', () => {
    expect(split('今日', 'きょう')).toBeNull();
    expect(split('メモ', 'メモ')).toBeNull();
  });
  it('단어 콘텐츠의 한자는 모두 읽기 표에 있다(빠진 글자는 _missing에 이름으로)', () => {
    const missing = new Set();
    for (const level of ['N5', 'N4', 'N3', 'N2', 'N1']) {
      for (const theme of JAPANESE_VOCAB_REF.getVocab(level)?.themes || []) {
        for (const w of theme.words || []) for (const c of String(w.ja || '')) if (HAN.test(c) && !readings.r[c]) missing.add(c);
      }
    }
    expect([...missing].filter((c) => !readings._missing.includes(c))).toEqual([]);
  });
});

describe('글자 칸 — 아래 회색은 한국 정자(経 → 經)', () => {
  it('신자체 → 정자 표는 다른 글자만 싣는다', () => {
    expect(jeongja.j['経']).toBe('經');
    expect(jeongja.j['会']).toBe('會');
    expect(Object.entries(jeongja.j).filter(([a, b]) => a === b)).toEqual([]);
  });
  it('훈음 · 조각은 정자 꼴로 찾고, 단어 속 읽기를 싣는다', async () => {
    const tiles = jaCharTiles('経験', 'けい,けん', await loadJaCharTables());
    expect(tiles.map((t) => [t.ch, t.zheng, t.label, t.kana])).toEqual([['経', '經', '날 경', 'けい'], ['験', '驗', '시험할 험', 'けん']]);
    expect(tiles[0].pieces.map((p) => p.ch)).toEqual(['糹', '巠']);
  });
  it('々는 칸을 만들지 않는다 · 가나만 있는 단어는 칸 없음', async () => {
    const tables = await loadJaCharTables();
    expect(jaCharTiles('人々', 'ひと,びと', tables).map((t) => t.ch)).toEqual(['人']);
    expect(jaCharTiles('メモ', undefined, tables)).toEqual([]);
  });
});

describe('찾기 — 가나 · 한자 · 뜻, JLPT N5–N1 전체', () => {
  const rows = [['経験', 'けいけん', '경험', 3], ['計', 'けい', '합계, 셈', 3], ['経済', 'けいざい', '경제', 4], ['ケーキ', 'ケーキ', '케이크', 5],
    ['毛糸', 'けいと', '털실', 2], ['体験', 'たいけん', '체험, 경험', 2]];
  const entries = rows.map((r, i) => indexEntry(r, i, 'ja'));
  const find = (q, level) => searchLevelIndex(entries, q, level, { mode: 'ja', levelRank: (l) => -l });
  it('가나 비교 꼴 — 가타카나는 히라가나로', () => {
    expect(kanaKey('ケーキ')).toBe('けーき');
    expect([queryKind('けい', 'ja'), queryKind('ケイ', 'ja'), queryKind('経', 'ja'), queryKind('경험', 'ja'), queryKind('kei', 'ja')]).toEqual(['kana', 'kana', 'han', 'ko', null]);
  });
  it('지금 레벨 구역이 먼저, 같은 순위면 N5 쪽 먼저(낮은 레벨)', () => {
    const r = find('けい', 3);
    expect(r.current.map((e) => e.word)).toEqual(['計', '経験']); // 정확 → 앞
    expect(r.other.map((e) => e.word)).toEqual(['経済', '毛糸']); // 같은 앞 일치 — N4가 N2보다 먼저
    expect(find('ケーキ', 3).other.map((e) => e.word)).toEqual(['ケーキ']);
    expect(find('경험', 3).current.map((e) => e.word)).toEqual(['経験']);
    expect(find('경험', 3).other.map((e) => e.word)).toEqual(['体験']);
  });
  it('색인은 N5–N1 전 레벨 · 표제어 하나에 한 줄 · [단어, 읽기, 뜻, 레벨(5–1), 글자 읽기?]', async () => {
    const index = await japaneseLevelIndex();
    expect(index.length).toBeGreaterThan(6000);
    expect(new Set(index.map((r) => r[3]))).toEqual(new Set([5, 4, 3, 2, 1]));
    expect(new Set(index.map((r) => r[0])).size).toBe(index.length);
    expect(index.find((r) => r[0] === '経験')).toEqual(['経験', 'けいけん', expect.any(String), 3, 'けい,けん']);
  });
});

describe('범위 — JLPT 묶음은 주제라 품사로 가른다', () => {
  it('품사 → 범위', () => {
    expect(['명사', '대명사', '동사(1)', 'い형용사', 'な형용사', '부사', '표현', ''].map(rangeOfPos))
      .toEqual(['명사', '명사', '동사', '형용사', '형용사', '부사', '기타', '기타']);
  });
  it('단어마다 범위를 본다(묶음 이름이 아니라)', () => {
    const groups = [{ name: '여행', entries: [{ word: '旅行', pos: '명사' }, { word: '行く', pos: '동사(1)' }] }];
    expect(entriesInRange(groups, '동사', (e) => rangeOfPos(e.pos)).map((e) => e.word)).toEqual(['行く']);
    expect(entriesInRange(groups, '전체', (e) => rangeOfPos(e.pos))).toHaveLength(2);
  });
});

describe('화면 — HSK와 같은 공통 화면에 JLPT 판', () => {
  const page = read('src/views/JlptWordPage.jsx');
  it('JLPT 라우트는 공통 화면을 JLPT 판으로 그린다', () => {
    expect(read('src/app/(app)/japanese/vocab/[level]/page.jsx')).toMatch(/levelListRoute\('japanese', 'vocab', JlptWordPage\)/);
    expect(page).toMatch(/<LevelWordScreen cfg=/);
  });
  it('시안 문구 — 태그 N3 · 다시 안내 · 전체 찾기 범위', () => {
    expect(page).toContain("tag: (level) => `N${level}`");
    expect(page).toContain("guide: '뜻이나 읽기 중 하나라도 막혔다면 다시'");
    expect(page).toContain("scope: 'JLPT N5–N1 전체'");
  });
  it('N5 · N4는 가나 표제어(jaHeadMode) — 옛 목록과 같은 규칙', () => {
    expect(page).toMatch(/jaHeadMode\(levelKey\) === 'kana'/);
  });
});

describe('짧은 뜻 — 표제어를 되풀이한 한자 괄호 · 끝 마침표를 뗀다(시안 ⑳)', async () => {
  const { jaPlainMeaning } = await import('../levelListData.js');
  it('표제어 · 정자 꼴 괄호만 뗀다', () => {
    expect(jaPlainMeaning('경의(敬意)', '敬意')).toBe('경의');
    expect(jaPlainMeaning('경영(經營)', '経営')).toBe('경영');
    expect(jaPlainMeaning('형벌, 형(刑).', '刑')).toBe('형벌, 형');
    expect(jaPlainMeaning('경기 (경제 상황)', '景気')).toBe('경기 (경제 상황)');
    expect(jaPlainMeaning('사전(辭典)', '辞書')).toBe('사전(辭典)');
  });
});
