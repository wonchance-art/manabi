import { describe, expect, it } from 'vitest';
import { STAMP_ALBUM_NODES } from '../../../lib/world/stampUniverse.js';
import { WORLD_TITLES_STORAGE_KEY } from '../../../lib/world/stampMilestones.js';
import {
  STAMP_TITLE_TOAST_DURATION_MS,
  stampTitlePresentation,
  stampTitleToastForUnlocked,
} from '../stampTitlePresentation.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

function firstStampIds(count) {
  return new Set(STAMP_ALBUM_NODES.slice(0, count).map(({ id }) => id));
}

describe('S5 스탬프 칭호 표시 계약', () => {
  it('저장된 정본 키를 name+line으로 표시하고 다음 미획득 문턱을 한 줄로 계산한다', () => {
    const storage = memoryStorage({
      [WORLD_TITLES_STORAGE_KEY]: '["stamp-10","unknown-title","stamp-30"]',
    });
    const presentation = stampTitlePresentation(firstStampIds(35), storage);

    expect(presentation).toEqual({
      stampCount: 35,
      titles: [
        {
          key: 'stamp-10',
          name: '첫 발자국 수집가',
          line: '도장 열 개 — 여권에 여행의 리듬이 생겼어요.',
        },
        {
          key: 'stamp-30',
          name: '골목까지 아는 여행자',
          line: '서른 곳의 기억 — 지도가 이야기로 바뀌기 시작해요.',
        },
      ],
      nextMilestone: { count: 60, remaining: 25, titleKey: 'stamp-60' },
      progressLine: '다음 칭호까지 도장 25개',
    });
    expect(Object.isFrozen(presentation)).toBe(true);
    expect(Object.isFrozen(presentation.titles)).toBe(true);
    expect(Object.isFrozen(presentation.nextMilestone)).toBe(true);
  });

  it('정본 밖 저장·스탬프 ID는 무시하고 완주 후에는 완료 한 줄만 반환한다', () => {
    const stamps = firstStampIds(85);
    stamps.add('unknown-stamp');
    const presentation = stampTitlePresentation(stamps, memoryStorage({
      [WORLD_TITLES_STORAGE_KEY]: '["unknown-title","stamp-85"]',
    }));

    expect(presentation.stampCount).toBe(85);
    expect(presentation.titles.map(({ key }) => key)).toEqual(['stamp-85']);
    expect(presentation.nextMilestone).toBeNull();
    expect(presentation.progressLine).toBe('모든 여행 칭호를 모았어요.');
  });

  it('한 claim에서 여러 문턱이 열려도 최신 정본 칭호를 4.2초 토스트 1회로 고른다', () => {
    expect(STAMP_TITLE_TOAST_DURATION_MS).toBe(4200);
    expect(stampTitleToastForUnlocked(['stamp-10', 'no-such', 'stamp-30']))
      .toEqual({
        key: 'stamp-30',
        name: '골목까지 아는 여행자',
        line: '서른 곳의 기억 — 지도가 이야기로 바뀌기 시작해요.',
      });
    expect(stampTitleToastForUnlocked([])).toBeNull();
    expect(stampTitleToastForUnlocked(null)).toBeNull();
  });
});
