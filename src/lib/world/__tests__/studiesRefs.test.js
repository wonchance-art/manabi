import { describe, expect, it } from 'vitest';
import { STUDIES_REF_NODE_IDS, studiesRefForNode } from '../studiesRefs.js';
import { wikiDoc } from '../travelWiki.js';
import { CITY_DATA } from '../../../components/world/cities/index.js';
import { ALL_WORLD_NODES, WORLD_NODES } from '../../../components/world/worldNodes.js';

// 도시 23종 로드가 무거워 병렬 부하에서 흔들릴 수 있다 — kyotoGeo 선례로 명시 타임아웃.
const HEAVY = { timeout: 20000 };

describe('지역학 딥링크(studiesRefs) 계약', () => {
  it('모든 딥링크가 실재하는 studies 문서로 해석된다', () => {
    expect(STUDIES_REF_NODE_IDS.length).toBeGreaterThanOrEqual(70);
    for (const nodeId of STUDIES_REF_NODE_IDS) {
      const ref = studiesRefForNode(nodeId);
      expect(ref, nodeId).toBeTruthy();
      expect(wikiDoc(ref.countryId, ref.slug), nodeId).toBeTruthy();
      expect(ref.title.length, nodeId).toBeGreaterThan(0);
      expect(ref.countryName.length, nodeId).toBeGreaterThan(0);
      // slug 접두는 나라와 일치해야 한다(jp-↔japan, kr-↔korea, fr-↔france).
      const prefixByCountry = { japan: 'jp-', korea: 'kr-', france: 'fr-' };
      expect(ref.slug.startsWith(prefixByCountry[ref.countryId] ?? '∅'), nodeId).toBe(true);
    }
  });

  it('큐레이션하지 않은 노드는 null — 깨진 딥링크 UI가 생기지 않는다', () => {
    expect(studiesRefForNode('no-such-node')).toBeNull();
    expect(studiesRefForNode(undefined)).toBeNull();
  });

  it('모든 딥링크 키가 실재하는 게임 노드(도시 노드·NPC 또는 오버월드 노드)다', HEAVY, () => {
    const known = new Set(ALL_WORLD_NODES.map((node) => node.id));
    for (const city of Object.values(CITY_DATA)) {
      for (const node of city.nodes || []) known.add(node.id);
    }
    const missing = STUDIES_REF_NODE_IDS.filter((nodeId) => !known.has(nodeId));
    expect(missing).toEqual([]);
  });

  it('지역학 개시 언어권(일·한·불) 노드에만 딥링크를 건다 — 미개시 언어권은 큐레이션하지 않는다', HEAVY, () => {
    // 일·한 국내맵 게이트 노드는 contentLocale 필드가 없다(해외 노드만 zh/en/fr 명시).
    // 지역학 개시국(일본·한국·프랑스학=불어권 2026-07-22)의 언어권만 큐레이션 대상이다.
    const isCuratedLocale = (locale) => locale === undefined || locale === 'ja' || locale === 'ko' || locale === 'fr';
    const curatedCityNodeIds = new Set();
    for (const city of Object.values(CITY_DATA)) {
      const gateNode = ALL_WORLD_NODES.find((node) => node.gate?.type === 'city' && node.gate.to === city.id);
      if (!gateNode || !isCuratedLocale(gateNode.contentLocale)) continue;
      for (const node of city.nodes || []) curatedCityNodeIds.add(node.id);
    }
    for (const nodeId of STUDIES_REF_NODE_IDS) {
      const worldNode = ALL_WORLD_NODES.find((node) => node.id === nodeId);
      if (worldNode) {
        expect(isCuratedLocale(worldNode.contentLocale), nodeId).toBe(true);
        continue;
      }
      expect(curatedCityNodeIds.has(nodeId), nodeId).toBe(true);
    }
  });
});
