/**
 * voice-unreachable 1회 안내 상태기 — WorldPage의 음성 실패 토스트 배선용 순수 헬퍼.
 *
 * 계약(Codex 검수 반영): 마이크 on/off와 무관하게 status === 'voice-unreachable' 자체로
 * 1회 안내한다(voice.js는 마이크가 꺼져도 수신 연결을 유지하고, 대칭형 NAT의 ICE 실패는
 * 수신도 막는다 — listener-only 경로도 조용한 실패 방지 대상). 실패가 아닌 상태로
 * 회복되면 재무장해, 다음 실패에서 다시 1회 안내한다.
 */
export function createVoiceUnreachableNotifier() {
  let armed = true;
  return function shouldNotify(status) {
    if (status === 'voice-unreachable') {
      if (!armed) return false;
      armed = false;
      return true;
    }
    armed = true;
    return false;
  };
}
