import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import {
  COMPREHENSION_FLOOR, LADDER_MAX_STEPS, LADDER_STEP,
  comprehensionRatio, ladderLabel, ladderMultiplier, ladderTargetCpm, nextLadderStep,
} from '../pacerLadder.js';
import { PACE_MAX_CPM, PACE_STEP_UNIT } from '../readingPacer.js';

/**
 * 계약: v2-I R1b R3 점진 상승 + 이해도 가드 (#1077 설계 §9).
 * "속도만 올라가고 이해가 무너지면 훈련이 아니라 훑기다" — Nation의 이해 70% 유지선을
 * 기구현 ReadingTest로 검사해 미달이면 되돌린다. 증거가 없으면 오르지 않는다:
 * 확인 없이 매 회 5%를 올리면 가드가 있으나 마나다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
/** 주석 제거 후 대조 — 설명 문구가 계약에 잡히지 않게(v2-L 자기함정 클래스). */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('§9 이해도 가드 — 70% 유지선', () => {
  it('Nation의 유지선을 그대로 쓴다', () => {
    expect(COMPREHENSION_FLOOR).toBe(0.7);
    expect(LADDER_STEP).toBe(0.05);
  });

  it('받쳐 주면 한 칸 오른다', () => {
    expect(nextLadderStep(0, 0.8)).toEqual({ step: 1, verdict: 'up' });
    expect(nextLadderStep(3, 1)).toEqual({ step: 4, verdict: 'up' });
    expect(nextLadderStep(0, COMPREHENSION_FLOOR)).toEqual({ step: 1, verdict: 'up' }); // 경계는 통과
  });

  it('미달이면 되돌린다 — 훑기로 굳는 걸 막는 게 이 축의 전부다', () => {
    expect(nextLadderStep(3, 0.4)).toEqual({ step: 2, verdict: 'down' });
    expect(nextLadderStep(1, 0.69)).toEqual({ step: 0, verdict: 'down' });
  });

  it('바닥에서는 되돌렸다고 말하지 않는다 — 내릴 곳이 없는데 "낮췄어요"는 거짓말', () => {
    expect(nextLadderStep(0, 0.2)).toEqual({ step: 0, verdict: 'hold' });
  });

  it('증거가 없으면 제자리 — 확인 없이 오르면 가드가 있으나 마나다', () => {
    expect(nextLadderStep(2, null)).toEqual({ step: 2, verdict: 'hold' });
    expect(comprehensionRatio({ score: 3, total: 0 })).toBeNull();
    expect(comprehensionRatio({})).toBeNull();
    expect(comprehensionRatio({ score: 4, total: 5 })).toBe(0.8);
  });

  it('상한이 있다 — 무한히 오르면 어떤 검사도 못 따라잡는 속도가 된다', () => {
    expect(nextLadderStep(LADDER_MAX_STEPS, 1)).toEqual({ step: LADDER_MAX_STEPS, verdict: 'cap' });
    expect(nextLadderStep(999, 1).step).toBe(LADDER_MAX_STEPS);
  });
});

describe('사다리는 바탕값과 분리된 축이다', () => {
  it('배수로만 얹는다 — 1.05^step', () => {
    expect(ladderMultiplier(0)).toBe(1);
    expect(ladderMultiplier(3)).toBeCloseTo(1.157625, 6);
    expect(ladderLabel(0)).toBeNull();
    expect(ladderLabel(3)).toBe('+16%');
  });

  it('바탕값에 곱한 뒤 조절 버튼과 같은 눈금에 앉는다', () => {
    expect(ladderTargetCpm(90, 0)).toBe(90);
    expect(ladderTargetCpm(90, 3)).toBe(105);          // 90 × 1.1576 = 104.2 → 105
    expect(ladderTargetCpm(90, 3) % PACE_STEP_UNIT).toBe(0);
    expect(ladderTargetCpm(PACE_MAX_CPM, 5)).toBe(PACE_MAX_CPM);
    expect(ladderTargetCpm(0, 3)).toBeNull();
  });

  it('망가진 단계는 0으로 본다 — 저장값이 오염돼도 목표가 튀지 않는다', () => {
    expect(ladderMultiplier(-3)).toBe(1);
    expect(ladderMultiplier(NaN)).toBe(1);
    expect(ladderTargetCpm(90, undefined)).toBe(90);
  });
});

describe('배선 — 사다리는 이해도 증거가 올 때만 움직인다', () => {
  const viewer = read('src/views/ViewerPage.jsx');
  const guard = codeOf(sliceBetween(viewer, 'const handleReadingTestGraded', '// ▲▼ 한 벌'));

  it('완독이 아니라 **채점** 시점에 판정한다 — 완독 순간엔 이해했는지 알 길이 없다', () => {
    expect(read('src/components/ReadingTest.jsx'))
      .toContain('onGraded?.({ score, total: questions.length });');
    expect(viewer).toContain('onGraded={handleReadingTestGraded}');
  });

  it('페이서로 읽은 회차에만 적용한다 — 자기 힘으로 읽은 이해도는 훈련 강도와 무관', () => {
    expect(guard).toContain('if (!pacedRef.current) return;');
    expect(guard.indexOf('pacedRef.current')).toBeLessThan(guard.indexOf('nextLadderStep'));
  });

  it('판정은 순수 함수가 하고 화면은 결과만 받는다', () => {
    expect(guard).toContain('nextLadderStep(paceStep, comprehensionRatio({ score, total }))');
    expect(guard).toContain('if (step !== paceStep) setPaceStep(step);');
    // 사다리 계산이 컴포넌트로 새면 두 곳의 규칙이 갈린다
    expect(guard).not.toMatch(/1\.05|\* 0\.95/);
  });

  it('오르고 내릴 때만 알린다 — 제자리·상한에 토스트를 띄우면 잔소리가 된다', () => {
    expect(guard).toContain("if (verdict === 'up')");
    expect(guard).toContain("else if (verdict === 'down')");
    expect(guard).not.toContain("verdict === 'hold'");
    expect(guard).not.toContain("verdict === 'cap'");
  });
});

describe('목표 = 바탕값 × 사다리', () => {
  const viewer = read('src/views/ViewerPage.jsx');

  it('바탕값과 사다리가 분리돼 있다 — 무엇이 올라 목표가 올랐는지 구분된다', () => {
    expect(viewer).toContain('const paceBaseCpm = paceCpm || suggestedCpm || defaultTargetCpm(materialLang);');
    expect(viewer).toContain('const paceTargetCpm = ladderTargetCpm(paceBaseCpm, paceStep) || paceBaseCpm;');
  });

  it('기본 0단계 — 옵트인한 사람도 처음엔 자기 속도에서 시작한다', () => {
    expect(read('src/lib/useViewerSettings.js')).toContain("readPref('paceStep', 0)");
  });

  it('직접 조절하면 사다리를 접는다 — 맞춘 값과 도는 값이 다르면 안 된다', () => {
    const row = sliceBetween(viewer, '{autoPace && (', "{sheetTab === 'tools'");
    expect(row).toContain('setPaceCpm(stepCpm(paceTargetCpm, -1)); setPaceStep(0);');
    expect(row).toContain('setPaceCpm(stepCpm(paceTargetCpm, 1)); setPaceStep(0);');
  });

  it('설정 화면이 훈련 단계를 밝힌다 — 0단계면 그 조각이 없다', () => {
    expect(viewer).toContain('{ladderLabel(paceStep) && <em>훈련 {ladderLabel(paceStep)}</em>}');
    expect(read('src/index.css')).toContain('.rsheet-pace__src em {');
  });
});

describe('기존 계약 유지 — R3가 앞 라운드를 깨지 않는다', () => {
  it('새 이벤트·새 테이블 0 — 이해도 신호는 ReadingTest가 이미 남기던 것', () => {
    const rt = codeOf(read('src/components/ReadingTest.jsx'));
    expect(rt).toContain("detail: { qtype: 'reading-test' },");
    expect(rt.match(/logReviewEvents\(/g)).toHaveLength(1);
    expect(read('src/lib/useReadingCompletion.js').match(/logReviewEvents\(/g)).toHaveLength(1);
  });

  it('ReadingTest는 페이서를 모른다 — 채점 결과만 알리고 판정은 호출자 몫', () => {
    const rt = codeOf(read('src/components/ReadingTest.jsx'));
    for (const banned of ['pacerLadder', 'nextLadderStep', 'paceStep', 'autoPace']) {
      expect(rt, `ReadingTest가 ${banned}를 알면 안 된다`).not.toContain(banned);
    }
  });
});
