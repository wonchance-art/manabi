import { describe, expect, it } from 'vitest';
import { LONDON_DOORS, londonDoorById } from '../londonDoors.js';
import { trackChapterHref, frenchChapterHref, cultureChapterHref } from '../cultureDoors.js';
import ENGLISH from '../../../content/english/index.js';

// 런던 영어 도어 — 챕터 실존(죽은 링크 방지) + track 라우팅(동형 슬러그의 fr/en 구분) 고정.

describe('런던 도어 6종 — 영어 트랙 연결 계약', () => {
  const englishSlugs = new Set((ENGLISH.ALL_CHAPTERS ?? []).map((chapter) => chapter.slug));

  it('도어 6종(en-01~06), track=english', () => {
    expect(LONDON_DOORS.map((door) => door.id)).toEqual(['en-01', 'en-02', 'en-03', 'en-04', 'en-05', 'en-06']);
    expect(LONDON_DOORS.every((door) => door.track === 'english')).toBe(true);
  });

  it('모든 도어 chapter 가 실제 영어 챕터로 존재하고 /english 로 라우팅된다', () => {
    expect(englishSlugs.size).toBeGreaterThan(0);
    for (const door of LONDON_DOORS) {
      expect(englishSlugs.has(door.chapter), `${door.id} → ${door.chapter}`).toBe(true);
      expect(trackChapterHref(door.track, door.chapter)).toBe(`/english/grammar/${encodeURIComponent(door.chapter)}`);
    }
  });

  it('동형 슬러그 방어 — track 없으면 프랑스어 폴백에 잡히므로 track 명시가 필수임을 고정', () => {
    // 영어 챕터 슬러그는 프랑스어 정규식과 동형 — 레거시 폴백은 /french 로 보냈을 것.
    expect(frenchChapterHref('a1-01-be-verb')).toBe('/french/grammar/a1-01-be-verb');
    // track 명시 라우팅이 이를 이긴다(호출 우선순위는 WorldPage openCultureChapter).
    expect(trackChapterHref('english', 'a1-01-be-verb')).toBe('/english/grammar/a1-01-be-verb');
    expect(trackChapterHref('japanese', 'a1-01-be-verb')).toBeNull();
    expect(cultureChapterHref('a1-01-be-verb')).toBeNull();
  });

  it('2축 규격 + 문화 사실', () => {
    for (const door of LONDON_DOORS) {
      expect(door.culture?.length).toBeGreaterThan(0);
      for (const line of door.lines) {
        expect(line.en?.length).toBeGreaterThan(0);
        expect(line.reading?.length).toBeGreaterThan(0);
        expect(line.gloss?.length).toBeGreaterThan(0);
      }
    }
  });

  it('londonDoorById — 존재/부재', () => {
    expect(londonDoorById('en-01')?.nameEn).toBe('Tube platform');
    expect(londonDoorById('en-99')).toBeNull();
  });
});
