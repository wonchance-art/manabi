import { describe, expect, it } from 'vitest';
import { PARIS_DOORS, parisDoorById } from '../parisDoors.js';
import { frenchChapterHref } from '../cultureDoors.js';
import FRENCH from '../../../content/french/index.js';

// 그랑파리 프랑스어 도어 — 챕터 실존(죽은 링크 방지) + 2축 규격 + 문화 사실 필드 고정.

describe('그랑파리 도어 6종 — 프랑스어 트랙 연결 계약', () => {
  const frenchSlugs = new Set((FRENCH.ALL_CHAPTERS ?? []).map((chapter) => chapter.slug));

  it('도어 6종, id 유일(fr-01~06)', () => {
    expect(PARIS_DOORS.map((door) => door.id)).toEqual(['fr-01', 'fr-02', 'fr-03', 'fr-04', 'fr-05', 'fr-06']);
  });

  it('모든 도어 chapter 가 실제 프랑스어 챕터로 존재하고 라우팅된다', () => {
    for (const door of PARIS_DOORS) {
      expect(frenchSlugs.has(door.chapter), `${door.id} → ${door.chapter}`).toBe(true);
      expect(frenchChapterHref(door.chapter)).toBe(`/french/grammar/${encodeURIComponent(door.chapter)}`);
    }
  });

  it('2축 규격 + 문화 사실 1개(헤지 문체)', () => {
    for (const door of PARIS_DOORS) {
      expect(door.culture?.length).toBeGreaterThan(0);
      expect(door.lines.length).toBeGreaterThanOrEqual(2);
      for (const line of door.lines) {
        expect(line.fr?.length).toBeGreaterThan(0);
        expect(line.reading?.length).toBeGreaterThan(0);
        expect(line.gloss?.length).toBeGreaterThan(0);
      }
    }
  });

  it('만능 표현 s\'il vous plaît 반복 설계(ot 시리즈 미러) — 3개 도어 이상 등장', () => {
    const withSvp = PARIS_DOORS.filter((door) => door.lines.some((line) => line.fr.includes('s\'il vous plaît')));
    expect(withSvp.length).toBeGreaterThanOrEqual(3);
  });

  it('parisDoorById — 존재/부재', () => {
    expect(parisDoorById('fr-03')?.name).toBe('메트로 승강장');
    expect(parisDoorById('fr-99')).toBeNull();
  });
});

describe('그랑파리 도시 배선 — 도어가 보행 타일 위에 있다', () => {
  // 대형 geo(3.4MB) 동적 임포트 — kyotoGeo 선례대로 타임아웃 확장.
  it('도어 6종이 CITY_NODES에 track·chapter와 함께 배선되고 타일이 보행 가능', { timeout: 20000 }, async () => {
    const { GRAND_PARIS } = await import('../cities/grand-paris.js');
    const { isCityWalkable } = await import('../cities/terrain.js');
    const grid = GRAND_PARIS.buildGrid();
    const doorNodes = GRAND_PARIS.nodes.filter((node) => node.id.startsWith('fr-0'));
    expect(doorNodes).toHaveLength(6);
    for (const node of doorNodes) {
      expect(node.chapter, node.id).toBeTruthy();
      expect(node.track).toBe('french');
      const [x, y] = node.tile;
      expect(isCityWalkable(grid[y * GRAND_PARIS.cols + x]), `${node.id} @${x},${y}`).toBe(true);
    }
  });
});
