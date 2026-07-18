import { describe, expect, it } from 'vitest';
import { KAWAGUCHIKO_DOORS, kawaguchikoDoorById } from '../kawaguchikoDoors.js';
import { trackChapterHref, cultureChapterHref } from '../cultureDoors.js';
import JAPANESE from '../../../content/japanese/index.js';

// 가와구치코 일본어 도어(ja-01~04) — 첫 n5 본편 세트. 챕터 실존(죽은 링크 방지) +
// track 라우팅(#246 확장 소비) + 레거시 ot 폴백 불간섭 고정. 도시 배선(보행 타일)은
// kawaguchiko.js 라운드에서 cityDoorSets 계약으로 합류(MSM·마르세유 선행 저작 선례).

describe('가와구치코 도어 4종 — 일본어 트랙 연결 계약', () => {
  const japaneseSlugs = new Set((JAPANESE.ALL_CHAPTERS ?? []).map((chapter) => chapter.slug));

  it('도어 4종, id ja-01~04 유일', () => {
    expect(KAWAGUCHIKO_DOORS).toHaveLength(4);
    expect(KAWAGUCHIKO_DOORS.map((door) => door.id)).toEqual(['ja-01', 'ja-02', 'ja-03', 'ja-04']);
  });

  it('모든 도어 chapter 가 실제 일본어 챕터 슬러그로 존재한다', () => {
    expect(japaneseSlugs.size).toBeGreaterThan(0);
    for (const door of KAWAGUCHIKO_DOORS) {
      expect(japaneseSlugs.has(door.chapter), `${door.id} → ${door.chapter}`).toBe(true);
    }
  });

  it('track 명시 라우팅 — n5 본편이 /japanese/grammar/ 로 가고 레거시 폴백엔 잡히지 않는다', () => {
    for (const door of KAWAGUCHIKO_DOORS) {
      expect(door.track).toBe('japanese');
      expect(trackChapterHref(door.track, door.chapter)).toBe(`/japanese/grammar/${encodeURIComponent(door.chapter)}`);
      expect(cultureChapterHref(door.chapter)).toBeNull(); // 레거시(ot 전용) 불간섭
    }
  });

  it('레거시 ot 도어 사용 챕터와 겹치지 않는다(전부 n5 본편)', () => {
    for (const door of KAWAGUCHIKO_DOORS) {
      expect(door.chapter.startsWith('n5-'), door.id).toBe(true);
    }
  });

  it('대화 스니펫 2축 규격(ja·reading·gloss) + 문화 사실 1개', () => {
    for (const door of KAWAGUCHIKO_DOORS) {
      expect(door.culture?.length).toBeGreaterThan(0);
      expect(door.lines.length).toBeGreaterThanOrEqual(2);
      for (const line of door.lines) {
        expect(line.ja?.length).toBeGreaterThan(0);
        expect(line.reading?.length).toBeGreaterThan(0);
        expect(line.gloss?.length).toBeGreaterThan(0);
      }
    }
  });

  it('kawaguchikoDoorById — 존재/부재', () => {
    expect(kawaguchikoDoorById('ja-02')?.name).toBe('온천 탈의실');
    expect(kawaguchikoDoorById('ja-99')).toBeNull();
  });
});
