import { describe, it, expect } from 'vitest';
import { getVocab } from '../../content/japanese/index';

/**
 * 병합 무결성 회귀 테스트 (Codex 요구).
 *
 * 목적: 레지스트리의 "실제 병합 결과"(getVocab('N5'))에서, 표준 JLPT 어휘와 표제어가
 *       충돌하는 신규 컬렉션(slang_core·culture_core) 카드가 '의도한 sense로' 잔존하는지 검증.
 *       mergeJaVocab은 _normJa 키가 먼저 등장한 카드를 살리고 뒤 카드를 skip하므로,
 *       충돌 표제어를 키 유일하게 재구성하지 않으면 신규 카드가 통째로 소실된다.
 *       단순 개수 검사가 아니라, 각 카드가 '존재'하고 'ko가 해당 컬렉션의 뜻'인지 확인한다.
 *
 * 병합 순서(index.js): mergeJaVocab(vocabN5, …jlptA/B/C, travelCore, slangCore, cultureCore)
 *   → 표준 일반 뜻이 먼저 seen 되므로, 신규 카드는 반드시 다른 _normJa 키를 가져야 살아남는다.
 */

const n5 = getVocab('N5');
const allWords = n5.themes.flatMap((t) => t.words);

// 정확 표제어 일치 카드 조회. 병합 후 생존 카드는 _normJa 키가 유일하므로 exact ja도 유일(0/1개).
const findCards = (ja) => allWords.filter((w) => w.ja === ja);
const findCard = (ja) => {
  const hits = findCards(ja);
  return hits.length === 1 ? hits[0] : null;
};

// (a) 카드 존재 + (b) ko가 해당 컬렉션 뜻(선행 일반 뜻이 아님)을 포함하는지 검증하는 공통 단언
function expectSurvivesWithSense({ ja, koIncludes = [], koExcludes = [] }) {
  const cards = findCards(ja);
  expect(cards.length, `표제어 「${ja}」 카드가 병합 후 정확히 1개 잔존해야 함(소실=0, 중복=2+)`).toBe(1);
  const card = cards[0];
  for (const frag of koIncludes) {
    expect(card.ko, `「${ja}」의 ko에 "${frag}"(컬렉션 고유 뜻)가 있어야 함 — 실제 ko: ${card.ko}`).toContain(frag);
  }
  for (const frag of koExcludes) {
    expect(card.ko, `「${ja}」의 ko에 "${frag}"(잘못된/구버전 서술)가 없어야 함`).not.toContain(frag);
  }
}

describe('vocab 병합 무결성 — 레지스트리 실제 병합(getVocab N5)', () => {
  it('N5 병합 결과가 themes/words 구조를 갖는다', () => {
    expect(Array.isArray(n5.themes)).toBe(true);
    expect(allWords.length).toBeGreaterThan(0);
  });

  // ── slang_core: 충돌 위험 카드 포함 대표 표제어 12개 ──
  // (이번 3차 수정 3건 중 slang 2건 + 지난 2건 ちゃうちゃう·メロい + 일반 대표 카드)
  const slangCases = [
    // [이번 수정] 寒い(춥다, n5_jlpt_a)와 충돌 → 리액션형 「寒っ」로 재구성
    { ja: '寒っ', koIncludes: ['썰렁', '다자레 리액션'] },
    // [이번 수정] 어두 オラ 생략 → 바로 위 「オラ」와의 키 충돌 해소
    { ja: '野原しんのすけ。5さいだゾ', koIncludes: ['자기소개'] },
    // 위 카드와 별개로 살아있어야 하는 일반 1인칭 「オラ」
    { ja: 'オラ', koIncludes: ['1인칭'] },
    // [지난 수정 회귀] ちゃう(축약)와 키 구분되는 방언 반복형
    { ja: 'ちゃうちゃう', koIncludes: ['아냐 아냐'] },
    // [지난 수정 회귀] メロい
    { ja: 'メロい', koIncludes: ['심쿵'] },
    // 일반 대표 카드(충돌 없음 — 컬렉션 뜻 정착 확인)
    { ja: 'やばい', koIncludes: ['대박'] },
    { ja: '推し', koIncludes: ['최애'] },
    { ja: '草', koIncludes: ['ㅋㅋ'] },
    { ja: 'ダジャレ', koIncludes: ['아재개그'] },
    { ja: 'ケツだけ星人', koIncludes: ['엉덩이'] },
    { ja: 'なんでやねん', koIncludes: ['츳코미'] },
    { ja: 'しんどい', koIncludes: ['힘들다'] },
    // [신규] 죽은 유행어 묘지 — 대표 카드(사어 톤 잔존 확인)
    { ja: 'ぴえん', koIncludes: ['死語'] },
    { ja: '蛙化現象', koIncludes: ['개구리화'] },
    { ja: 'ナウい', koIncludes: ['사어의 제왕'] },
    { ja: 'きゅんです', koIncludes: ['이타이'] },
  ];

  it.each(slangCases)('slang_core: 「$ja」 카드가 컬렉션 sense로 잔존', (c) => {
    expectSurvivesWithSense(c);
  });

  // ── culture_core: 충돌 위험 카드 포함 대표 표제어 12개 ──
  const cultureCases = [
    // [이번 수정] 鳥(새, n5_jlpt_c)와 충돌 → 가나 표제어 「とり」로 재구성(닭도리탕 어원 논쟁)
    { ja: 'とり', koIncludes: ['닭도리탕'] },
    // [이번 수정] ニンテンドー 사실 정정 — '가타카나 로고 표기' 단정 삭제
    { ja: 'ニンテンドー', koIncludes: ['발음 표기'], koExcludes: ['가타카나 로고 표기'] },
    { ja: 'スシロー', koIncludes: ['회전초밥'] },
    { ja: 'くら寿司', koIncludes: ['쿠라스시'] },
    { ja: '君の名は。', koIncludes: ['너의 이름은'] },
    { ja: '傷', koIncludes: ['기스'] },
    { ja: 'ゆとり', koIncludes: ['유도리'] },
    { ja: '根性', koIncludes: ['곤조'] },
    { ja: '無鉄砲', koIncludes: ['무데뽀'] },
    { ja: '玉ねぎ', koIncludes: ['다마네기'] },
    { ja: '山葵', koIncludes: ['와사비'] },
    { ja: 'ガチャ', koIncludes: ['가챠'] },
    // [신규] 주문의 고수 — 식당 은어 대표 카드
    { ja: 'つゆだく', koIncludes: ['규동'] },
    { ja: 'あがり', koIncludes: ['녹차'] },
    { ja: 'おあいそ', koIncludes: ['계산'] },
    { ja: '大盛り', koIncludes: ['곱빼기'] },
  ];

  it.each(cultureCases)('culture_core: 「$ja」 카드가 컬렉션 sense로 잔존', (c) => {
    expectSurvivesWithSense(c);
  });

  // ── sense 분리 증명: 충돌했던 표준 일반 뜻 카드도 자기 sense로 함께 생존해야 함 ──
  // (표제어 재구성이 '신규 카드 소실'을 '일반 카드 덮어쓰기'로 바꾼 게 아님을 확인)
  const generalCases = [
    { ja: '寒い', koIncludes: ['춥다'], koExcludes: ['썰렁'] }, // n5_jlpt_a 일반 뜻
    { ja: '鳥', koIncludes: ['새'], koExcludes: ['닭도리탕'] }, // n5_jlpt_c 일반 뜻
  ];

  it.each(generalCases)('표준 일반 뜻 「$ja」 카드도 자기 sense로 공존', (c) => {
    expectSurvivesWithSense(c);
  });

  it('충돌 해소 후 신규/일반 카드는 서로 다른 카드로 공존한다(같은 sense로 합쳐지지 않음)', () => {
    // 寒っ(리액션) ≠ 寒い(춥다)
    expect(findCard('寒っ')).not.toBeNull();
    expect(findCard('寒い')).not.toBeNull();
    expect(findCard('寒っ').ko).not.toBe(findCard('寒い').ko);
    // とり(닭도리탕) ≠ 鳥(새)
    expect(findCard('とり')).not.toBeNull();
    expect(findCard('鳥')).not.toBeNull();
    expect(findCard('とり').ko).not.toBe(findCard('鳥').ko);
    // 野原しんのすけ。5さいだゾ(자기소개) ≠ オラ(1인칭) — 어두 オラ 생략 전엔 후자에 먹혀 소실됐던 카드
    expect(findCard('野原しんのすけ。5さいだゾ')).not.toBeNull();
    expect(findCard('オラ')).not.toBeNull();
  });
});
