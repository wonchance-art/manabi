import { describe, expect, it } from 'vitest';
import { STAMP_ALBUM_NODES } from '../stampUniverse.js';
import { NODE_FACTS, factLineForNode } from '../worldNodeFacts.js';

// 📖 스탬프 지식 카드(아이디어 보드 ④) 계약 — 스탬프 대상 전국맵 노드 전수 factLine,
// 1줄 규격·해요체·desc 비중복(동일 문자열 금지). 유령 키(실재하지 않는 노드) 금지.

describe('스탬프 지식 카드 factLine 계약', () => {
  const stampNodes = STAMP_ALBUM_NODES;

  it('스탬프 대상 노드 전수 커버 — 1줄 규격(12~90자)·해요체·desc 비중복', () => {
    expect(stampNodes).toHaveLength(85);
    for (const node of stampNodes) {
      const fact = factLineForNode(node.id);
      expect(fact, node.id).toBeTruthy();
      expect(fact.length, node.id).toBeGreaterThanOrEqual(12);
      expect(fact.length, node.id).toBeLessThanOrEqual(90);
      expect(/요\.$/.test(fact), `${node.id} 해요체 어미: ${fact}`).toBe(true);
      expect(fact, node.id).not.toBe(node.desc);
    }
  });

  it('팩트 키와 앨범 ID가 85/85 exact 일치한다', () => {
    expect(Object.keys(NODE_FACTS).sort())
      .toEqual(stampNodes.map((node) => node.id).sort());
  });

  it('factLineForNode — 부재 시 null', () => {
    expect(factLineForNode('no-such-node')).toBeNull();
    expect(factLineForNode(undefined)).toBeNull();
  });
});
