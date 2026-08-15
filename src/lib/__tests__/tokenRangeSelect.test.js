import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTokenRangeGesture,
  composeRangeText,
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
