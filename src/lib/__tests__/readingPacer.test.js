import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import {
  DEFAULT_TARGET_CPM, FALLBACK_TARGET_CPM, PACE_MAX_CPM, PACE_MAX_MS, PACE_MIN_CPM, PACE_MIN_MS,
  clampCpm, defaultTargetCpm, dwellMs, paceHint, secondsOf, stepCpm,
} from '../readingPacer.js';

/**
 * 계약: v2-I R1b 자동 진행(페이서) (#1077 설계 §4~§10, 오너 착수 승인 2026-08-30 "I-b ㄱㄱ").
 * 설계 §10 중 I-b 해당분: ⑤ `moveSentence(1)`만 호출 ⑥ 정지 규칙 5종·별도 ▶/■ 버튼 금지
 * ⑦ 체류 하한 1.2초·상한 20초·경계 자동 정지 ⑧ `paced:true` 기록 ⑨ 진행 선은 지정
 * 문장에만·모션 축소 대체 ⑩ 집중 모드 OFF·지정 없음이면 미발동.
 * (측정 쪽 계약 ①~④는 readingTimer.test.js가 이미 지킨다.)
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
/** 주석 제거 후 대조 — 설명 문구가 계약에 잡히지 않게(v2-L 자기함정 클래스). */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('§4 체류 시간 — 고정 초가 아니라 글자수 ÷ 목표 속도', () => {
  it('글자수에 비례한다 — 90자/분이면 14자에 9.3초, 9자에 6초', () => {
    expect(dwellMs({ chars: 14, targetCpm: 90 })).toBe(9333);
    expect(dwellMs({ chars: 9, targetCpm: 90 })).toBe(6000);
    // 같은 문장도 목표가 빨라지면 짧아진다
    expect(dwellMs({ chars: 14, targetCpm: 180 })).toBe(4667);
  });

  it('⑦ 하한 1.2초·상한 20초로 자른다 — 눈이 닿기 전에 넘어가거나 멈춘 줄 알게 되는 구간', () => {
    expect(PACE_MIN_MS).toBe(1200);
    expect(PACE_MAX_MS).toBe(20000);
    expect(dwellMs({ chars: 1, targetCpm: 400 })).toBe(PACE_MIN_MS);   // 0.15초 → 하한
    expect(dwellMs({ chars: 400, targetCpm: 90 })).toBe(PACE_MAX_MS);  // 4.4분 → 상한
  });

  it('글자수·목표가 없으면 null — 호출자는 페이서를 켜지 않는다', () => {
    expect(dwellMs({ chars: 0, targetCpm: 90 })).toBeNull();
    expect(dwellMs({ chars: 14, targetCpm: 0 })).toBeNull();
    expect(dwellMs({ chars: null, targetCpm: 90 })).toBeNull();
  });
});

describe('목표 속도 — 언어별 기본값과 조절', () => {
  it('CJK는 낮게, 라틴은 높게 — 한 글자가 담는 정보량이 달라 같은 수를 쓸 수 없다', () => {
    expect(defaultTargetCpm('Chinese')).toBeLessThan(defaultTargetCpm('English'));
    expect(defaultTargetCpm('Japanese')).toBeLessThan(defaultTargetCpm('French'));
    expect(defaultTargetCpm('Klingon')).toBe(FALLBACK_TARGET_CPM);
    for (const cpm of Object.values(DEFAULT_TARGET_CPM)) {
      expect(cpm).toBeGreaterThanOrEqual(PACE_MIN_CPM);
      expect(cpm).toBeLessThanOrEqual(PACE_MAX_CPM);
    }
  });

  it('조절은 곱셈(±10%) — 90과 400을 같은 증분으로 움직이면 한쪽이 무의미해진다', () => {
    expect(stepCpm(90, 1)).toBe(100);
    expect(stepCpm(90, -1)).toBe(80);
    expect(stepCpm(400, 1)).toBe(440);   // 고정 +10이면 티도 안 났을 폭
    expect(stepCpm(400, -1)).toBe(365);
  });

  it('사람이 쓸 수 있는 범위를 벗어나지 않는다 — 버튼을 눌러도 더 안 나간다', () => {
    expect(stepCpm(PACE_MIN_CPM, -1)).toBe(PACE_MIN_CPM);
    expect(stepCpm(PACE_MAX_CPM, 1)).toBe(PACE_MAX_CPM);
    expect(clampCpm(-5)).toBeNull();
    expect(clampCpm(NaN)).toBeNull();
  });
});

describe('§7② 설정 표시 — 자/분으로 조절하되 초를 병기', () => {
  it('이 문장과 평균을 초로 환산한다 — 오너가 말한 "몇 초 후"를 그대로 쓸 수 있게', () => {
    const h = paceHint({ chars: 14, avgChars: 9.2, targetCpm: 90 });
    expect(h).toEqual({ thisChars: 14, thisSec: 9.3, avgChars: 9, avgSec: 6 });
  });

  it('지정된 문장이 없으면 이 문장 칸은 비고 평균만 남는다', () => {
    const h = paceHint({ chars: null, avgChars: 9.2, targetCpm: 90 });
    expect(h.thisSec).toBeNull();
    expect(h.avgSec).toBe(6);
    expect(secondsOf(0)).toBeNull();
  });
});

describe('⑤⑥ 진행은 moveSentence(1) 하나 — 새 상태·새 버튼 0', () => {
  const viewer = read('src/views/ViewerPage.jsx');
  const block = codeOf(sliceBetween(viewer, 'useReadingPacer({', '// ▲▼ 한 벌'));

  it('⑤ 자동 진행이 부르는 것은 moveSentence(1)뿐 — 분석·시트·발화 금지 상속', () => {
    expect(block).toContain('moveSentence(1);');
    // 집중 모드 '순수 이동' 계약을 그대로 물려받는다. 여기서 직접 부르면 페이서가
    // 매 문장 Gemini를 때린다(#1082가 막아 둔 사고).
    for (const forbidden of ['runSelectionAnalysis', 'SheetSignal', 'speak(', 'setIsSheetOpen']) {
      expect(block, `페이서가 ${forbidden}를 직접 부르면 안 된다`).not.toContain(forbidden);
    }
  });

  it('⑦ 마지막 문장이면 자동 종료 — 넘길 곳이 없으면 paced 표식도 남기지 않는다', () => {
    expect(block).toContain('if (!adjacentSentence(sentences, pickedLineIdx, 1)) return;');
    expect(block.indexOf('adjacentSentence')).toBeLessThan(block.indexOf('pacedRef.current = true'));
  });

  it('⑥ 재생 상태를 따로 들지 않는다 — 별도 ▶/■ 버튼이 생길 자리가 없다', () => {
    // 발동 조건이 곧 정지 조건이라 상태가 하나도 늘지 않는다(설계 §5).
    expect(viewer).toContain('const paceArmed = autoPace && focusMode && pickedSentence !== null;');
    expect(block).toContain('enabled: paceArmed,');
    // 페이서 전용 재생/정지 상태를 새로 만들면 여기서 걸린다
    for (const banned of ['setPacePlaying', 'paceRunning', 'setPaceOn', 'togglePace']) {
      expect(viewer).not.toContain(banned);
    }
  });
});

describe('⑩ 미발동 조건 + 옵트인', () => {
  it('설정 꺼짐·집중 모드 꺼짐·지정 없음 중 하나라도면 체류 자체가 계산되지 않는다', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain('const paceDwell = paceArmed');
    // paceArmed가 false면 dwell이 null → 훅이 타이머를 걸지 않고 진행 선 클래스도 안 붙는다
    expect(viewer).toContain("${paceDwell ? ' reader-area--pacing' : ''}");
  });

  it('기본 꺼짐 — 관례(집중 모드·한자 대조·성조 색상 선례)', () => {
    const settings = read('src/lib/useViewerSettings.js');
    expect(settings).toContain("readPref('autoPace', false)");
    // 목표 속도는 안 고르면 null → 언어별 기본값(정본은 readingPacer 한 곳)
    expect(settings).toContain("readPref('paceCpm', null)");
    expect(read('src/views/ViewerPage.jsx')).toContain('const paceTargetCpm = paceCpm || defaultTargetCpm(materialLang);');
  });
});

describe('§5 일시정지 — 카드·시트가 열리면 멈추고, 닫으면 이어서', () => {
  const hook = read('src/lib/useReadingPacer.js');
  const code = codeOf(hook);

  it('멈춤 신호는 I-a 측정과 같은 것을 쓴다 — 찾아보는 시간은 읽기도 진행도 아니다', () => {
    expect(read('src/views/ViewerPage.jsx')).toContain('const paceHeld = isSheetOpen || !!selectedToken;');
    expect(code).toContain('if (!enabled || paused || !Number.isFinite(dwell)) return undefined;');
  });

  it('재개는 이어서 — 남은 체류를 깎아 두지 않으면 사전을 찾을수록 제자리걸음이 된다', () => {
    const effect = sliceBetween(code, 'const startedAt = Date.now();', '}, [enabled, paused, dwell, cursor]);');
    expect(effect).toContain('remainingRef.current - (Date.now() - startedAt)');
    // 문장이 바뀌면 남은 시간을 물려받지 않고 처음부터
    expect(code).toContain('}, [cursor, dwell, enabled]);');
  });

  it('JS 프레임 루프 0 — 시간은 한 번의 setTimeout과 CSS 애니메이션이 잰다', () => {
    expect(code).not.toMatch(/setInterval|requestAnimationFrame/);
    expect(code.match(/setTimeout\(/g)).toHaveLength(1);
  });
});

describe('⑧ 측정 오염 차단 — paced 표식', () => {
  const viewer = read('src/views/ViewerPage.jsx');

  it('페이서가 한 번이라도 넘겼으면 완독 detail에 paced가 실린다', () => {
    const input = sliceBetween(viewer, 'readingMetricInput: () => ({', '}),');
    expect(input).toContain('paced: pacedRef.current,');
    expect(viewer).toContain('const pacedRef = useRef(false);');
  });

  it('페이서로 낸 속도는 "내가 설정한 속도" — 비교에서 빠질 수 있게 필드가 남는다', () => {
    // I-a의 buildReadingMetric이 paced를 받아 detail에 싣는 것까지가 이 계약의 끝단.
    expect(read('src/lib/readingTimer.js')).toContain('paced: !!paced');
    expect(read('src/lib/useReadingCompletion.js')).toContain("detail: { qtype: 'read', mode: 'viewer', ...(metric || {}) },");
  });
});

describe('⑨ 진행 선 — 지정 문장에만, 숫자 카운트다운 없음', () => {
  const css = read('src/index.css');

  it('선은 지정 토큰에만 그려진다 — 본문 전체가 흔들리면 읽기가 방해된다', () => {
    const rule = sliceBetween(css, '.reader-area--pacing .word-token--picked::after {', '}');
    expect(rule).toContain('animation: pace-drain');
    expect(rule).toContain('var(--pace-dwell');
    expect(css).toContain('@keyframes pace-drain');
    // 비지정 토큰까지 번지면 위반
    expect(css).not.toMatch(/\.reader-area--pacing \.word-token[ :]*\{/);
  });

  it('한 문장이 한 줄로 읽힌다 — 조각이 자간까지 덮어 실금을 없앤다', () => {
    // 토막난 밑줄은 진행 표시가 아니라 렌더 오류로 보인다(렌더 실측에서 잡아 고친 결함).
    const bridge = sliceBetween(css, '.reader-area--pacing .word-token--picked:has(+ .word-token--picked)::after {', '}');
    expect(bridge).toContain('right: calc(-1 * var(--char-gap');
    // 각 조각의 담당 구간은 React가 글자수 비례로 나눠 준다(오른쪽 끝부터 물러남)
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain("m.set(ids[i], { from: 1 - acc / total, to: 1 - s2 });");
    expect(viewer).toContain("{ '--pace-from': paceSlice.from, '--pace-to': paceSlice.to }");
  });

  it('선은 글자 잉크 좌표계에 붙는다 — 인라인 상자 바닥이면 루비 여백만큼 떠 보인다', () => {
    const rule = sliceBetween(css, '.reader-area--pacing .word-token--picked::after {', '}');
    expect(rule).toContain('top: calc(var(--hl-band-top) + var(--hl-band-h)');
  });

  it('일시정지는 선도 함께 멈춘다(제거가 아니라 정지 — 재개가 이어져야 한다)', () => {
    expect(css).toContain('.reader-area--pacing-hold .word-token--picked::after { animation-play-state: paused; }');
  });

  it('모션 축소면 연속 이동 대신 3단계 — 새 DOM 없이 같은 선을 끊는다', () => {
    // 앵커를 미디어 조건부터 잡아 '어느 쿼리 안인지'까지 한 슬라이스로 증명한다 —
    // 규칙만 대조하면 뷰포트 쿼리로 옮겨져도 초록으로 남는다.
    const mq = sliceBetween(
      css,
      '@media (prefers-reduced-motion: reduce) {\n  .reader-area--pacing .word-token--picked::after',
      '}',
    );
    expect(mq).toContain('animation-timing-function: steps(3, end)');
  });

  it('본문에 숫자 카운트다운을 두지 않는다 — 시선이 글에서 숫자로 옮겨간다', () => {
    // 슬라이스가 먼저다 — codeOf를 먼저 걸면 끝 앵커(주석)가 사라져 throw한다.
    const block = codeOf(sliceBetween(read('src/views/ViewerPage.jsx'), 'useReadingPacer({', '// ▲▼ 한 벌'));
    expect(block).not.toMatch(/countdown|남은 ?초|setPaceRemaining/i);
  });
});

describe('설정 시트 배치 — 집중 모드 옆, 조절은 초 병기', () => {
  const viewer = read('src/views/ViewerPage.jsx');

  it('자동 진행 스위치가 집중 모드 바로 뒤에 있다 — 전제가 집중 모드다', () => {
    const focusIdx = viewer.indexOf('<b>집중 모드</b>');
    const paceIdx = viewer.indexOf('<b>자동 진행</b>');
    expect(focusIdx).toBeGreaterThan(-1);
    expect(paceIdx).toBeGreaterThan(focusIdx);
    // 사이에 다른 스위치 행이 끼면 두 설정의 종속 관계가 안 읽힌다 —
    // 구간에 들어와도 되는 rsheet-swrow는 자동 진행 자신의 것 하나뿐이다.
    const between = sliceBetween(viewer, '<b>집중 모드</b>', '<b>자동 진행</b>');
    expect(between.match(/rsheet-swrow/g)).toHaveLength(1);
    expect(viewer).toContain('onChange={() => setAutoPace(v => !v)}');
  });

  it('속도 조절 줄은 켰을 때만 뜨고, 자/분과 초를 함께 보여준다', () => {
    const row = sliceBetween(viewer, '{autoPace && (', "{sheetTab === 'tools'");
    expect(row).toContain('stepCpm(paceTargetCpm, -1)');
    expect(row).toContain('stepCpm(paceTargetCpm, 1)');
    expect(row).toContain('자/분');
    expect(row).toContain('paceHint({');
    expect(row).toContain('초');
  });
});
