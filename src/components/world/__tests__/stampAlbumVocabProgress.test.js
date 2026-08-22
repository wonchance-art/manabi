import { describe, expect, it, vi } from 'vitest';
import { cityVocabCorpus, stampAlbumVocabProgress } from '../stampAlbumVocabProgress.js';
import { NPC_SCRIPTS } from '../npcScripts.js';
import { scriptEncounterRefs, vocabEncounterStorageKey } from '../vocabEncounters.js';

// 🈁 앨범 도시 카드 "만난 말" 진척(rfc-vocab-encounter §4.4, 목업 B).

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    values,
  };
}

const gateNode = (to) => ({ gate: { type: 'city', to } });
const npcNode = (npc) => ({ kind: 'npc', npc, noStamp: true, id: `x-${npc}` });

describe('cityVocabCorpus — 도시 노드 → 언어별 코퍼스(순수)', () => {
  it('refs 저작 스크립트만 합산하고, 미저작 스크립트는 분모에 넣지 않는다', () => {
    const byLang = cityVocabCorpus([
      npcNode('ramen'),
      npcNode('gare-accueil'),       // fr 스크립트 — refs 미저작이라 코퍼스 0
      npcNode('no-such-script'),     // 존재하지 않는 키 — 조용히 무시
      { kind: 'poi', id: 'p1' },     // NPC 아님
    ]);
    expect([...byLang.keys()]).toEqual(['ja']);
    expect(byLang.get('ja').size).toBe(scriptEncounterRefs(NPC_SCRIPTS.ramen).length);
  });

  it('같은 언어 스크립트 여럿은 합집합이다', () => {
    const byLang = cityVocabCorpus([npcNode('ramen'), npcNode('shrine')]);
    const union = new Set([
      ...scriptEncounterRefs(NPC_SCRIPTS.ramen),
      ...scriptEncounterRefs(NPC_SCRIPTS.shrine),
    ]);
    expect(byLang.get('ja').size).toBe(union.size);
  });
});

describe('stampAlbumVocabProgress — 카드 한 줄', () => {
  const cityData = {
    fukuoka: { nodes: [npcNode('ramen')] },
    empty: { nodes: [{ kind: 'poi', id: 'p1' }] },
  };

  it('도시 게이트가 아니거나 도시 데이터가 없으면 null', () => {
    expect(stampAlbumVocabProgress({ gate: { type: 'door' } }, cityData, memoryStorage())).toBeNull();
    expect(stampAlbumVocabProgress(gateNode('unknown-city'), cityData, memoryStorage())).toBeNull();
  });

  it('코퍼스 0(미저작 도시) 또는 만남 0이면 null — 0 무표기', () => {
    expect(stampAlbumVocabProgress(gateNode('empty'), cityData, memoryStorage())).toBeNull();
    expect(stampAlbumVocabProgress(gateNode('fukuoka'), cityData, memoryStorage())).toBeNull();
  });

  it('만남 교집합만 분자로 세고 유령 표기는 제외한다', () => {
    const storage = memoryStorage({
      [vocabEncounterStorageKey('ja')]: JSON.stringify(['食券', '替え玉', '유령표기']),
    });
    const p = stampAlbumVocabProgress(gateNode('fukuoka'), cityData, storage);
    expect(p.got).toBe(2);
    expect(p.total).toBe(scriptEncounterRefs(NPC_SCRIPTS.ramen).length);
    expect(p.label).toBe(`만난 말 2 · 이 도시의 말 ${p.total}`);
  });
});
