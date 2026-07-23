import { beforeAll, describe, expect, it } from 'vitest';
import { loadAllCities } from '../cities/index.js';

// 📝 desc 커버리지 게이트 — 모든 도시 노드가 저작·검증된 명시 desc를 갖는다(폴백 문구 출시 차단).
// 폴백 마커: 각 도시 COPY lookup의 자동 문구("실제 지도 위치를 따라 …"). 이 문구가 플레이어에게
// 노출된다는 것은 desc 저작이 누락됐다는 뜻 — 신규 도시 배선 시 이 게이트가 먼저 잡는다.
const FALLBACK_MARKER = '실제 지도 위치를 따라';
let CITY_MAPS;

describe('도시 desc 커버리지 게이트', () => {
  beforeAll(async () => {
    CITY_MAPS = await loadAllCities();
  }, 60000);

  it('전 도시의 spot/npc 노드가 명시 desc를 갖고 폴백 문구가 노출되지 않는다', () => {
    const gaps = [];
    for (const city of CITY_MAPS) {
      for (const node of city.nodes || []) {
        if (node.kind !== 'spot' && node.kind !== 'npc') continue;
        if (!node.desc || node.desc.length < 20 || node.desc.includes(FALLBACK_MARKER)) {
          gaps.push(`${city.id}/${node.id}`);
        }
      }
    }
    expect(gaps, `desc 누락·폴백 노출: ${gaps.join(', ')}`).toEqual([]);
  });

  it('도어 라우팅 계약 — 동형 위험 슬러그는 track 필수, 레거시(ot-XX)만 폴백 허용', () => {
    // 일본 레거시 도어는 chapter(ot-XX)만 싣고 cultureChapterHref 폴백이 처리한다(설계).
    // 그 외 슬러그(a1-…, h1-… 등)는 언어 간 동형이라 track 명시가 없으면 오라우팅된다.
    const LEGACY_OT_RE = /^ot-\d{2}-[a-z0-9-]+$/;
    const broken = [];
    for (const city of CITY_MAPS) {
      for (const node of city.nodes || []) {
        if (!node.track && !node.chapter) continue;
        if (node.track && !node.chapter) broken.push(`${city.id}/${node.id}(chapter 누락)`);
        else if (!node.track && !LEGACY_OT_RE.test(node.chapter)) broken.push(`${city.id}/${node.id}(track 누락)`);
      }
    }
    expect(broken, `도어 라우팅 계약 위반: ${broken.join(', ')}`).toEqual([]);
  });
});
