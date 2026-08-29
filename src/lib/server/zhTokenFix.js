// 서버 전용 — jieba 분할·품사 후처리 정본 (중국어 분석 개선 R1, 오너 승인 2026-08-29).
// jieba 사전에는 실단어가 아닌 병합 항목(没吵 등)과 문맥 불문 오태그(自觉/d)가 박혀 있다.
// add_word/빈도 조작은 실측으로 배제(没·吵 고빈도 주입에도 没吵는 안 깨지고, 부작용으로
// 没有→没/有·没关系→没/关系가 깨짐) — 사전을 건드리지 않고 태그 열을 후처리한다.
// 경성 사전(zhNeutralTone)과 같은 화이트리스트 계층 패턴: 등재분만 교정, 밖은 무개입.

import ZH_POS_FIX_HSK from './data/zhPosFixHsk.json';

// ① 没V 되가름 — jieba가 한 토큰으로 병합하는 没+동사 중 실단어가 아닌 것들.
//    상용 1자 동사 55종 × 캐리어 문장 전수 프로브(2026-08-29 실측)에서 병합 28종을 수확,
//    실단어인 没用(쓸모없다)만 제외한 27종. 학습자에게 没吵는 존재하지 않는 단어다 —
//    没(부사)+吵(동사)로 갈라야 단어장·만남 기록이 실제 어휘에 붙는다.
//    没有·没关系·没什么·没事·没用은 병합이 정답 — 계약 테스트가 불변을 지킨다.
export const ZH_MEI_SPLIT = new Set([
  '没吵', '没来', '没想', '没住', '没开', '没关', '没学', '没教', '没起',
  '没脱', '没洗', '没带', '没回', '没到', '没接', '没答', '没帮', '没变',
  '没换', '没作', '没读', '没画', '没飞', '没游', '没爱', '没怕', '没记',
]);

// ② HMM 우연 병합의 실측 확정분 — 사전 병합(①)이 아니라 문맥 조합이 만든 가짜 단어.
//    自觉遵守/ns(지명!?)처럼 명백한 오병합만 등재한다. 조각별 태그를 함께 적는다.
export const ZH_WORD_SPLIT = {
  自觉遵守: [['自觉', 'v'], ['遵守', 'v']],
};

// ③ 오태그 수리(POS_FIX) — jieba가 사전 차원에서 잘못 다는 단어들(문맥 불문 고정).
//    pos_all을 실으면 기존 문맥 판별기(disambiguateZhPos)가 문장에 맞는 하나를 짚고,
//    판별 실패 시 첫 후보가 폴백이다 — 겸류(vn/vd) 이음새의 재사용, 신규 경로 없음.
//    실측: 自觉→d(부사), 没→v(동사 고정 — 没问题에선 동사, 没来에선 부사), 很→zg(미지).
//    2층 구조(R3): 수제 층 아래에 HSK 3.0 대조 수확층 1,486항(zhPosFixHsk.json —
//    scripts/build-zh-hsk.mjs가 jieba 품사 계열과 HSK 품사 집합이 서로소인 충돌만
//    보수적으로 수확: 내용어 계열 한정·고유명사 제외·겸류 교집합은 일치 취급).
//    수제가 항상 이긴다.
export const ZH_POS_FIX = {
  自觉: { tag: 'v', posAll: '동사·형용사' },
  没: { tag: 'd', posAll: '부사·동사' },
  很: { tag: 'd' },
};

// x-태그 쓰레기 조각(HMM OOV)의 선두·말미 상조사(아스펙트 조사) — 过架/x → 过/ug + 架/x.
// x-조각은 정의상 실단어가 아니라 떼어내도 손실이 없다. ※ 일반 V过/V着 분리는 하지 않는다:
// 실측상 병합의 절반이 실단어다(穿过 통과하다·睡着 잠들다·接着 이어서 — 방향·결과보어 어휘).
const ASPECT_TAG = { 过: 'ug', 了: 'ul', 着: 'uz' };
const HAS_HANZI = /[一-鿿]/;

/**
 * jieba tag() 출력 후처리. 입력·출력 모두 [{ word, tag }] — 출력 항목은 선택적으로
 * posAll(품사 후보 '·' 연결)과 noPosAll(겸류 확장 억제) 플래그를 실을 수 있다.
 * 등재 밖 항목은 그대로 통과한다(실패 시 현행 수렴).
 */
export function fixZhTagged(tagged) {
  const out = [];
  for (const entry of tagged) {
    const { word, tag } = entry;
    // ① 没V 화이트리스트: 没는 뒤가 동사임이 구조로 확정 — 부사 단정(판별기 불요).
    if (ZH_MEI_SPLIT.has(word)) {
      out.push({ word: '没', tag: 'd', noPosAll: true });
      out.push({ word: word.slice(1), tag: 'v' });
      continue;
    }
    // ② HMM 오병합 화이트리스트
    if (ZH_WORD_SPLIT[word]) {
      for (const [w, t] of ZH_WORD_SPLIT[word]) out.push({ word: w, tag: t });
      continue;
    }
    // x-조각의 상조사 분리(선두 또는 말미 1자)
    if (tag === 'x' && HAS_HANZI.test(word)) {
      const chars = [...word];
      if (chars.length >= 2 && ASPECT_TAG[chars[0]]) {
        out.push({ word: chars[0], tag: ASPECT_TAG[chars[0]] });
        out.push({ word: chars.slice(1).join(''), tag: 'x' });
        continue;
      }
      if (chars.length >= 2 && ASPECT_TAG[chars[chars.length - 1]]) {
        out.push({ word: chars.slice(0, -1).join(''), tag: 'x' });
        out.push({ word: chars[chars.length - 1], tag: ASPECT_TAG[chars[chars.length - 1]] });
        continue;
      }
    }
    out.push(entry);
  }
  // ③ POS_FIX — 분할 산출물에도 적용하되, noPosAll(구조 확정) 조각은 후보 확장을 막는다.
  //    수제 층 → HSK 수확층 순으로 조회(수제 우선).
  return out.map((e) => {
    const fix = ZH_POS_FIX[e.word] ?? ZH_POS_FIX_HSK[e.word];
    if (!fix) return e;
    return {
      word: e.word,
      tag: fix.tag,
      ...(fix.posAll && !e.noPosAll ? { posAll: fix.posAll } : {}),
    };
  });
}
