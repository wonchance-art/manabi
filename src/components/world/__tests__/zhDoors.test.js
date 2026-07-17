import { describe, expect, it } from 'vitest';
import { ZH_DOORS, zhDoorById } from '../zhDoors.js';
import { trackChapterHref, cultureChapterHref } from '../cultureDoors.js';
import CHINESE from '../../../content/chinese/index.js';

// 중국어 도어 — 챕터 실존(죽은 링크 방지) + track 라우팅(ot 동형 슬러그의 ja/zh 구분) 고정.

describe('중국어 도어 6종 — 중국어 트랙 연결 계약', () => {
  const chineseSlugs = new Set((CHINESE.ALL_CHAPTERS ?? []).map((chapter) => chapter.slug));

  it('도어 6종(zh-01~06), track=chinese', () => {
    expect(ZH_DOORS.map((door) => door.id)).toEqual(['zh-01', 'zh-02', 'zh-03', 'zh-04', 'zh-05', 'zh-06']);
    expect(ZH_DOORS.every((door) => door.track === 'chinese')).toBe(true);
  });

  it('모든 도어 chapter 가 실제 중국어 챕터로 존재하고 /chinese 로 라우팅된다', () => {
    expect(chineseSlugs.size).toBeGreaterThan(0);
    for (const door of ZH_DOORS) {
      expect(chineseSlugs.has(door.chapter), `${door.id} → ${door.chapter}`).toBe(true);
      expect(trackChapterHref(door.track, door.chapter)).toBe(`/chinese/grammar/${encodeURIComponent(door.chapter)}`);
    }
  });

  it('동형 슬러그 방어 — 중국어 ot-XX 는 일본어 폴백에 잡히므로 track 명시가 필수임을 고정', () => {
    // 중국어 발음 오리엔테이션 슬러그(ot-02-tones)는 일본어 ot 정규식과 동형 — 레거시 폴백은 /japanese 로 보냈을 것.
    expect(cultureChapterHref('ot-02-tones')).toBe('/japanese/grammar/ot-02-tones');
    // track 명시 라우팅이 이를 이긴다(호출 우선순위는 WorldPage openCultureChapter).
    expect(trackChapterHref('chinese', 'ot-02-tones')).toBe('/chinese/grammar/ot-02-tones');
    // HSK 본편 슬러그는 일본어·영어 트랙에서 거부된다.
    expect(trackChapterHref('japanese', 'h1-01-shi')).toBeNull();
    expect(trackChapterHref('english', 'h1-01-shi')).toBeNull();
    expect(trackChapterHref('chinese', 'h1-01-shi')).toBe('/chinese/grammar/h1-01-shi');
  });

  it('2축 규격(간체+병음+한글 발음+gloss) + 문화 사실', () => {
    for (const door of ZH_DOORS) {
      expect(door.culture?.length).toBeGreaterThan(0);
      for (const line of door.lines) {
        expect(line.zh?.length).toBeGreaterThan(0);
        expect(line.pinyin?.length).toBeGreaterThan(0);
        expect(line.reading?.length).toBeGreaterThan(0);
        expect(line.gloss?.length).toBeGreaterThan(0);
      }
    }
  });

  it('zhDoorById — 존재/부재', () => {
    expect(zhDoorById('zh-01')?.nameZh).toBe('茶馆');
    expect(zhDoorById('zh-99')).toBeNull();
  });
});

describe('타이베이 도시 배선 — 도어가 보행 타일 위에 있다 (중국어권 1호)', () => {
  // 대형 geo 동적 임포트 — kyotoGeo/parisDoors 선례대로 타임아웃 확장.
  it('도어 6종이 CITY_NODES에 track·chapter와 함께 배선되고 타일이 보행 가능', { timeout: 20000 }, async () => {
    const { TAIPEI } = await import('../cities/taipei.js');
    const { isCityWalkable } = await import('../cities/terrain.js');
    const grid = TAIPEI.buildGrid();
    const doorNodes = TAIPEI.nodes.filter((node) => node.id.startsWith('zh-0'));
    expect(doorNodes).toHaveLength(6);
    for (const node of doorNodes) {
      expect(node.chapter, node.id).toBeTruthy();
      expect(node.track).toBe('chinese');
      const [x, y] = node.tile;
      expect(isCityWalkable(grid[y * TAIPEI.cols + x]), `${node.id} @${x},${y}`).toBe(true);
    }
  });
});
