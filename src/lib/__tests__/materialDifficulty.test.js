import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { levelMapFromIndex, levelOrder, materialDifficulty } from '../materialDifficulty';
import { materialContentWords } from '../materialFit';

// MATERIAL-DIFFICULTY-001 계약 — 자료 자체의 난이도 지표(토큰 · 고유 내용어 · 레벨 분포). 새 계산식 없이 정본을 재사용한다.
const json = (tokens) => {
  const sequence = []; const dictionary = {};
  tokens.forEach((t, i) => { sequence.push(`id_0_${i}_1`); dictionary[`id_0_${i}_1`] = t; });
  return { status: 'completed', sequence, dictionary };
};

describe('materialDifficulty', () => {
  const zh = json([
    { text: '我', base_form: '我', pos: '대명사' },
    { text: '喜欢', base_form: '喜欢', pos: '동사' },
    { text: '咖啡', base_form: '咖啡', pos: '명사' },
    { text: '，', base_form: '，', pos: '기호' },
    { text: '我', base_form: '我', pos: '대명사' },
    { text: '的', base_form: '的', pos: '조사' },
    { text: '外滩', base_form: '外滩', pos: '명사' },
    { text: '\n', pos: '개행' },
  ]);
  const levels = levelMapFromIndex([['我', 'wǒ', '나', 1], ['喜欢', 'xǐhuan', '좋아하다', 1], ['咖啡', 'kāfēi', '커피', 2], ['我', 'wǒ', '나', 3]]);

  it('고유 내용어 = 맞춤도 엔진의 정본(materialContentWords)과 같은 분모', () => {
    const d = materialDifficulty(zh, levels, 'Chinese');
    expect(d.types).toBe(materialContentWords(zh).length);
    expect(d.types).toBe(4); // 我 · 喜欢 · 咖啡 · 外滩(的 조사 · 기호 · 개행 제외, 我 한 번)
    expect(d.tokens).toBe(6); // 기호 · 개행만 빼고 인스턴스
  });

  it('레벨 분포 · 표 밖 · 중앙/90번째 — 색인 첫 급수(쉬운 쪽)를 쓴다', () => {
    const d = materialDifficulty(zh, levels, 'Chinese');
    expect(d.byLevel).toEqual({ 1: 2, 2: 1 });
    expect([d.listed, d.unlisted]).toEqual([3, 1]);
    expect(d.listedShare).toBeCloseTo(0.75);
    expect([d.medianLevel, d.p90Level]).toEqual([1, 2]);
  });

  it('일본어는 N5 → N1(숫자 내림차순)이 쉬움 → 어려움', () => {
    const ja = json([{ text: '本', base_form: '本', pos: '명사' }, { text: '経済', base_form: '経済', pos: '명사' }, { text: '学生', base_form: '学生', pos: '명사' }]);
    const d = materialDifficulty(ja, levelMapFromIndex([['本', 'ほん', '책', 5], ['学生', 'がくせい', '학생', 5], ['経済', 'けいざい', '경제', 3]]), 'Japanese');
    expect([d.medianLevel, d.p90Level]).toEqual([5, 3]);
    expect([5, 3, 1].sort(levelOrder('Japanese'))).toEqual([5, 3, 1]);
  });

  it('일본어 가나 표기 — 읽기 키로도 찾고(표제어 우선), 동음이의는 쉬운 급수(N 숫자가 큰 쪽)', () => {
    const rows = [['映画', 'えいが', '영화', 5], ['橋', 'はし', '다리', 3], ['箸', 'はし', '젓가락', 4], ['えいが', 'えいが', '(가상)', 1]];
    const map = levelMapFromIndex(rows, { withReadings: true, easier: (a, b) => a > b });
    expect(map.get('映画')).toBe(5);
    expect(map.get('はし')).toBe(4);
    expect(map.get('えいが')).toBe(1); // 표제어로 이미 있으면 읽기로 덮지 않는다
    expect(levelMapFromIndex(rows).has('はし')).toBe(false); // 기본은 표제어만
  });

  it('레벨 표가 없거나 분석 전이면 분포 없이 0 · null', () => {
    expect(materialDifficulty(zh, null, 'English')).toMatchObject({ types: 4, listed: 0, listedShare: 0, medianLevel: null });
    expect(materialDifficulty({ status: 'idle', sequence: [], dictionary: {} }, levels)).toMatchObject({ tokens: 0, types: 0, listedShare: null });
  });

  it('정본 재사용 — 맞춤도 판정(FIT_BAND · fitBand)을 건드리지 않고 materialContentWords를 import한다', () => {
    const src = fs.readFileSync('src/lib/materialDifficulty.js', 'utf8');
    const code = src.split('\n').filter((line) => !/^\s*(\/\/|\/?\*)/.test(line)).join('\n'); // 주석 줄 제외
    expect(code).toMatch(/import \{ materialContentWords \} from '\.\/materialFit'/);
    expect(code).not.toMatch(/FIT_BAND|fitBand\(|EXCLUDED_POS/);
  });
});
