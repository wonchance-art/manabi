import { describe, expect, it } from 'vitest';
import { COTE_DAZUR_DOORS, coteDazurDoorById } from '../coteDazurDoors.js';
import { PARIS_DOORS } from '../parisDoors.js';
import { MSM_DOORS } from '../msmDoors.js';
import { MARSEILLE_DOORS } from '../marseilleDoors.js';
import { LEMAN_DOORS } from '../lemanDoors.js';
import { GENEVA_DOORS } from '../genevaDoors.js';
import { trackChapterHref } from '../cultureDoors.js';
import FRENCH from '../../../content/french/index.js';

// 코트다쥐르 프랑스어 도어(fr-25~28) — 챕터 실존·track 라우팅·프랑스어권 5세트
// (파리·MSM·마르세유·제네바·레만)과 비중복 고정. 배선 보행성은 cityDoorSets 계약이 담당.

describe('코트다쥐르 도어 4종 — 프랑스어 트랙 연결 계약', () => {
  const frenchSlugs = new Set((FRENCH.ALL_CHAPTERS ?? []).map((chapter) => chapter.slug));

  it('id fr-25~28 챕터 실존·라우팅·2축+문화 사실', () => {
    expect(COTE_DAZUR_DOORS.map((door) => door.id)).toEqual(['fr-25', 'fr-26', 'fr-27', 'fr-28']);
    for (const door of COTE_DAZUR_DOORS) {
      expect(frenchSlugs.has(door.chapter), `${door.id} → ${door.chapter}`).toBe(true);
      expect(trackChapterHref('french', door.chapter)).toBe(`/french/grammar/${encodeURIComponent(door.chapter)}`);
      expect(door.culture?.length).toBeGreaterThan(0);
      for (const line of door.lines) {
        expect(line.fr?.length).toBeGreaterThan(0);
        expect(line.reading?.length).toBeGreaterThan(0);
        expect(line.gloss?.length).toBeGreaterThan(0);
      }
    }
  });

  it('프랑스어권 기존 5세트와 챕터 비중복 — a1 03·04·07 + a0-06 신규', () => {
    const used = new Set([...PARIS_DOORS, ...MSM_DOORS, ...MARSEILLE_DOORS, ...LEMAN_DOORS, ...GENEVA_DOORS].map((door) => door.chapter));
    expect(COTE_DAZUR_DOORS.map(d => d.chapter)).toEqual(['a1-03-er-verbs', 'a1-04-negation', 'a1-07-possessives', 'a0-06-gender']);
    for (const door of COTE_DAZUR_DOORS) expect(used.has(door.chapter), door.id).toBe(false);
  });

  it('coteDazurDoorById — 존재/부재', () => {
    expect(coteDazurDoorById('fr-25')?.name).toBe('구시가 공방');
    expect(coteDazurDoorById('fr-99')).toBeNull();
  });
});
