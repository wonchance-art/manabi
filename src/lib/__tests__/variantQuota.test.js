// CARD-TYPES-001 — 종류 카드 하루 생성 상한(오너 2026-11-01 KST): 학습일마다 하루 새 단어 수만큼, 「제한 없음」이면 Anki처럼 막지 않는다.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { VARIANT_UNKNOWN_CAP, VARIANT_UNLIMITED_LIMIT, variantQuota } from '../fsrsCardKinds';
import { NEW_PER_DAY_UNLIMITED } from '../vocabStudy';

const T = Date.parse('2026-11-01T06:00:00Z'); // 15:00 KST
const card = (kind, introducedAt) => ({ cardId: `${kind}-${introducedAt}`, ...(kind === 'recognition' ? {} : { kind, vocabularyId: 'w' }),
  card: { introducedAt, timeZone: 'Asia/Seoul', rolloverHour: 4 } });

describe('종류 카드 하루 생성 상한', () => {
  it('「제한 없음」(9999)이면 막지 않는다 — vocabStudy 값과 같다', () => {
    expect(VARIANT_UNLIMITED_LIMIT).toBe(NEW_PER_DAY_UNLIMITED);
    expect(variantQuota({ cards: [card('production', '2026-11-01T01:00:00Z')], dailyNewLimit: 9999, at: T })).toBe(Infinity);
  });
  it('하루 새 단어 수에서 오늘(04:00 KST 학습일) 이미 붙인 종류 카드를 뺀다 — 새로 고침으로 넘치지 않는다', () => {
    const cards = [
      card('production', '2026-11-01T00:30:00Z'), // 09:30 KST 오늘
      card('listening', '2026-11-01T05:00:00Z'), // 14:00 KST 오늘
      card('production', '2026-10-31T18:00:00Z'), // 03:00 KST — 어제 학습일
      card('recognition', '2026-11-01T02:00:00Z'), // 단어 → 뜻은 세지 않는다(새 단어 몫이 따로)
    ];
    expect(variantQuota({ cards, dailyNewLimit: 15, at: T })).toBe(13);
    expect(variantQuota({ cards, dailyNewLimit: 2, at: T })).toBe(0);
    expect(variantQuota({ cards, dailyNewLimit: 0, at: T })).toBe(0);
  });
  it('하루 새 단어 수를 모르면 안전 상한', () => {
    expect(variantQuota({ cards: [], dailyNewLimit: null, at: T })).toBe(VARIANT_UNKNOWN_CAP);
  });
  it('두 화면이 같은 상한을 쓴다', () => {
    expect(fs.readFileSync('src/lib/useFsrsReview.js', 'utf8')).toMatch(/variantQuota\(\{ cards: state\.cards, dailyNewLimit: state\.admission\?\.limit \?\? null, at \}\)/);
    expect(fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8')).toMatch(/variantQuota\(\{ cards: variantQuery\.data\?\.cards \|\| \[\], dailyNewLimit: newPerDay/);
  });
});
