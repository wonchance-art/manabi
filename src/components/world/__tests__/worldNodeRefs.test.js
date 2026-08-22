import { describe, expect, it } from 'vitest';
import { ALL_WORLD_NODES } from '../worldNodes.js';
import { JAPANESE_VOCAB_REF } from '../../../lib/japaneseVocabRegistry.js';

// 🈁 오버월드 노드 만남 주석 계약(rfc-vocab-encounter §4.6) — 도시 계약(cityNodeRefs)과 동일한
// 3계약을 전국맵·확장 노드 전수에 적용한다. 노출 경로: 게이트 없는 노드의 설명 박스(A 살펴보기).
// NPC 노드(전국맵 라멘·신사)는 스크립트 refs 소관이라 노드 refs를 달지 않는다(desc 미노출 경로).

function nodesWithRefs() {
  return ALL_WORLD_NODES.filter((node) => node.refs !== undefined || node.refsLang !== undefined);
}

describe('오버월드 노드 refs 계약', () => {
  it('refs·refsLang은 짝으로만, R1 범위 ja만 — 그리고 NPC·게이트 노드에는 달지 않는다', () => {
    for (const node of nodesWithRefs()) {
      expect(node.refsLang, `${node.id}: refs가 있으면 refsLang 필수`).toBe('ja');
      expect(Array.isArray(node.refs) && node.refs.length > 0, `${node.id}: refsLang이 있으면 refs 필수`).toBe(true);
      expect(node.npc, `${node.id}: NPC 노드 desc는 미노출 경로 — refs 금지(스크립트 소관)`).toBeUndefined();
      expect(node.gate, `${node.id}: 게이트 노드는 §4.6 제외 — refs 금지`).toBeUndefined();
      for (const w of node.refs) {
        expect(typeof w === 'string' && w.length > 0, `${node.id}: 빈 문자열 금지`).toBe(true);
      }
    }
  });

  it('계약 1 — 모든 표기는 정본 사전에 실재한다', () => {
    for (const node of nodesWithRefs()) {
      for (const w of node.refs || []) {
        expect(JAPANESE_VOCAB_REF.findWord(w), `${node.id}: 「${w}」가 정본에 없다`).toBeTruthy();
      }
    }
  });

  it('계약 3 — 각 표기는 노드 name·desc에 실제 등장한다', () => {
    for (const node of nodesWithRefs()) {
      const text = `${node.name || ''}\n${node.desc || ''}`;
      for (const w of node.refs || []) {
        expect(text.includes(w), `${node.id}: 「${w}」 표기 실등장 위반`).toBe(true);
      }
    }
  });

  it('1차 저작 실측 고정 — 12노드·표기 합', () => {
    const byId = new Map(nodesWithRefs().map((n) => [n.id, [...n.refs].sort()]));
    expect([...byId.keys()].sort()).toEqual([
      'aoshima-jinja', 'beppu-onsen', 'gourmet-nagano', 'gourmet-nagoya', 'himeji-castle',
      'hirosaki-castle', 'hiroshima-peace', 'ibusuki-onsen', 'karatsu-castle',
      'kumamoto-castle', 'yoshinogari', 'yutoku-inari',
    ]);
    expect(byId.get('hiroshima-peace')).toEqual(['原爆', '平和', '記念', '公園'].sort());
    expect(byId.get('beppu-onsen')).toEqual(['地獄', '温泉'].sort());
    expect(byId.get('aoshima-jinja')).toEqual(['洗濯', '神社'].sort());
  });
});
