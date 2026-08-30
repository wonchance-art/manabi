// 서버 전용 — jieba 분할·품사 후처리 정본 (중국어 분석 개선 R1, 오너 승인 2026-08-29).
// jieba 사전에는 실단어가 아닌 병합 항목(没吵 등)과 문맥 불문 오태그(自觉/d)가 박혀 있다.
// add_word/빈도 조작은 실측으로 배제(没·吵 고빈도 주입에도 没吵는 안 깨지고, 부작용으로
// 没有→没/有·没关系→没/关系가 깨짐) — 사전을 건드리지 않고 태그 열을 후처리한다.
// 경성 사전(zhNeutralTone)과 같은 화이트리스트 계층 패턴: 등재분만 교정, 밖은 무개입.

import ZH_POS_FIX_HSK from './data/zhPosFixHsk.json';
import ZH_SEPARABLE_HAND from './data/zhSeparable.json';
import ZH_SEPARABLE_HSK from './data/zhSeparableHsk.json';

// 이합사 사전 2층(대량 조달 — 오너 승인 2026-08-30): 수제 55(정본·선별) + 공식 HSK
// ∥ 분철 마커 수확 478(scripts/build-zh-hsk.mjs ③ — 국제중문교육 등급표준의 이합사
// 표기, RFC 1순위 Wiktionary는 프록시 정책 차단 실측으로 대체). 값이 전부 1이라
// 우선순위는 무의미하지만 관례대로 수제를 뒤에 편다(경성·POS_FIX 2층과 동형).
const ZH_SEPARABLE = { ...ZH_SEPARABLE_HSK, ...ZH_SEPARABLE_HAND };

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
//    谢谢·安静→nr(인명!)은 고유명사 태그 사각(실문장 스모크 2026-08-29): 스모크 시점에는
//    자동 교정 경로가 없어 수제로 수리했고, 이후 R5가 사각 우주를 체계 수확했다(수제 유지).
//    2층 구조(R3+R5): 수제 층 아래에 HSK 3.0 대조 수확층(zhPosFixHsk.json —
//    scripts/build-zh-hsk.mjs가 jieba 품사 계열과 HSK 품사 집합이 서로소인 충돌만
//    보수적으로 수확: 내용어 계열 한정·겸류 교집합은 일치 취급. 고유명사류 태그는
//    CEDICT 대문자 판별자로 갈라 진짜 고유명사만 존중 — R5, 明白/nr·星星/nz류 수확).
//    수제가 항상 이긴다.
export const ZH_POS_FIX = {
  自觉: { tag: 'v', posAll: '동사·형용사' },
  没: { tag: 'd', posAll: '부사·동사' },
  很: { tag: 'd' },
  谢谢: { tag: 'v' },
  安静: { tag: 'a', posAll: '형용사·동사' }, // HSK Adj/V — 판별기가 문장에 맞는 쪽을 짚는다
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
    // x-조각의 상조사 분리(선두 또는 말미 1자) + 양사 个 꼬리 분리(R4a-C: 帮个/x → 帮+个)
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
      if (chars.length >= 2 && chars[chars.length - 1] === '个') {
        out.push({ word: chars.slice(0, -1).join(''), tag: 'x' });
        out.push({ word: '个', tag: 'q' });
        continue;
      }
    }
    out.push(entry);
  }
  // ③ 이합사 인지(R4a) — base_form만 합류, 표면·분할·병음 불변. POS_FIX보다 먼저:
  //    감지는 jieba의 문맥 태그(구조 신호)를 기준으로 한다. POS_FIX는 표시용 기본값
  //    교정이라 뒤집힌 태그가 감지를 막으면 안 된다(실측: 干了一杯의 干/v를 HSK
  //    수확층이 a로 뒤집어 B가 불발 — 순서로 해소).
  const marked = markZhSeparable(out);
  // ④ POS_FIX — 분할 산출물에도 적용하되, noPosAll(구조 확정) 조각은 후보 확장을 막는다.
  //    수제 층 → HSK 수확층 순으로 조회(수제 우선). baseForm(③)은 통과 보존.
  return marked.map((e) => {
    const fix = ZH_POS_FIX[e.word] ?? ZH_POS_FIX_HSK[e.word];
    if (!fix) return e;
    return {
      word: e.word,
      tag: fix.tag,
      ...(fix.posAll && !e.noPosAll ? { posAll: fix.posAll } : {}),
      ...(e.baseForm ? { baseForm: e.baseForm } : {}),
    };
  });
}

// ── 이합사(离合词) 인지 — rfc-zh-separable-verbs §4 (오너 승인 R4a: A+B, 수동 시드) ──
// 이합사 삽입형(吵过架·吵了一架)에서 저장·만남·FSRS가 조각(吵)에 붙어 실제 어휘(吵架)로
// 쌓이지 않는 순환 단절을 base_form 재지정만으로 잇는다(저장 키 '기본형 우선' 규약 —
// vocabIO.normalizeWordText — 재사용, fr 굴절 §4.8과 같은 모형). "base_form = 표면형"
// 계약의 첫 명시 예외. 사전 밖·패턴 밖은 전부 무개입(실패 시 현행 수렴).
// V 후보 태그: v-계열 + 실측 확장 — x(C가 되가른 조각 帮), f(上/下 방위사 기본값, 上了课),
// n(理·照의 고립 명사 기본값, 理了发·照了一张相), m(点의 고립 양사 기본값, 点了几个菜).
// 사전 가입 + 회랑 화이트리스트가 실질 게이트라 태그 확장의 오탐 여지는 시드 V 글자로 갇힌다.
const SEP_V_TAGS = new Set(['v', 'vn', 'vd', 'x', 'f', 'n', 'm']);
const SEP_MID_OK = (tag) => /^u/.test(tag) || tag === 'm' || tag === 'q' || tag === 'mq';
const NUM_HEAD = /^[一二两三四五六七八九十几半]/; // 一觉/d처럼 오태그된 양사구 캐리어 구제

function markZhSeparable(entries) {
  return entries.map((e, i) => {
    const chars = [...e.word];
    // A. 통짜 삽입형(洗过澡/v — jieba 사전 등재): V+상조사+O 3자 → base만 VO로.
    if (chars.length === 3 && ASPECT_TAG[chars[1]]) {
      const vo = chars[0] + chars[2];
      if (ZH_SEPARABLE[vo]) return { ...e, baseForm: vo };
    }
    // B. 분리형 회랑: V 클러스터 뒤 3토큰 이내의 O — O는 단독 토큰이거나 수량구 캐리어
    //    (一架/m·一觉/d 오태그·一阵风/l 융합 구제)의 말미 글자. 회랑의 사이 토큰은 전부
    //    조사·수량구 화이트리스트여야 하고, 밖을 만나면 즉시 중단(오탐 방지 — 我吵他架·
    //    穿过马路 불변). V 클러스터는 1자 V 또는 V+상조사 2자 병합 토큰(下过/v·刮过/v가
    //    jieba 사전에 통째 등재된 실측 — 오너 보고 下过雨) — 후자는 조각의 base만 VO로
    //    간다(표면·분할 불변, x가 아니라 R1 되가름 대상도 아니다: 실단어 穿过·睡着 보호).
    //    ※ 창 3은 실측 보정: jieba가 수량구를 융합하면(吵了一架) O가 +2에, 융합하지
    //    않으면(抽了 一根 烟·结过 一次 婚) +3에 온다. O 토큰은 건드리지 않는다
    //    (한 만남 = 한 단어, 이중 계상 방지).
    const vChar = SEP_V_TAGS.has(e.tag)
      ? chars.length === 1 ? e.word
        : chars.length === 2 && ASPECT_TAG[chars[1]] ? chars[0]
          : null
      : null;
    if (vChar) {
      for (let j = i + 1; j <= i + 3 && j < entries.length; j++) {
        const t = entries[j];
        const oc = [...t.word];
        const o = oc.length === 1 ? t.word
          : oc.length <= 4 && (t.tag === 'm' || t.tag === 'q' || t.tag === 'mq' || NUM_HEAD.test(t.word))
            ? oc[oc.length - 1] : null; // ≤4: 一会儿天/m처럼 수량구+O 통짜 융합 실측
        if (o && ZH_SEPARABLE[vChar + o]) return { ...e, baseForm: vChar + o };
        if (!SEP_MID_OK(t.tag)) break;
      }
    }
    return e;
  });
}
