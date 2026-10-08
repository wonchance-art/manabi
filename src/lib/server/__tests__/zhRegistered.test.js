import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ZH_REGISTERED_SOURCES, isZhRegisteredWord } from '../zhRegistered.js';

// AD-R4 PR② — 경계 근거로 쓰는 「등재」의 정의(설계서 docs/manabi-viewer-v2-ad-r4.md §5.1·§0.6).
// 포함: HSK 표 · 이합사 사전 · 병합 유지 목록 · 사전 행 source ∈ {user_verified, jmdict, jmdict_en}.
// 제외: source 'gemini' 행(우연 병합·한 사람의 묶음이 모두의 자동 경계가 되는 것을 막는다) ·
//       refVocab 생활 어휘(expansion.js)의 구 표제어(§2.2 — 49%가 구).
// 등재만으로 자동 묶지 않는다(§0.5 — 个人·得了도 등재다). 묶기 적용은 PR④.

describe('isZhRegisteredWord — 등재 정의', () => {
  it('HSK 표제어는 등재다 — 오병합 꼴(个人·得了·完了·多方面)도 등재라서 등재만으로는 묶지 않는다', () => {
    for (const w of ['个人', '得了', '完了', '多方面', '身体', '素质']) expect(isZhRegisteredWord(w), w).toBe(true);
  });

  it('이합사 사전과 병합 유지 목록(HSK 표의 구멍 这个류)도 등재다', () => {
    expect(isZhRegisteredWord('道歉')).toBe(true);   // zhSeparable.json
    expect(isZhRegisteredWord('熬夜')).toBe(true);   // zhSeparableHsk.json
    expect(isZhRegisteredWord('这个')).toBe(true);   // ZH_KEEP_MERGED
    expect(isZhRegisteredWord('扫码')).toBe(true);
  });

  it('gemini 사전 행만 있는 꼴은 미등재다 — 우연 병합(笔在·这宗)·사용자 묶음이 쌓이는 자리', () => {
    for (const w of ['笔在', '这宗', '身体素质']) {
      expect(isZhRegisteredWord(w), w).toBe(false);
      expect(isZhRegisteredWord(w, { source: 'gemini' }), w).toBe(false);
    }
  });

  it('user_verified·jmdict·jmdict_en 행이 있으면 등재다', () => {
    expect([...ZH_REGISTERED_SOURCES].sort()).toEqual(['jmdict', 'jmdict_en', 'user_verified']);
    for (const source of ZH_REGISTERED_SOURCES) expect(isZhRegisteredWord('身体素质', { source }), source).toBe(true);
    expect(isZhRegisteredWord('身体素质', { source: 'snapshot' })).toBe(false);
    expect(isZhRegisteredWord('身体素质', null)).toBe(false);
  });

  it('refVocab 생활 어휘의 구 표제어는 미등재다(학습 표제어로는 맞지만 경계 근거로는 넓다)', () => {
    const expansion = readFileSync(new URL('../../../content/chinese/vocab/expansion.js', import.meta.url), 'utf8');
    for (const w of ['交通卡余额', '国际转机', '垃圾分类']) {
      expect(expansion, `${w}는 생활 어휘 표제어`).toContain(`zh: "${w}"`);
      expect(isZhRegisteredWord(w), w).toBe(false);
    }
  });

  it('빈 값·비문자열은 미등재', () => {
    for (const w of ['', null, undefined, 3]) expect(isZhRegisteredWord(w)).toBe(false);
  });
});
