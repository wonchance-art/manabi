import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  createTokenRangeGesture,
  composeRangeText,
  gripAnchor,
  LONG_PRESS_MS,
  MOVE_THRESHOLD,
  SCROLL_CANCEL_PX,
} from '../useTokenRangeSelect.js';

// 계약: 인앱 토큰 범위 지정의 제스처 판정 — 데스크톱은 즉시 드래그(8px), 모바일은
// 길게 누르기(300ms) 후 드래그. 임계 전 터치 이동은 스크롤로 양보해야 하고(오너 승인 UX),
// 판정이 어긋나면 스크롤이 먹통이 되거나 지정이 시작되지 않는다.

describe('createTokenRangeGesture — 판정 코어', () => {
  let events;
  let g;

  beforeEach(() => {
    vi.useFakeTimers();
    events = [];
    g = createTokenRangeGesture({
      onStart: (p) => events.push(['start', p.x, p.y]),
      onUpdate: (p) => events.push(['update', p.x, p.y]),
      onEnd: () => events.push(['end']),
      onCancel: (reason) => events.push(['cancel', reason]),
    });
  });
  afterEach(() => vi.useRealTimers());

  it('마우스: 임계(8px) 초과 이동 시 시작점 앵커로 지정을 시작한다', () => {
    g.down({ x: 100, y: 100, pointerType: 'mouse' });
    g.move({ x: 103, y: 100 }); // 임계 미만 — 아직 아님
    expect(events).toEqual([]);
    g.move({ x: 100 + MOVE_THRESHOLD + 1, y: 100 });
    g.move({ x: 130, y: 105 });
    g.up();
    expect(events[0]).toEqual(['start', 100, 100]); // 앵커는 down 지점
    expect(events.at(-1)).toEqual(['end']);
    expect(g.state).toBe('idle');
  });

  it('마우스: 이동 없이 up이면 탭 — 지정을 시작하지 않는다', () => {
    g.down({ x: 50, y: 50, pointerType: 'mouse' });
    g.up();
    expect(events).toEqual([['cancel', 'tap']]);
  });

  it('터치: 길게 누르기(300ms) 유지 시 지정 시작', () => {
    g.down({ x: 10, y: 20, pointerType: 'touch' });
    vi.advanceTimersByTime(LONG_PRESS_MS - 1);
    expect(events).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(events).toEqual([['start', 10, 20]]);
    g.move({ x: 40, y: 22 });
    g.up();
    expect(events.at(-2)).toEqual(['update', 40, 22]);
    expect(events.at(-1)).toEqual(['end']);
  });

  it('터치: 길게 누르기 전 이동(10px 초과)은 스크롤로 양보한다', () => {
    g.down({ x: 10, y: 20, pointerType: 'touch' });
    g.move({ x: 10, y: 20 + SCROLL_CANCEL_PX + 1 });
    expect(events).toEqual([['cancel', 'scroll']]);
    // 이후 타이머가 만료돼도 시작되지 않는다
    vi.advanceTimersByTime(LONG_PRESS_MS + 100);
    expect(events).toEqual([['cancel', 'scroll']]);
  });

  it('터치: 길게 누르기 전 짧은 up은 탭 통과(단어 클릭 경로 유지)', () => {
    g.down({ x: 10, y: 20, pointerType: 'touch' });
    vi.advanceTimersByTime(100);
    g.up();
    expect(events).toEqual([['cancel', 'tap']]);
    vi.advanceTimersByTime(LONG_PRESS_MS); // 잔여 타이머 없음
    expect(events).toEqual([['cancel', 'tap']]);
  });

  it('pointercancel(브라우저 스크롤 강탈)은 진행 상태를 정리한다', () => {
    g.down({ x: 10, y: 20, pointerType: 'touch' });
    g.cancel();
    expect(events).toEqual([['cancel', 'cancelled']]);
    expect(g.state).toBe('idle');
  });

  it('지정 중 재-down은 이전 타이머를 청소하고 새 제스처를 시작한다', () => {
    g.down({ x: 10, y: 20, pointerType: 'touch' });
    g.down({ x: 30, y: 40, pointerType: 'touch' });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(events).toEqual([['start', 30, 40]]); // 첫 down의 지연 시작이 남지 않는다
  });
});

describe('composeRangeText — 범위 표면형 합성', () => {
  const sequence = ['t0', 't1', 'br0', 't2', 't3'];
  const dictionary = {
    t0: { text: '我', pos: '대명사' },
    t1: { text: '工作', pos: '동사' },
    br0: { text: '\n', pos: '개행' },
    t2: { text: '很', pos: '부사' },
    t3: { text: '忙', pos: '형용사' },
  };

  it('개행 토큰을 \\n으로 보존해 다줄 분석이 성립한다', () => {
    expect(composeRangeText(sequence, dictionary, 0, 4)).toBe('我工作\n很忙');
  });

  it('부분 범위·단일 토큰도 합성한다', () => {
    expect(composeRangeText(sequence, dictionary, 1, 1)).toBe('工作');
    expect(composeRangeText(sequence, dictionary, 3, 4)).toBe('很忙');
  });

  it('사전에 없는 토큰은 건너뛴다(깨진 시퀀스 방어)', () => {
    expect(composeRangeText(['t0', 'ghost', 't1'], dictionary, 0, 2)).toBe('我工作');
  });
});

// 그립(양끝 핸들) 조정 — 잡은 쪽의 반대 끝이 앵커로 고정돼야 끌기가 직관과 일치한다.
describe('gripAnchor — 그립 조정 앵커 판정', () => {
  const range = { start: 3, end: 9 };

  it('시작 그립을 잡으면 끝이 앵커, 끝 그립을 잡으면 시작이 앵커', () => {
    expect(gripAnchor(range, 'start')).toBe(9);
    expect(gripAnchor(range, 'end')).toBe(3);
  });
});

// 계약: 그립이 뷰어에 실제로 배선돼 있어야 한다 — 훅만 있고 렌더가 빠지면 조용히 사라진다.
describe('그립 배선 계약 (ViewerPage.jsx)', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');

  it('TokenRangeGrips가 범위·그립 핸들러와 함께 렌더된다', () => {
    expect(src).toContain('<TokenRangeGrips');
    expect(src).toContain('onGripDown={tokenRange.startGripAdjust}');
  });
});

// 계약: 드래그 중 시트 포인터 투과 — 드래그 도중 비동기 데이터 도착으로 시트가 위로
// 자라 경로를 덮으면 elementFromPoint가 시트를 반환해 범위가 목표 토큰에 못 미친다
// (2026-08-20 main CI 3연속 red의 원인, 로컬 계측 실측). pointer-events:none 요소는
// elementFromPoint가 투과하므로 드래그 동안만 시트를 눕힌다.
describe('드래그 중 시트 가로채기 차단 계약', () => {
  const hook = fs.readFileSync(path.join(process.cwd(), 'src/lib/useTokenRangeSelect.js'), 'utf8');
  const viewer = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
  const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');

  it('훅이 dragging을 노출한다 — 드래그·그립 시작 시 true, 정리 경로에서 false', () => {
    expect(hook.match(/setDragging\(true\)/g)?.length).toBe(2); // onStart + 그립 조정
    // 종료·취소가 모두 지나는 cleanupTransient에서 단일 해제 — 켠 채 새는 경로 차단
    expect(hook).toMatch(/const cleanupTransient = useCallback\(\(\) => \{\s*setDragging\(false\);/);
    expect(hook).toMatch(/return \{ range, rangeTokenIds, dragging,/);
  });

  it('뷰어가 드래그 동안 루트에 --dragging을 달고, CSS가 시트·바를 투과시킨다', () => {
    expect(viewer).toContain("tokenRange.dragging ? ' viewer-3col--dragging' : ''");
    expect(css).toMatch(/\.viewer-3col--dragging \.viewer-sheet,\s*\.viewer-3col--dragging \.viewer-sheet-bar \{ pointer-events: none; \}/);
  });

  it('e2e 재시도는 시트를 닫고 다시 드래그한다(자란 시트가 pointerdown부터 먹는 경우)', () => {
    const e2e = fs.readFileSync(path.join(process.cwd(), 'e2e/learning-flow.e2e.mjs'), 'utf8');
    expect(e2e).toContain("getByRole('button', { name: '시트 닫기', exact: true })");
    expect(e2e).toContain("pdf_cache:synant:v1:Chinese:中文"); // ⑤ 자동 조회 결정성 시드
  });
});
