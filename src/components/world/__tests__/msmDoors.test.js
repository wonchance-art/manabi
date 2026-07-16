import { describe, expect, it } from 'vitest';
import { MSM_DOORS, msmDoorById } from '../msmDoors.js';
import { frenchChapterHref, cultureChapterHref } from '../cultureDoors.js';
import FRENCH from '../../../content/french/index.js';

// 몽생미셸 프랑스어 도어 — 챕터 링크가 실제 트랙에 존재해야 한다(죽은 링크 방지).
// 2축 콘텐츠 규격(fr/reading/gloss)도 함께 고정한다.

describe('몽생미셸 도어 6종 — 프랑스어 트랙 연결 계약', () => {
  const frenchSlugs = new Set((FRENCH.ALL_CHAPTERS ?? []).map((chapter) => chapter.slug));

  it('도어 6종, id 유일', () => {
    expect(MSM_DOORS).toHaveLength(6);
    expect(new Set(MSM_DOORS.map((door) => door.id)).size).toBe(6);
  });

  it('모든 도어 chapter 가 실제 프랑스어 챕터 슬러그로 존재한다', () => {
    expect(frenchSlugs.size).toBeGreaterThan(0);
    for (const door of MSM_DOORS) {
      expect(frenchSlugs.has(door.chapter), `${door.id} → ${door.chapter}`).toBe(true);
    }
  });

  it('frenchChapterHref 는 프랑스어 슬러그만 라우팅한다', () => {
    for (const door of MSM_DOORS) {
      expect(frenchChapterHref(door.chapter)).toBe(`/french/grammar/${encodeURIComponent(door.chapter)}`);
    }
    expect(frenchChapterHref('ot-01-konbini')).toBeNull(); // 일본어 계약과 불간섭
    expect(frenchChapterHref('../../etc')).toBeNull();
    expect(cultureChapterHref('a1-01-pronouns-etre')).toBeNull(); // 역방향 불간섭
  });

  it('대화 스니펫은 2축 규격(fr·reading·gloss 비어있지 않음)', () => {
    for (const door of MSM_DOORS) {
      expect(door.lines.length).toBeGreaterThanOrEqual(2);
      for (const line of door.lines) {
        expect(line.fr?.length).toBeGreaterThan(0);
        expect(line.reading?.length).toBeGreaterThan(0);
        expect(line.gloss?.length).toBeGreaterThan(0);
      }
    }
  });

  it('msmDoorById — 존재/부재', () => {
    expect(msmDoorById('msm-03')?.name).toBe('오믈렛 레스토랑');
    expect(msmDoorById('msm-99')).toBeNull();
  });
});
