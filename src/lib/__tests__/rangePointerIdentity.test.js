import { describe, expect, it, vi } from 'vitest';
import { createTokenRangeGesture, sameRangePointer } from '../useTokenRangeSelect';

describe('selection owns one pointer stream', () => {
  it('ignores mouse hover and a second finger while long-pressing', () => {
    vi.useFakeTimers();
    try {
      const active = { pointerId: 41, pointerType: 'touch' }, onStart = vi.fn(), onEnd = vi.fn(), onCancel = vi.fn();
      const gesture = createTokenRangeGesture({ onStart, onEnd, onCancel });
      gesture.down({ x: 10, y: 10, pointerType: active.pointerType });
      for (const event of [{ pointerId: 1, pointerType: 'mouse' }, { pointerId: 42, pointerType: 'touch' }, { pointerId: 41, pointerType: 'pen' }]) {
        expect(sameRangePointer(event, active)).toBe(false);
        if (sameRangePointer(event, active)) gesture.move({ x: 200, y: 200 });
      }
      vi.advanceTimersByTime(301);
      expect(onStart).toHaveBeenCalledOnce(); expect(onCancel).not.toHaveBeenCalled();
      expect(sameRangePointer({ ...active }, active)).toBe(true);
      if (sameRangePointer(active, active)) gesture.up();
      expect(onEnd).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });
});
