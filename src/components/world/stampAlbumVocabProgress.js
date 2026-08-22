// 🈁 앨범 도시 카드 "만난 말" 진척 (rfc-vocab-encounter §4.4, 목업 B).
// 분모(이 도시의 말) = 그 도시 NPC 스크립트 중 refs가 저작된 것들의 합집합 — refs 배선이
// 늘면 분모도 자란다(정직한 성장 분모). 분자 = 만남 기록과의 교집합(유령 표기 자동 제외).
// npcMeetingProgress와 같은 소비 계약: 표시할 게 없으면 null(0 무표기 — 빈 지표로 압박하지 않는다).

import { getNpcScript } from './npcScripts.js';
import { loadVocabEncounters, scriptEncounterRefs } from './vocabEncounters.js';

function cityIdForNode(node) {
  return node?.gate?.type === 'city' && typeof node.gate.to === 'string'
    ? node.gate.to
    : null;
}

/** 도시 노드 배열 → 언어별 어휘 코퍼스 Map<lang, Set<표기>>. 순수 — 저장소 미접촉. */
export function cityVocabCorpus(cityNodes) {
  const byLang = new Map();
  for (const node of cityNodes || []) {
    if (node?.kind !== 'npc' || typeof node.npc !== 'string') continue;
    const script = getNpcScript(node.npc);
    if (!script?.lang) continue;
    const refs = scriptEncounterRefs(script);
    if (refs.length === 0) continue;
    let set = byLang.get(script.lang);
    if (!set) { set = new Set(); byLang.set(script.lang, set); }
    for (const w of refs) set.add(w);
  }
  return byLang;
}

export function stampAlbumVocabProgress(node, cityData, storage) {
  const cityId = cityIdForNode(node);
  if (!cityId) return null;

  const nodes = cityData?.[cityId]?.nodes;
  if (!Array.isArray(nodes)) return null;

  const byLang = cityVocabCorpus(nodes);
  let got = 0;
  let total = 0;
  for (const [lang, corpus] of byLang) {
    total += corpus.size;
    const met = loadVocabEncounters(lang, storage);
    for (const w of corpus) if (met.has(w)) got += 1;
  }
  // 0 무표기: 아직 한 번도 만나지 않은 도시는 분모만 있는 "0/N"을 보여주지 않는다(목업 B).
  if (total === 0 || got === 0) return null;

  return Object.freeze({
    cityId,
    got,
    total,
    label: `만난 말 ${got} · 이 도시의 말 ${total}`,
  });
}
