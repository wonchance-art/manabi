import { describe, expect, it } from 'vitest';
import { MARSEILLE_DOORS, marseilleDoorById } from '../marseilleDoors.js';
import { PARIS_DOORS } from '../parisDoors.js';
import { MSM_DOORS } from '../msmDoors.js';
import { trackChapterHref, cultureChapterHref } from '../cultureDoors.js';
import FRENCH from '../../../content/french/index.js';

// 마르세유 프랑스어 도어(fr-07~12) — 챕터 실존(죽은 링크 방지) + track 라우팅 + 세트 간
// 챕터 비중복(파리·MSM) 고정. 도시 배선(보행 타일) 검증은 marseille.js 라운드에서
// cityDoorSets 계약으로 합류한다(MSM 선행 저작 선례).

describe('마르세유 도어 6종 — 프랑스어 트랙 연결 계약', () => {
  const frenchSlugs = new Set((FRENCH.ALL_CHAPTERS ?? []).map((chapter) => chapter.slug));

  it('도어 6종, id fr-07~12 유일', () => {
    expect(MARSEILLE_DOORS).toHaveLength(6);
    expect(MARSEILLE_DOORS.map((door) => door.id)).toEqual(['fr-07', 'fr-08', 'fr-09', 'fr-10', 'fr-11', 'fr-12']);
  });

  it('모든 도어 chapter 가 실제 프랑스어 챕터 슬러그로 존재한다', () => {
    expect(frenchSlugs.size).toBeGreaterThan(0);
    for (const door of MARSEILLE_DOORS) {
      expect(frenchSlugs.has(door.chapter), `${door.id} → ${door.chapter}`).toBe(true);
    }
  });

  it('track 명시 라우팅 — /french/grammar/ 로 가고 일본어 폴백엔 잡히지 않는다', () => {
    for (const door of MARSEILLE_DOORS) {
      expect(door.track).toBe('french');
      expect(trackChapterHref(door.track, door.chapter)).toBe(`/french/grammar/${encodeURIComponent(door.chapter)}`);
      expect(cultureChapterHref(door.chapter)).toBeNull();
    }
  });

  it('세트 간 챕터 비중복 — 파리 fr-01~06·MSM msm-01~06과 겹치지 않는다', () => {
    const used = new Set([...PARIS_DOORS, ...MSM_DOORS].map((door) => door.chapter));
    for (const door of MARSEILLE_DOORS) {
      expect(used.has(door.chapter), `${door.id} → ${door.chapter}`).toBe(false);
    }
  });

  it('대화 스니펫 2축 규격(fr·reading·gloss) + 문화 사실 1개', () => {
    for (const door of MARSEILLE_DOORS) {
      expect(door.culture?.length).toBeGreaterThan(0);
      expect(door.lines.length).toBeGreaterThanOrEqual(2);
      for (const line of door.lines) {
        expect(line.fr?.length).toBeGreaterThan(0);
        expect(line.reading?.length).toBeGreaterThan(0);
        expect(line.gloss?.length).toBeGreaterThan(0);
      }
    }
  });

  it('marseilleDoorById — 존재/부재', () => {
    expect(marseilleDoorById('fr-09')?.name).toBe('이프성 페리 매표소');
    expect(marseilleDoorById('fr-99')).toBeNull();
  });
});
