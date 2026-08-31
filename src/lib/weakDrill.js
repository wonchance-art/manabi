/**
 * 유형 큐 — 약한 회상 방식으로 바로 들어가는 처방 (v2-A R3, 설계 §3-3).
 *
 * ── 왜 이게 R3의 전부인가 (착수 실측)
 *
 * 설계는 R3을 「신규 화면」으로 뒀지만 실측하면 **화면은 필요 없다**:
 *  · `confusedQueue`도 화면이 아니라 VocabPage의 **한 줄 진입 버튼**이다(「⚔ 헷갈린 말」).
 *  · 복습 방식 선택(`reviewMode`)이 이미 `auto|flash|typing|context|listening`으로 있다 —
 *    "듣기로만 복습"은 원래 가능했고, 사용자가 **스스로 알아내 드롭다운을 바꿔야** 했을 뿐이다.
 * ⇒ 빠져 있던 건 기능이 아니라 **진단과 행동 사이의 다리**다. R1이 "듣고 쓰기가 약하다"를
 *   말하고(ProfileStats) R2가 그걸 편성에 반영했지만, 사용자가 한 번에 그 연습으로
 *   들어갈 길이 없었다. 이 모듈이 그 한 걸음이다.
 *
 * 설계가 함께 넣자던 v1-7(성조 듣기)은 **구현체가 없다**(실측: 성조는 표시·채점 폴딩·TTS
 * 음색에만 존재). 합류할 대상이 없어 이 라운드에서 뺀다.
 */

import { confusedVocabWords, CONFUSED_MIN } from './confusedQueue';
import { splitTag } from './errorTags';

/**
 * 회상 방식 축 → 단어 복습 방식 **허용 목록**.
 *
 * 1:1로 떨어지는 둘만 넣는다. `choice`·`cloze`·`fill`을 '문맥'에 억지로 붙이면 진단과
 * 처방이 어긋나고(고른 문제에 약한데 문맥 빈칸을 준다), `order`·`match`·`produce`는
 * 단어 복습에 대응물이 아예 없다. 모르는 것은 조용한 쪽으로 떨어뜨린다 — 이 줄이
 * 안 뜰 뿐 화면은 그대로다(RETRIEVAL_LABELS를 허용 목록으로 짠 것과 같은 결).
 */
export const DRILLABLE_MODES = Object.freeze({
  typing: 'typing',
  listening: 'listening',
});

/**
 * 약점 프로파일 → 지금 권할 연습 하나.
 *
 * 프로파일은 이미 점수 내림차순이므로 **처방 가능한 첫 축**이 곧 1순위다.
 * 낼 것이 없으면 null — 표본 미달이면 침묵(설계 §1 P3).
 *
 * @param {Array<{tag,wrong,total}>} profile weaknessProfile 산출
 * @param {object} [opts]
 * @param {boolean} [opts.ttsSupported] 듣기는 TTS가 없으면 처방할 수 없다
 * @returns {{mode:string, tag:string, wrong:number, total:number}|null}
 */
export function weakDrillPrescription(profile, { ttsSupported = true } = {}) {
  for (const w of profile || []) {
    const parts = splitTag(w.tag);
    if (parts?.axis !== 'retrieval') continue;
    const mode = DRILLABLE_MODES[parts.value];
    if (!mode) continue;
    if (mode === 'listening' && !ttsSupported) continue;
    return { mode, tag: w.tag, wrong: w.wrong, total: w.total };
  }
  return null;
}

/**
 * 그 방식에서 틀린 단어들 — 큐의 내용물.
 *
 * 세는 일은 `confusedVocabWords` **정본에 맡긴다**. 이벤트를 그 방식으로 먼저 거르고
 * 넘길 뿐이라 14일 창·오답 가중·최소 표본이 헷갈린 말 큐와 같은 규약을 쓴다.
 * 여기서 따로 세면 두 큐가 서로 다른 '헷갈림'을 말하게 된다.
 *
 * @param {Array} events review_events 행(detail.qtype 필요)
 * @param {Array} vocabRows 단어장 행
 * @param {string} mode DRILLABLE_MODES 값
 */
export function weakDrillWords(events, vocabRows, mode, opts = {}) {
  if (!mode) return [];
  const ofMode = (events || []).filter((e) => e?.detail?.qtype === mode);
  return confusedVocabWords(ofMode, vocabRows, opts);
}

/** 큐를 띄울 만한가 — 헷갈린 말 큐와 같은 하한(1개짜리 '약점'은 잡음이다). */
export function hasWeakDrill(words) {
  return (words || []).length >= CONFUSED_MIN;
}
