import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { weakDrillPrescription, weakDrillWords, hasWeakDrill, DRILLABLE_MODES } from '../weakDrill';
import { weaknessProfile } from '../weaknessProfile';
import { CONFUSED_MIN } from '../confusedQueue';

/**
 * 계약: v2-A R3 — 유형 큐 (오너 "A R3 ㄱㄱ").
 *
 * 착수 실측이 라운드를 줄였다. 설계는 R3을 「신규 화면」으로 뒀지만:
 *  · `confusedQueue`도 화면이 아니라 VocabPage의 한 줄 진입 버튼이다.
 *  · `reviewMode`가 이미 auto|flash|typing|context|listening으로 존재한다 —
 *    "듣기로만 복습"은 원래 가능했고 사용자가 스스로 드롭다운을 바꿔야 했을 뿐이다.
 *  · 함께 넣자던 v1-7(성조 듣기)은 **구현체가 없다**(성조는 표시·채점 폴딩·TTS 음색뿐).
 * ⇒ 빠진 것은 기능이 아니라 **진단(R1)과 행동 사이의 다리**였다. 이 계약이 지키는 것도
 *   그 다리의 요구다 — 새 화면이나 새 카운터가 아니다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const ev = (qtype, key, correct, daysAgo = 1) => ({
  source: 'vocab', item_key: key, correct,
  detail: { qtype },
  created_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
});

describe('A R3 — 처방 고르기', () => {
  it('처방 가능한 방식만 고른다 — 애매한 축은 조용히 빠진다', () => {
    // 고르기가 아무리 약해도 단어 복습에 1:1 대응물이 없다. 억지로 '문맥'에 붙이면
    // 진단과 처방이 어긋난다(고른 문제에 약한데 빈칸을 준다).
    const onlyChoice = weaknessProfile([
      ev('choice', 'a', false), ev('choice', 'b', false), ev('choice', 'c', true),
    ]);
    expect(weakDrillPrescription(onlyChoice)).toBeNull();

    const typing = weaknessProfile([
      ev('typing', 'a', false), ev('typing', 'b', false), ev('typing', 'c', true),
    ]);
    expect(weakDrillPrescription(typing)?.mode).toBe('typing');
  });

  it('허용 목록은 둘뿐 — 새 방식은 명시적으로 들어와야 한다', () => {
    expect(Object.keys(DRILLABLE_MODES).sort()).toEqual(['listening', 'typing']);
  });

  it('듣기는 TTS가 없으면 처방하지 않는다 — 낼 수 없는 처방은 처방이 아니다', () => {
    const profile = weaknessProfile([
      ev('listening', 'a', false), ev('listening', 'b', false), ev('listening', 'c', true),
    ]);
    expect(weakDrillPrescription(profile, { ttsSupported: true })?.mode).toBe('listening');
    expect(weakDrillPrescription(profile, { ttsSupported: false })).toBeNull();
  });

  it('TTS가 없어도 다음 순위로 넘어간다 — 듣기 하나에 막혀 침묵하지 않는다', () => {
    // 듣기가 1위, 타이핑이 2위인 프로파일. TTS가 없으면 타이핑을 권해야 한다.
    const profile = weaknessProfile([
      ev('listening', 'a', false), ev('listening', 'b', false), ev('listening', 'c', false),
      ev('typing', 'd', false), ev('typing', 'e', false), ev('typing', 'f', true), ev('typing', 'g', true),
    ]);
    expect(weakDrillPrescription(profile, { ttsSupported: true })?.mode).toBe('listening');
    expect(weakDrillPrescription(profile, { ttsSupported: false })?.mode).toBe('typing');
  });

  it('약점이 없으면 침묵한다 — 게스트·신규 무해', () => {
    expect(weakDrillPrescription([])).toBeNull();
    expect(weakDrillPrescription(null)).toBeNull();
    // 다 맞힌 사람에게 "약해요"는 거짓말이다.
    expect(weakDrillPrescription(weaknessProfile([ev('typing', 'a', true)]))).toBeNull();
  });
});

describe('A R3 — 큐 내용물', () => {
  const vocabRows = ['a', 'b', 'c'].map((w) => ({ id: w, word_text: w, meaning: `뜻-${w}` }));

  it('그 방식에서 틀린 말만 모은다', () => {
    const events = [
      ev('typing', 'a', false), ev('typing', 'a', false),
      ev('listening', 'b', false), ev('listening', 'b', false),
    ];
    const typed = weakDrillWords(events, vocabRows, 'typing').map((c) => c.word.word_text);
    expect(typed).toContain('a');
    expect(typed, '다른 방식에서 틀린 말이 섞이면 유형 큐가 아니다').not.toContain('b');
  });

  it('세는 일은 헷갈린 말 정본에 맡긴다 — 두 큐가 같은 헷갈림을 말해야 한다', () => {
    // 정본이 세고, 우리는 거르기만 한다. 소스가 vocab이 아니면 정본이 알아서 버린다.
    const notVocab = weakDrillWords(
      [{ ...ev('typing', 'a', false), source: 'grammar' }], vocabRows, 'typing',
    );
    expect(notVocab).toEqual([]);
  });

  it(`하한 ${CONFUSED_MIN} — 한 개짜리 '약점'은 잡음이라 줄을 띄우지 않는다`, () => {
    // **정확히 1개**가 담기는 경우여야 하한이 드러난다. 빈 배열로 검사하면 하한이
    // 있으나 없으나 false라 공허하다(A R2에서 같은 함정을 돌연변이로 실측했다).
    const one = weakDrillWords(
      [ev('typing', 'a', false), ev('typing', 'a', false)], vocabRows, 'typing',
    );
    expect(one, '픽스처가 1개를 담아야 이 검사가 성립한다').toHaveLength(1);
    expect(hasWeakDrill(one)).toBe(false);

    const two = weakDrillWords(
      [ev('typing', 'a', false), ev('typing', 'a', false),
        ev('typing', 'b', false), ev('typing', 'b', false)], vocabRows, 'typing',
    );
    expect(two).toHaveLength(2);
    expect(hasWeakDrill(two)).toBe(true);
  });

  it('mode가 없으면 빈 배열 — 처방 없이 큐만 뜨는 일은 없다', () => {
    expect(weakDrillWords([ev('typing', 'a', false)], vocabRows, null)).toEqual([]);
  });
});

describe('A R3 — 배선', () => {
  const page = () => read('src/views/VocabPage.jsx');

  it('자기 조회를 파지 않는다 — 헷갈린 말 큐가 쓰는 배열을 그대로 쓴다', () => {
    // 요구는 "조회 총량 불변"이지 특정 개수가 아니다. (실측: 이 페이지엔 원래
    // review_events 조회가 둘이다 — 페이지 로드용 confused-events와, startSession 안의
    // 1회성 rung 유도. 유형 큐는 그중 앞엣것을 **재사용**한다.)
    const src = page();
    expect(src, 'qtype를 보려면 detail이 필요하다')
      .toContain("'source, item_key, correct, created_at, detail'");
    // 새 쿼리 키가 없다 = 왕복이 늘지 않았다.
    expect(src).not.toMatch(/queryKey:\s*\[\s*'weak-drill/);
    // 처방·큐 모두 기존 배열에서 나온다.
    expect(src).toContain('weakDrillPrescription(weaknessProfile(recentVocabEvents)');
    expect(src).toContain('weakDrillWords(recentVocabEvents, vocab, pick.mode)');
  });

  it('누르면 그 방식으로 고정하고 연다 — 드롭다운을 찾게 두지 않는다', () => {
    const src = page();
    expect(src).toContain('setReviewMode(weakDrill.mode)');
    expect(src).toContain('startSession(weakDrill.words.map');
  });

  it('처방이 없으면 줄 자체가 없다', () => {
    expect(page()).toMatch(/\{weakDrill && \(/);
  });
});
