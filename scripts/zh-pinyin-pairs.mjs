/**
 * zh·pinyin 쌍 수확 — lint-curriculum.mjs (h) 병음 정합 게이트와 그 사각 계약(zh-pinyin-pairs.test.js)이
 * 같은 정규식을 쓴다. 게이트는 소스 텍스트를 정규식으로 읽으므로, 표기가 다른 파일은 소리 없이 감시망
 * 밖으로 샌다 — 챕터 예문 파일 7본(h1~h6·ot `_examples.js`)은 JSON식 `"zh":` 표기라 따옴표 없는
 * 정규식이 406쌍(트리 16,113쌍 중)을 못 봤다(분석기 리뷰 라운드 6 실측). 키의 따옴표는 유무 둘 다 받고,
 * 「모듈 트리의 모든 쌍이 정규식에도 잡힌다」를 계약이 지킨다.
 */
export const ZH_PINYIN_PAIR_RE = /"?\bzh"?: "((?:[^"\\]|\\.)*)",\s*"?\bpinyin"?: "((?:[^"\\]|\\.)*)"/g;

const decode = (raw) => { try { return JSON.parse(`"${raw}"`); } catch { return raw.replace(/\\"/g, '"'); } };

/** 소스 텍스트에서 {zh, pinyin} 쌍을 순서대로 수확한다(이스케이프 해제). */
export function collectZhPinyinPairs(source) {
  const out = [];
  for (const m of source.matchAll(ZH_PINYIN_PAIR_RE)) out.push({ zh: decode(m[1]), pinyin: decode(m[2]) });
  return out;
}
