import { describe, expect, it } from 'vitest';
import { LEMAN_DOORS, lemanDoorById } from '../lemanDoors.js';
import { PARIS_DOORS } from '../parisDoors.js';
import { MSM_DOORS } from '../msmDoors.js';
import { MARSEILLE_DOORS } from '../marseilleDoors.js';
import { GENEVA_DOORS } from '../genevaDoors.js';
import { trackChapterHref } from '../cultureDoors.js';
import FRENCH from '../../../content/french/index.js';

// 레만호 프랑스어 도어(fr-16~18) — 챕터 실존·track 라우팅·프랑스어권 4세트(파리·MSM·
// 마르세유·제네바)와 비중복 고정. 배선 보행성은 cityDoorSets 계약이 담당.

describe('레만호 도어 3종 — 프랑스어 트랙 연결 계약', () => {
  const frenchSlugs = new Set((FRENCH.ALL_CHAPTERS ?? []).map((chapter) => chapter.slug));

  it('id fr-16~18, 챕터 실존·라우팅·2축+문화 사실', () => {
    expect(LEMAN_DOORS.map((door) => door.id)).toEqual(['fr-16', 'fr-17', 'fr-18']);
    for (const door of LEMAN_DOORS) {
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

  it('프랑스어권 기존 4세트와 챕터 비중복', () => {
    const used = new Set([...PARIS_DOORS, ...MSM_DOORS, ...MARSEILLE_DOORS, ...GENEVA_DOORS].map((door) => door.chapter));
    for (const door of LEMAN_DOORS) expect(used.has(door.chapter), door.id).toBe(false);
  });

  it('lemanDoorById — 존재/부재', () => {
    expect(lemanDoorById('fr-16')?.name).toBe('와인 카브');
    expect(lemanDoorById('fr-99')).toBeNull();
  });
});
