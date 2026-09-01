import { describe, expect, it } from 'vitest';
import { resolveSignalTransition } from '../ViewerBottomSheet.jsx';

/**
 * 계약: 바텀시트 신호 전이.
 *
 * 원래 요구(오너 보고 수리)는 「문장 지정 후 본문 단어를 탭하면 **단어 상세가 바로 보여야
 * 한다**」였다 — 먼저 열려 있던 문장 설명이 단어 상세를 가리던 문제. 그 요구는 지금도 살아
 * 있고, v2-R은 그것을 **더 강하게** 만족한다: 시트가 선택된 하나만 그리므로 가림이
 * 구조적으로 성립하지 않는다.
 *
 * 바뀐 것은 **동시 신호**의 처리다(v2-R §3, 오너 승인 2026-09-01). 예전에는 문장 드래그가
 * 번역과 단어 목록을 **둘 다 펼쳤는데**(#992), 시트 상한 60svh를 둘이 나누면 각자 ~30svh이고
 * **단어 카드 하나만으로도 예문이 잘리는** 상황이라 실질적으로 둘 다 못 보게 됐다.
 * 이제 동시 신호는 **번역·맥락**을 띄우고 단어 목록은 하단 바 배지가 알린다.
 *
 * ※ 되돌리려면 이 함수 하나만 옛 모양(`{left, right}` 불리언 쌍)으로 되돌리고 시트를
 *   두 섹션 렌더로 복원하면 된다 — 다른 곳에 퍼져 있지 않다.
 * ※ 데스크톱(≥1180px)은 좌우 칸이라 시트를 쓰지 않는다 — 무영향.
 */

describe('resolveSignalTransition — 어느 탭을 띄울지', () => {
  it('단어(우) 단독 신호 → 단어 탭 — 가림 수리의 본체', () => {
    expect(resolveSignalTransition(false, true)).toEqual({ tab: 'right' });
  });

  it('문장 설명(좌) 단독 신호 → 번역·맥락 탭', () => {
    expect(resolveSignalTransition(true, false)).toEqual({ tab: 'left' });
  });

  it('동시 신호(문장 드래그) → 번역·맥락 — 둘 다 펼치기는 폐기됐다', () => {
    // 문장 드래그의 주 목적은 문장 이해이고, 단어 목록은 배지(N개)로 존재를 알릴 수
    // 있지만 번역은 열지 않으면 알 길이 없다 — 그래서 좌를 고른다.
    expect(resolveSignalTransition(true, true)).toEqual({ tab: 'left' });
  });

  it('신호 없음 → 전이 없음(null)', () => {
    expect(resolveSignalTransition(false, false)).toBeNull();
  });

  it('반환은 항상 탭 하나다 — 둘 다 펼치는 모양이 부활하지 않는다', () => {
    for (const [l, r] of [[true, false], [false, true], [true, true]]) {
      const t = resolveSignalTransition(l, r);
      expect(Object.keys(t), `${l}/${r}: 탭 하나만 담아야 한다`).toEqual(['tab']);
      expect(['left', 'right']).toContain(t.tab);
    }
  });
});
