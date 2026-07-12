import { describe, it, expect } from 'vitest';
import { createVoiceUnreachableNotifier } from '../voiceNotify';

// Codex 검수(#81 P2) 회귀 — listener-only 포함 1회 안내·반복 억제·회복 후 재무장
describe('createVoiceUnreachableNotifier', () => {
  it('voice-unreachable에서 1회만 true (micOn 무관 — status 인자만 받는 계약)', () => {
    const notify = createVoiceUnreachableNotifier();
    expect(notify('voice-unreachable')).toBe(true);
  });

  it('같은 실패 상태 반복 emit은 추가 안내 없음', () => {
    const notify = createVoiceUnreachableNotifier();
    expect(notify('voice-unreachable')).toBe(true);
    expect(notify('voice-unreachable')).toBe(false);
    expect(notify('voice-unreachable')).toBe(false);
  });

  it('회복(voice-ready 등) 뒤 재실패는 다시 1회 안내', () => {
    const notify = createVoiceUnreachableNotifier();
    expect(notify('voice-unreachable')).toBe(true);
    expect(notify('voice-ready')).toBe(false);
    expect(notify('voice-unreachable')).toBe(true);
  });

  it('정상 상태만 흐르면 안내 없음', () => {
    const notify = createVoiceUnreachableNotifier();
    expect(notify('voice-ready')).toBe(false);
    expect(notify('connecting')).toBe(false);
    expect(notify(undefined)).toBe(false);
  });
});
