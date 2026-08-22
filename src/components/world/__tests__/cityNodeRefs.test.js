import { beforeAll, describe, expect, it } from 'vitest';
import { loadAllCities } from '../cities/index.js';
import { JAPANESE_VOCAB_REF } from '../../../lib/japaneseVocabRegistry.js';

// 🈁 노드 텍스트 만남 주석 계약(rfc-vocab-encounter §4.6) — 전 도시 전수.
//   계약 1(실재): 노드 refs의 모든 표기는 정본 레지스트리에 존재해야 한다.
//   계약 3(표기 실등장): 각 ref는 그 노드의 name·desc에 실제 문자열로 등장해야 한다 —
//     요미·한글 번역만 있는 어휘에 ref를 다는 저작을 기계적으로 차단한다.
//   범위: refs가 있으면 refsLang 필수이고, 정본 대조가 가능한 ja만(스크립트 lang 계약과 동일).

let CITY_MAPS;

function nodesWithRefs(city) {
  return (city.nodes || []).filter((node) => node.refs !== undefined || node.refsLang !== undefined);
}

describe('도시 노드 refs 계약', () => {
  beforeAll(async () => {
    CITY_MAPS = await loadAllCities();
  }, 60000);

  it('refs·refsLang은 짝으로만 저작한다 — refs ⇒ refsLang="ja", refsLang ⇒ refs 비어있지 않음', () => {
    for (const city of CITY_MAPS) {
      for (const node of nodesWithRefs(city)) {
        const label = `${city.id}/${node.id}`;
        expect(node.refsLang, `${label}: refs가 있으면 refsLang 필수(R1 범위 ja)`).toBe('ja');
        expect(Array.isArray(node.refs) && node.refs.length > 0, `${label}: refsLang이 있으면 refs 필수`).toBe(true);
        for (const w of node.refs) {
          expect(typeof w === 'string' && w.length > 0, `${label}: 빈 문자열 금지`).toBe(true);
        }
      }
    }
  });

  it('계약 1 — 모든 노드 ref는 정본 사전에 실재한다', () => {
    for (const city of CITY_MAPS) {
      for (const node of nodesWithRefs(city)) {
        for (const w of node.refs || []) {
          expect(
            JAPANESE_VOCAB_REF.findWord(w),
            `${city.id}/${node.id}: 「${w}」가 정본 레지스트리에 없다`,
          ).toBeTruthy();
        }
      }
    }
  });

  it('계약 3 — 각 ref 표기는 노드 name·desc에 실제 등장한다', () => {
    for (const city of CITY_MAPS) {
      for (const node of nodesWithRefs(city)) {
        const text = `${node.name || ''}\n${node.desc || ''}`;
        for (const w of node.refs || []) {
          expect(
            text.includes(w),
            `${city.id}/${node.id}: 「${w}」 표기가 name·desc에 등장하지 않는다(표기 실등장 원칙)`,
          ).toBe(true);
        }
      }
    }
  });

  it('1차 저작 실측 고정 — 후쿠오카·교토 노드 refs 합', () => {
    const refUnion = (cityId) => {
      const city = CITY_MAPS.find((c) => c.id === cityId);
      const out = new Set();
      for (const node of city?.nodes || []) for (const w of node.refs || []) out.add(w);
      return [...out].sort();
    };
    expect(refUnion('fukuoka')).toEqual([
      'タワー', 'ラーメン', '公園', '城', '港', '神社',                       // spot 노드(§4.6 1차)
      '屋台', '免税', 'コンビニ', 'お願いします', '大丈夫', '居酒屋', 'お通し', // 도어 노드(§4.6 확장)
      '券売機', '替え玉',
    ].sort());
    expect(refUnion('kyoto')).toEqual(['城', '寺', '市場', '神社', '拍手'].sort());
    expect(refUnion('tokyo')).toEqual(['駅', 'まもなく', '行き', '免税', 'コンビニ', 'お願いします', '大丈夫'].sort());
    expect(refUnion('osaka')).toEqual(['居酒屋', 'お通し', 'コンビニ', 'お願いします', '大丈夫', '市場', '乗り換え', '公園'].sort());
  });
});
