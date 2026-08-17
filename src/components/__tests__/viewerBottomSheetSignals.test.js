import { describe, expect, it } from 'vitest';
import { resolveSignalTransition } from '../ViewerBottomSheet.jsx';

// 계약(오너 보고 수리): 문장 지정 후 본문 단어를 탭하면 단어 상세가 바로 보여야 한다 —
// 단독 신호는 반대 섹션을 접는다. 동시 신호(문장 드래그 = 번역+단어 목록)는 둘 다
// 연다(#992 의도 유지). 신호 없음은 무전이.

describe('resolveSignalTransition — 바텀시트 신호 전이', () => {
  it('단어(우) 단독 신호 → 우 열고 좌(문장 설명) 접기 — 가림 수리 본체', () => {
    expect(resolveSignalTransition(false, true)).toEqual({ left: false, right: true });
  });

  it('문장 설명(좌) 단독 신호 → 좌 열고 우 접기', () => {
    expect(resolveSignalTransition(true, false)).toEqual({ left: true, right: false });
  });

  it('동시 신호(문장 드래그) → 둘 다 연다', () => {
    expect(resolveSignalTransition(true, true)).toEqual({ left: true, right: true });
  });

  it('신호 없음 → 전이 없음(null)', () => {
    expect(resolveSignalTransition(false, false)).toBeNull();
  });
});
