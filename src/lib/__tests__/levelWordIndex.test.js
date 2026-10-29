import { describe, expect, it } from 'vitest';
import { indexEntry, pinyinKey, queryKind, searchLevelIndex } from '../levelWordIndex.js';
import { chineseLevelIndex } from '../levelListData.js';

const rows = [
  ['经验', 'jīngyàn', '경험', 4], ['经', 'jīng', '지나다', 3], ['惊', 'jīng', '놀라다', 4], ['北京', 'Běijīng', '베이징', 1],
  ['绿', 'lǜ', '초록색', 3], ['旅游', 'lǚyóu', '여행하다', 2], ['体验', 'tǐyàn', '체험, 경험하다', 5],
];
const entries = rows.map(indexEntry);

describe('찾기 색인 — 전 레벨 사전(HSK 단어 페이지 개편)', () => {
  it('병음 비교 꼴은 성조 기호 · 숫자 · 공백을 빼고 ü · v를 u로 모은다', () => {
    expect(pinyinKey('jīngyàn')).toBe('jingyan');
    expect(pinyinKey('jing1yan4')).toBe('jingyan');
    expect(pinyinKey('jing yan')).toBe('jingyan');
    expect(pinyinKey('lǜ')).toBe(pinyinKey('lv'));
    expect(pinyinKey('lǜ')).toBe(pinyinKey('lu'));
  });

  it('찾는 말 종류 — 한자 · 한글 · 병음', () => {
    expect([queryKind('经'), queryKind('경험'), queryKind('jing'), queryKind('  ')]).toEqual(['han', 'ko', 'py', null]);
  });

  it('정확 → 앞 → 포함, 지금 레벨이 먼저 구역으로 나뉘고 개수가 맞다', () => {
    const r = searchLevelIndex(entries, 'jing', 4);
    expect(r.total).toBe(4);
    expect(r.current.map((e) => e.word)).toEqual(['惊', '经验']); // 정확(jing) → 앞(jingyan)
    expect(r.other.map((e) => e.word)).toEqual(['经', '北京']); // 정확 → 포함
  });

  it('숫자 성조 · ü 흔들림 · 한국어 뜻(쉼표 낱말 정확 일치)', () => {
    expect(searchLevelIndex(entries, 'jing1yan4', 4).current.map((e) => e.word)).toEqual(['经验']);
    expect(searchLevelIndex(entries, 'lv', 3).current.map((e) => e.word)).toEqual(['绿']);
    const ko = searchLevelIndex(entries, '경험', 4);
    expect(ko.current.map((e) => e.word)).toEqual(['经验']);
    expect(ko.other.map((e) => [e.word, e.rank])).toEqual([['体验', 1]]);
  });

  it('없는 말은 빈 결과', () => {
    expect(searchLevelIndex(entries, 'jingg', 4)).toMatchObject({ total: 0, current: [], other: [] });
  });

  it('색인은 HSK 2026 표의 우리 사전 단어 전부, 급수 1–7 · 표제어 중복 없음', async () => {
    const all = await chineseLevelIndex();
    expect(all.length).toBeGreaterThan(10000);
    expect(new Set(all.map((r) => r[0])).size).toBe(all.length);
    expect(all.every((r) => r.length === 4 && Number.isInteger(r[3]) && r[3] >= 1 && r[3] <= 7)).toBe(true);
    expect(all.find((r) => r[0] === '经验')).toEqual(['经验', 'jīngyàn', '경험', 4]);
    const found = searchLevelIndex(all.map(indexEntry), 'jing', 4);
    expect(found.current.length).toBeGreaterThan(0);
    expect(found.total).toBe(found.current.length + found.other.length);
  });
});
