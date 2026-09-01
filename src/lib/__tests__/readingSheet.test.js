import { describe, expect, it } from 'vitest';
import { TTS_RATES, ttsOptsFor, pronHiddenFor, READING_PRESETS, PRESET_META, presetActive } from '../readingSheet.js';

// 계약: 읽기 설정 시트 캐논(오너 확정 2026-08-27) — 값 체계가 흔들리면 시트 UI가 아니라
// 여기가 먼저 빨간불이 들어와야 한다.

describe('말하기 속도', () => {
  it('normal의 web = 0.85 — 현행 utter.rate 기본값 보존(속도 기능 도입이 기존 소리를 바꾸면 안 된다)', () => {
    expect(TTS_RATES.normal.web).toBe(0.85);
    expect(TTS_RATES.normal.server).toBe(1); // 서버 고품질 음성은 원음이 보통
  });

  it('slow < normal < fast — 두 경로 모두 단조', () => {
    expect(TTS_RATES.slow.server).toBeLessThan(TTS_RATES.normal.server);
    expect(TTS_RATES.normal.server).toBeLessThan(TTS_RATES.fast.server);
    expect(TTS_RATES.slow.web).toBeLessThan(TTS_RATES.normal.web);
    expect(TTS_RATES.normal.web).toBeLessThan(TTS_RATES.fast.web);
  });

  it('ttsOptsFor — speak 옵션 서명(rate=web, playbackRate=server), 미지 키는 normal 수렴', () => {
    expect(ttsOptsFor('slow')).toEqual({ playbackRate: TTS_RATES.slow.server, rate: TTS_RATES.slow.web });
    expect(ttsOptsFor('없는키')).toEqual({ playbackRate: 1, rate: 0.85 });
    expect(ttsOptsFor(undefined)).toEqual({ playbackRate: 1, rate: 0.85 });
  });
});

describe('발음 표기 3단 — pronHiddenFor', () => {
  it("'none'은 무조건 감춘다", () => {
    expect(pronHiddenFor('none', { isKnown: false, isSaved: false })).toBe(true);
    expect(pronHiddenFor('none', { isKnown: true, isSaved: true })).toBe(true);
  });

  it("'all'과 미지 값은 무조건 보인다 — 전체 표시가 안전 기본", () => {
    expect(pronHiddenFor('all', { isKnown: true, isSaved: true })).toBe(false);
    expect(pronHiddenFor('이상한값', { isKnown: true, isSaved: true })).toBe(false);
    expect(pronHiddenFor(undefined, {})).toBe(false);
  });

  it("'unknown'(모르는 단어만) 실시맨틱 — 아는 단어·담은 단어를 감추고, 신규·만남에는 크러치 유지", () => {
    expect(pronHiddenFor('unknown', { isKnown: true, isSaved: false })).toBe(true);
    expect(pronHiddenFor('unknown', { isKnown: false, isSaved: true })).toBe(true); // 담은 단어 = 능동 회상
    expect(pronHiddenFor('unknown', { isKnown: false, isSaved: false })).toBe(false); // 신규·만남
    expect(pronHiddenFor('unknown')).toBe(false); // 인자 생략 = 미지 토큰 = 보인다
  });
});

describe('읽기 모드 프리셋', () => {
  // 이 계약은 처음에 표 전체를 toEqual로 얼리고 키 목록까지 못 박아, v1-4가 표시 축을
  // 하나 늘리자(pronReveal) **정당한 변경에서 깨졌다**. 요구는 「4키」가 아니라
  // ⑴ 프리셋은 셋 ⑵ 각 프리셋의 표시 의도는 오너 확정값 ⑶ **조판은 불가침**이다.
  // 구현 모양이 아니라 그 셋을 잡도록 고쳐 쓴다.
  it('몰입/학습/암기 3장 — 오너 확정 표시값 그대로', () => {
    expect(Object.keys(READING_PRESETS).sort()).toEqual(['immerse', 'recall', 'study']);
    expect(READING_PRESETS.immerse).toMatchObject({ pronDisplay: 'none',    wordStateHl: false, focusMode: true,  showToneColors: false });
    expect(READING_PRESETS.study).toMatchObject({   pronDisplay: 'all',     wordStateHl: true,  focusMode: false, showToneColors: true });
    expect(READING_PRESETS.recall).toMatchObject({  pronDisplay: 'unknown', wordStateHl: true,  focusMode: false, showToneColors: false });
  });

  it('조판은 불가침 — 프리셋은 표시 의도만 바꾼다', () => {
    // 새 표시 키(pronReveal 같은)는 자유롭게 붙되, 글자·배경·행간에는 손대지 않는다.
    const TYPESETTING = ['fontSize', 'lineGap', 'charGap', 'theme', 'fontFamily'];
    for (const [name, p] of Object.entries(READING_PRESETS)) {
      for (const k of TYPESETTING) {
        expect(Object.keys(p), `${name} 프리셋이 조판 키 ${k}를 건드린다`).not.toContain(k);
      }
      // 프리셋끼리 키 집합이 갈리면 전환할 때 이전 프리셋의 값이 남는다.
      expect(Object.keys(p).sort()).toEqual(Object.keys(READING_PRESETS.immerse).sort());
    }
  });

  it('PRESET_META는 프리셋과 1:1 — 카드만 있고 정의가 없는(또는 그 반대) 프리셋 금지', () => {
    expect(PRESET_META.map(m => m.key).sort()).toEqual(Object.keys(READING_PRESETS).sort());
    for (const m of PRESET_META) {
      expect(m.name).toBeTruthy();
      expect(m.desc).toBeTruthy();
    }
  });

  // 손으로 적은 설정 사본을 쓰면 프리셋에 키가 하나 늘 때마다 이 단언이 같이 깨진다
  // (v1-4의 pronReveal에서 실제로 깨졌다). 프리셋 자신을 기준으로 삼고, 대신 **전 키를
  // 하나씩 틀어** 원래 요구("한 키만 틀어져도 꺼진다")를 더 넓게 확인한다.
  it('presetActive — 정확 일치만 활성, 한 키만 틀어져도 꺼진다', () => {
    const exact = { ...READING_PRESETS.immerse };
    expect(presetActive('immerse', exact)).toBe(true);
    // 프리셋 밖 키(조판 등)는 판정에 끼지 않는다
    expect(presetActive('immerse', { ...exact, fontSize: 2 })).toBe(true);
    for (const k of Object.keys(exact)) {
      expect(presetActive('immerse', { ...exact, [k]: '틀어진값' }), `${k}가 틀어졌는데 활성`).toBe(false);
      const { [k]: _dropped, ...missing } = exact;
      expect(presetActive('immerse', missing), `${k}가 없는데 활성`).toBe(false);
    }
    expect(presetActive('없는프리셋', { pronDisplay: 'none' })).toBe(false);
    expect(presetActive('immerse', undefined)).toBe(false);
  });
});
