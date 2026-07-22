// 📱 지역학 딥링크 — 게임 노드에서 여행 폰 위키 문서로 이어지는 큐레이션 계층.
// "이 장소를 이해하려면 이 문서" 를 노드 id → studies 문서로 잇는다. 문서 존재는
// travelWiki(→ studies 레지스트리 단일 진실원)로 확인하므로 깨진 링크가 만들어지지 않는다.
// 지역학 1기(일본학·한국학)만 큐레이션한다 — fr/en/zh 도시는 해당 학문 개시 후 추가.

import { wikiDoc } from './travelWiki';

// 노드 id → [countryId, slug]. 장소와 문서 주제가 직결되는 강한 연결만 싣는다.
const NODE_REFS = Object.freeze({
  // ── 도쿄 — 서브컬처·신불·시장·고령화 동네까지 주제가 가장 넓다.
  'shibuya-scramble': ['japan', 'jp-overview'],
  'tokyo-metropolitan-government': ['japan', 'jp-overview'],
  'tokyo-station-marunouchi': ['japan', 'jp-life'],
  'omoide-yokocho': ['japan', 'jp-life'],
  'ginza-4-chome': ['japan', 'jp-economy'],
  'ameyoko': ['japan', 'jp-economy'],
  'toyosu-market': ['japan', 'jp-economy'],
  'tsukiji-outer-market': ['japan', 'jp-culture'],
  'kappabashi': ['japan', 'jp-culture'],
  'sensoji': ['japan', 'jp-culture'],
  'meiji-jingu': ['japan', 'jp-culture'],
  'kanda-myojin': ['japan', 'jp-culture'],
  'ryogoku-kokugikan': ['japan', 'jp-culture'],
  'akihabara-electric-town': ['japan', 'jp-culture'],
  'otome-road': ['japan', 'jp-culture'],
  'nakano-broadway': ['japan', 'jp-culture'],
  'takeshita-street': ['japan', 'jp-culture'],
  'shimokitazawa': ['japan', 'jp-culture'],
  'jimbocho': ['japan', 'jp-culture'],
  'sugamo-jizodori': ['japan', 'jp-society'],
  'yanaka-ginza': ['japan', 'jp-society'],
  'tokyo-ekiin': ['japan', 'jp-life'],
  'tokyo-konbini': ['japan', 'jp-life'],
  'tokyo-menzei': ['japan', 'jp-economy'],
  // ── 교토 — 전근대사·신불의 본산.
  'nijo-castle': ['japan', 'jp-history-premodern'],
  'kyoto-imperial-palace': ['japan', 'jp-history-premodern'],
  'kinkakuji': ['japan', 'jp-history-premodern'],
  'ginkakuji': ['japan', 'jp-history-premodern'],
  'fushimi-inari-taisha': ['japan', 'jp-culture'],
  'yasaka-shrine': ['japan', 'jp-culture'],
  'kiyomizudera': ['japan', 'jp-culture'],
  'kyoto-shrine': ['japan', 'jp-culture'],
  // ── 오사카 — 조닌 문화와 전후 재건.
  'osaka-castle': ['japan', 'jp-history-premodern'],
  'shitennoji': ['japan', 'jp-history-premodern'],
  'tsutenkaku': ['japan', 'jp-economy'],
  'kuromon-market': ['japan', 'jp-culture'],
  'ebisubashi': ['japan', 'jp-life'],
  'osaka-izakaya': ['japan', 'jp-culture'],
  'osaka-konbini': ['japan', 'jp-life'],
  // ── 가와구치코 — 산이 만든 나라, 온천과 후지 신앙.
  'subaru-5th': ['japan', 'jp-overview'],
  'oshino-hakkai': ['japan', 'jp-overview'],
  'funatsu-onsen': ['japan', 'jp-culture'],
  'kitaguchi-hongu': ['japan', 'jp-culture'],
  'arakura-sengen': ['japan', 'jp-culture'],
  // ── 후쿠오카 — 마쓰리와 대륙 항로.
  'kushida-jinja': ['japan', 'jp-culture'],
  'fukuoka-castle': ['japan', 'jp-history-premodern'],
  'hakata-port-international-terminal': ['japan', 'jp-economy'],
  'fukuoka-ramen': ['japan', 'jp-culture'],
  'fukuoka-konbini': ['japan', 'jp-life'],
  // ── 서울 — 조선 500년과 압축 성장이 한 도시에.
  'gyeongbokgung': ['korea', 'kr-history-premodern'],
  'changdeokgung': ['korea', 'kr-history-premodern'],
  'jongmyo': ['korea', 'kr-history-premodern'],
  'sungnyemun': ['korea', 'kr-history-premodern'],
  'bukchon': ['korea', 'kr-history-premodern'],
  'amsa-dong': ['korea', 'kr-history-premodern'],
  'insadong': ['korea', 'kr-culture'],
  'hongdae': ['korea', 'kr-culture'],
  'myeongdong': ['korea', 'kr-economy'],
  'ddp': ['korea', 'kr-economy'],
  'coex': ['korea', 'kr-economy'],
  'yeouido-63': ['korea', 'kr-economy'],
  'cheonggyecheon': ['korea', 'kr-society'],
  'seoul-nat-univ': ['korea', 'kr-society'],
  // ── 부산 — 임진왜란·시장·산복도로.
  'jagalchi': ['korea', 'kr-culture'],
  'gukje-market': ['korea', 'kr-economy'],
  'busan-port-intl': ['korea', 'kr-economy'],
  'dongnae-eupseong': ['korea', 'kr-history-premodern'],
  'gamcheon': ['korea', 'kr-society'],
  'pnu-street': ['korea', 'kr-society'],
  'haeundae': ['korea', 'kr-overview'],
  'taejongdae': ['korea', 'kr-overview'],
  // ── 오버월드 도시 게이트 — 나라 개관으로 입국 브리핑.
  'tokyo': ['japan', 'jp-overview'],
  'osaka': ['japan', 'jp-overview'],
  'kyoto': ['japan', 'jp-overview'],
  'fukuoka': ['japan', 'jp-overview'],
  'kawaguchiko': ['japan', 'jp-overview'],
  'seoul': ['korea', 'kr-overview'],
  'busan': ['korea', 'kr-overview'],
  // ── 불어권(오너 방향 2026-07-22) — 프랑스 도시 게이트는 개관(입국 브리핑 활성),
  //    벨기에·스위스 로망디는 프랑코포니 문서 딥링크만(개관 아님 → 브리핑 비활성 = 나라 오인 방지).
  'paris': ['france', 'fr-overview'],
  'marseille': ['france', 'fr-overview'],
  'nice': ['france', 'fr-overview'],
  'mont-saint-michel': ['france', 'fr-overview'],
  'brussels': ['france', 'fr-francophonie'],
  'geneva': ['france', 'fr-francophonie'],
  'leman-riviera': ['france', 'fr-francophonie'],
});

export const STUDIES_REF_NODE_IDS = Object.freeze(Object.keys(NODE_REFS));

// 노드 id → { countryId, slug, title, countryName } | null. 문서가 실재할 때만 링크를 돌려준다.
export function studiesRefForNode(nodeId) {
  const ref = NODE_REFS[nodeId];
  if (!ref) return null;
  const found = wikiDoc(ref[0], ref[1]);
  if (!found) return null;
  return {
    countryId: ref[0],
    slug: ref[1],
    title: found.doc.title,
    countryName: found.country.nameKo,
  };
}
