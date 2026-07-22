export const AIRPORT_EXIT_ERROR_MESSAGE = '복귀 위치를 저장하지 못했어요. 연결을 확인해 주세요.';

export function airportStoryOverlayVisible(activeScene, storyActive) {
  return activeScene === 'airport' && storyActive === true;
}

// 공항 씬과 React 오버레이의 생명주기를 한 번에 닫는다. AirportQuiz는 storyActive=false로
// 언마운트되므로 내부 문항·저장 진행 상태도 함께 폐기된다.
export function resetAirportStoryState({
  setStoryActive,
  setStoryPhase,
  setStoryIdx,
  setShowKo,
  setAirHubPrompt,
  setAirHubStatus,
  setAirportExitStatus,
}) {
  setStoryActive(false);
  setStoryPhase('none');
  setStoryIdx(0);
  setShowKo(false);
  setAirHubPrompt(null);
  setAirHubStatus(null);
  setAirportExitStatus(null);
}

// 다이얼로그는 저장·씬 전환보다 먼저 닫는다. 로그인 사용자는 복귀 좌표 저장 성공 뒤에만
// 전환하고, WorldPage가 판정한 dev guest는 제품 저장 API를 건드리지 않고 전환한다.
export async function requestAirportStoryExit({
  devGuest,
  userId,
  returnSpawn,
  resetStory,
  setStatus,
  persistPosition,
  transition,
}) {
  resetStory();
  setStatus({ phase: 'saving' });

  try {
    if (!devGuest) {
      if (!userId || !returnSpawn) throw new Error('airport return position unavailable');
      const saved = await persistPosition(returnSpawn);
      if (!saved) throw new Error('airport return position save failed');
    }
    setStatus(null);
    const transitioned = transition();
    if (transitioned === false) throw new Error('airport return transition failed');
    return true;
  } catch {
    setStatus({ phase: 'error', message: AIRPORT_EXIT_ERROR_MESSAGE });
    return false;
  }
}
