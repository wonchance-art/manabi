import { describe, expect, it } from 'vitest';
import { STAMP_MILESTONE_REWARDS } from '../stampMilestones.js';
import { WORLD_TITLE_COPY, worldTitleCopyForKey } from '../worldTitleCopy.js';

describe('스탬프 칭호 카피 정본', () => {
  it('마일스톤 titleKey 4개와 카피 키가 exact 일치한다', () => {
    expect(Object.keys(WORLD_TITLE_COPY).sort())
      .toEqual(STAMP_MILESTONE_REWARDS.map((r) => r.titleKey).sort());
  });

  it('규격 — name 4~12자, line 12~50자 해요체', () => {
    for (const [key, copy] of Object.entries(WORLD_TITLE_COPY)) {
      expect(copy.name.length, key).toBeGreaterThanOrEqual(4);
      expect(copy.name.length, key).toBeLessThanOrEqual(12);
      expect(copy.line.length, key).toBeGreaterThanOrEqual(12);
      expect(copy.line.length, key).toBeLessThanOrEqual(50);
      expect(copy.line, key).toMatch(/요\.$/);
    }
  });

  it('부재 키는 null', () => {
    expect(worldTitleCopyForKey('no-such')).toBeNull();
    expect(worldTitleCopyForKey('stamp-10')?.name).toBe('첫 발자국 수집가');
  });
});
