import { describe, expect, it } from 'vitest';
import {
  EXPLAIN_TOKEN_MAX,
  buildTokenExplainPrompt,
  parseTokenExplain,
  sanitizeTokenExplain,
} from '../explainToken.js';

// 계약: 문맥 설명 R1 (오너 승인 2026-08-30 "ㄱㄱ" — 버튼형+suspect).
// 설명은 표시층(즉답 카드를 막지 않는 지연 로드), suspect는 2차 방어의 수확 신호 —
// 학습자 비노출·token_corrections 적재 전 반드시 여기 검증을 거친다(신뢰 경계).

const CTX = { sentence: '昨天下过雨。', word: '下过', base: '下过', pos: '동사' };

describe('buildTokenExplainPrompt', () => {
  it('문장·단어·현재 분석을 싣고 JSON-only를 요구한다', () => {
    const p = buildTokenExplainPrompt({ language: 'Chinese', ...CTX, base: '下雨' });
    expect(p).toContain('昨天下过雨。');
    expect(p).toContain('下过');
    expect(p).toContain('기본형 下雨');
    expect(p).toContain('품사 동사');
    expect(p).toContain('JSON만');
    expect(p).toContain('suspect');
  });

  it('기본형이 표면과 같고 품사가 없으면 단어 줄에 현재 분석 병기 생략(잡음 절감)', () => {
    const p = buildTokenExplainPrompt({ language: 'Chinese', sentence: '好。', word: '好', base: '好', pos: '' });
    expect(p).toMatch(/^단어: 好$/m); // 괄호 병기 없는 맨 단어 줄
  });
});

describe('parseTokenExplain — 관용 파싱', () => {
  it('맨 JSON·코드펜스·앞뒤 잡문 전부 수용', () => {
    const obj = { exp: '설명', suspect: null };
    expect(parseTokenExplain(JSON.stringify(obj))).toEqual(obj);
    expect(parseTokenExplain('```json\n' + JSON.stringify(obj) + '\n```')).toEqual(obj);
    expect(parseTokenExplain('답변: ' + JSON.stringify(obj) + ' 이상입니다')).toEqual(obj);
  });

  it('깨진 출력은 null(호출부가 502로 수렴)', () => {
    expect(parseTokenExplain('')).toBeNull();
    expect(parseTokenExplain(null)).toBeNull();
    expect(parseTokenExplain('그냥 문장 답변')).toBeNull();
    expect(parseTokenExplain('{"exp": 깨진')).toBeNull();
  });
});

describe('sanitizeTokenExplain — 신뢰 경계', () => {
  it('설명 없음 → null / 설명은 공백 정리·길이 캡', () => {
    expect(sanitizeTokenExplain({ exp: '' }, CTX)).toBeNull();
    expect(sanitizeTokenExplain(null, CTX)).toBeNull();
    const long = sanitizeTokenExplain({ exp: 'a  b\n c' + 'x'.repeat(1000) }, CTX);
    expect(long.explanation.startsWith('a b c')).toBe(true);
    expect(long.explanation.length).toBe(EXPLAIN_TOKEN_MAX);
  });

  it('suspect 정탐: 문장 글자로 합성 가능 + 현 기본형과 다름 → 통과', () => {
    const r = sanitizeTokenExplain(
      { exp: '여기서는 비가 왔다는 뜻', suspect: { base: '下雨', reason: '下+과경+雨의 이합사 분리형' } },
      CTX
    );
    expect(r.suspect).toEqual({ base: '下雨', reason: '下+과경+雨의 이합사 분리형' });
  });

  it('suspect 기각: 문장 밖 글자·현 기본형과 동일·과길이', () => {
    const drop = (s) => sanitizeTokenExplain({ exp: '설명', suspect: s }, CTX).suspect;
    expect(drop({ base: '吵架', reason: 'x' })).toBeNull();        // 문장에 없는 글자
    expect(drop({ base: '下过', reason: 'x' })).toBeNull();        // 현 기본형과 동일(신고 아님)
    expect(drop({ base: '昨天下过雨', reason: 'x' })).toBeNull();  // 4자 초과
    expect(drop({ base: '', reason: 'x' })).toBeNull();
    expect(drop('문자열')).toBeNull();
    // reason 캡
    const r = sanitizeTokenExplain({ exp: '설명', suspect: { base: '下雨', reason: 'r'.repeat(500) } }, CTX);
    expect(r.suspect.reason.length).toBe(120);
  });
});
