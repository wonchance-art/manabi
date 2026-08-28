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
  it('오너 확정 표 그대로 — 몰입/학습/암기 3장, 표시 4키만 다룬다(조판 불가침)', () => {
    expect(READING_PRESETS).toEqual({
      immerse: { pronDisplay: 'none',    wordStateHl: false, focusMode: true,  showToneColors: false },
      study:   { pronDisplay: 'all',     wordStateHl: true,  focusMode: false, showToneColors: true },
      recall:  { pronDisplay: 'unknown', wordStateHl: true,  focusMode: false, showToneColors: false },
    });
    for (const p of Object.values(READING_PRESETS)) {
      expect(Object.keys(p).sort()).toEqual(['focusMode', 'pronDisplay', 'showToneColors', 'wordStateHl']);
    }
  });

  it('PRESET_META는 프리셋과 1:1 — 카드만 있고 정의가 없는(또는 그 반대) 프리셋 금지', () => {
    expect(PRESET_META.map(m => m.key).sort()).toEqual(Object.keys(READING_PRESETS).sort());
    for (const m of PRESET_META) {
      expect(m.name).toBeTruthy();
      expect(m.desc).toBeTruthy();
    }
  });

  it('presetActive — 정확 일치만 활성, 한 키만 틀어져도 꺼진다', () => {
    expect(presetActive('immerse', { pronDisplay: 'none', wordStateHl: false, focusMode: true, showToneColors: false })).toBe(true);
    // 프리셋 밖 키(조판 등)는 판정에 끼지 않는다
    expect(presetActive('immerse', { pronDisplay: 'none', wordStateHl: false, focusMode: true, showToneColors: false, fontSize: 2 })).toBe(true);
    expect(presetActive('immerse', { pronDisplay: 'all', wordStateHl: false, focusMode: true, showToneColors: false })).toBe(false);
    expect(presetActive('없는프리셋', { pronDisplay: 'none' })).toBe(false);
    expect(presetActive('immerse', undefined)).toBe(false);
  });
});
