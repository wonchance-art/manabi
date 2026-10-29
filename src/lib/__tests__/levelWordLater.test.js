import { describe, expect, it } from 'vitest';
import { laterDueText } from '../levelWordStatus.js';
import { splitLaterEntries } from '../levelWordSession.js';

// 리스트 맨 아래 접힌 줄 — 「다음에 볼 단어」 한 줄을 「복습 예정」 · 「새 단어」 둘로 나눈다(오너 2026-10-26 KST · 시안 ⑨).
// 한 줄에 새 단어와 이미 본 단어가 섞여 있어 진도가 어디까지인지 안 보였다.
const now = '2026-10-19T03:00:00.000Z'; // 12:00 KST
const DAY = 86400000;
const at = (days) => new Date(Date.parse(now) + days * DAY).toISOString();

describe('splitLaterEntries', () => {
  const entries = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((key) => ({ key }));
  const graded = new Set(['b', 'c', 'd', 'f']);
  const next = { b: at(3), c: at(1), d: null, f: at(1) };
  const split = splitLaterEntries(entries, new Set(['a']), (k) => graded.has(k), (k) => next[k]);

  it('줄에 선 단어는 빼고, 본 단어 = 복습 예정 · 안 본 단어 = 새 단어', () => {
    expect(split.fresh.map((e) => e.key)).toEqual(['e', 'g']);
    expect(split.review.map((r) => r.entry.key)).toEqual(['c', 'f', 'b', 'd']);
  });

  it('복습 예정은 다음 복습이 가까운 순(같으면 목록 순) · 날짜 없는 알아요 단어는 끝', () => {
    expect(split.review.map((r) => r.next)).toEqual([at(1), at(1), at(3), null]);
  });
});

describe('laterDueText', () => {
  it('펼친 카드 「N일 뒤 복습」과 같은 계산 — 1일 뒤 · 3일 뒤, 날짜 없으면 졸업', () => {
    expect(laterDueText(at(1), now)).toBe('1일 뒤');
    expect(laterDueText(at(3), now)).toBe('3일 뒤');
    expect(laterDueText(null, now)).toBe('졸업');
  });

  it('이미 지난 날짜는 오늘', () => {
    expect(laterDueText(at(-2), now)).toBe('오늘');
  });
});

describe('배선 — 리스트 맨 아래는 두 줄(복습 예정 · 새 단어), 한 줄 「다음에 볼 단어」는 없다', () => {
  it('화면이 splitLaterEntries · laterDueText를 쓰고, 찾기로 간 단어는 그 줄만 펼친다', async () => {
    const fs = await import('node:fs');
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    expect(screen).toContain('splitLaterEntries(allEntries, inLine,');
    expect(screen).toContain("[['review', '복습 예정'], ['fresh', '새 단어']]");
    expect(screen).toContain('laterDueText(');
    expect(screen).toContain("for (const part of ['review', 'fresh'])");
    expect(screen).not.toContain('다음에 볼 단어 {');
  });
});
