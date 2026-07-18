import { describe, expect, it } from 'vitest';
import { STUDIES_REF_NODE_IDS, studiesRefForNode } from '../studiesRefs.js';
import { wikiDoc } from '../travelWiki.js';
import { CITY_DATA } from '../../../components/world/cities/index.js';
import { WORLD_NODES } from '../../../components/world/worldNodes.js';

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
      // slug 접두는 나라와 일치해야 한다(jp-↔japan, kr-↔korea).
      expect(ref.slug.startsWith(ref.countryId === 'japan' ? 'jp-' : 'kr-'), nodeId).toBe(true);
    }
  });

  it('큐레이션하지 않은 노드는 null — 깨진 딥링크 UI가 생기지 않는다', () => {
    expect(studiesRefForNode('no-such-node')).toBeNull();
    expect(studiesRefForNode(undefined)).toBeNull();
  });

  it('모든 딥링크 키가 실재하는 게임 노드(도시 노드·NPC 또는 오버월드 노드)다', HEAVY, () => {
    const known = new Set(WORLD_NODES.map((node) => node.id));
    for (const city of Object.values(CITY_DATA)) {
      for (const node of city.nodes || []) known.add(node.id);
    }
    const missing = STUDIES_REF_NODE_IDS.filter((nodeId) => !known.has(nodeId));
    expect(missing).toEqual([]);
  });

  it('일본·한국 도시에만 딥링크를 건다 — 지역학 미개시 언어권 노드는 큐레이션하지 않는다', HEAVY, () => {
    // 일·한 국내맵 게이트 노드는 contentLocale 필드가 없다(해외 노드만 zh/en/fr 명시).
    // 따라서 "필드 없음 또는 ja/ko" 게이트로 열리는 도시만 지역학 1기 큐레이션 대상이다.
    const isJaKoLocale = (locale) => locale === undefined || locale === 'ja' || locale === 'ko';
    const jaKoCityNodeIds = new Set();
    for (const city of Object.values(CITY_DATA)) {
      const gateNode = WORLD_NODES.find((node) => node.gate?.type === 'city' && node.gate.to === city.id);
      if (!gateNode || !isJaKoLocale(gateNode.contentLocale)) continue;
      for (const node of city.nodes || []) jaKoCityNodeIds.add(node.id);
    }
    for (const nodeId of STUDIES_REF_NODE_IDS) {
      const worldNode = WORLD_NODES.find((node) => node.id === nodeId);
      if (worldNode) {
        expect(isJaKoLocale(worldNode.contentLocale), nodeId).toBe(true);
        continue;
      }
      expect(jaKoCityNodeIds.has(nodeId), nodeId).toBe(true);
    }
  });
});
