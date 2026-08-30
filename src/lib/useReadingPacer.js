'use client';

/**
 * 자동 진행 타이머 (v2-I R1b, 설계 §5~§6).
 *
 * **새 버튼을 만들지 않는다**(오너 수정: "▶ 버튼 만들 필요가 없는 게 그냥 바깥 부분 눌러
 * 집중 모드 해제하면 풀리니까"). 발동·정지·이동은 전부 집중 모드의 기존 제스처가 낸
 * 신호를 그대로 쓴다 — 이 훅은 그 신호를 시간으로만 바꾼다:
 *
 *   시작   설정 '자동 진행' + 집중 모드 + 문장 지정  → enabled
 *   정지   빈 공간 탭 = 지정 해제                    → enabled false(지정이 null)
 *   이동   다른 문장 탭 = 지정 이동, 진행 계속        → cursor 변경(체류만 새로 잼)
 *   일시정지 카드·시트 열림                          → paused (닫으면 **이어서** 재개)
 *   자동 종료 마지막 문장                            → 호출자의 onAdvance가 경계에서 멈춤
 *
 * 진행 자체는 `moveSentence(1)` 하나만 부른다(설계 §6) — 그러면 집중 모드에서 확정된
 * '순수 이동' 계약(분석·시트·Gemini 호출 없음)이 공짜로 따라와서, 페이서가 매 문장
 * 번역을 부르는 사고가 원천 차단된다.
 */
import { useEffect, useRef } from 'react';

export function useReadingPacer({
  enabled = false,
  dwell = null,
  paused = false,
  cursor = null,
  onAdvance,
} = {}) {
  const onAdvanceRef = useRef(onAdvance);
  onAdvanceRef.current = onAdvance;
  /** 이 문장에 남은 체류(ms). 일시정지 때 깎아 두었다가 재개 시 이어 쓴다. */
  const remainingRef = useRef(null);

  // 문장이 바뀌거나 목표 속도가 바뀌면 체류를 처음부터 — 남은 시간을 물려받지 않는다.
  useEffect(() => {
    remainingRef.current = Number.isFinite(dwell) ? dwell : null;
  }, [cursor, dwell, enabled]);

  useEffect(() => {
    if (!enabled || paused || !Number.isFinite(dwell)) return undefined;
    if (remainingRef.current == null) remainingRef.current = dwell;
    const startedAt = Date.now();
    const id = setTimeout(() => {
      remainingRef.current = null;   // 소진 — 다음 문장에서 새로 잰다
      onAdvanceRef.current?.();
    }, Math.max(0, remainingRef.current));
    return () => {
      clearTimeout(id);
      // 재개는 '이어서'다. 카드 한 번 열었다고 체류가 처음으로 돌아가면 사전을 찾을수록
      // 페이서가 제자리걸음을 한다(설계 §5 일시정지 = 멈춤·재개).
      if (remainingRef.current != null) {
        remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt));
      }
    };
  }, [enabled, paused, dwell, cursor]);
}
