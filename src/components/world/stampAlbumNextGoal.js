export const STAMP_ALBUM_COMPLETE_LINE = '여권이 가득 찼어요';

const GOAL_PRIORITY = Object.freeze({
  discovery: 0,
  'npc-meeting': 1,
  'stamp-title': 2,
});

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function lineFrom(presentation, key) {
  const line = presentation?.[key];
  return typeof line === 'string' && line.length > 0 ? line : null;
}

function freezeGoal(kind, presentation, remaining, line) {
  return Object.freeze({
    kind,
    cityId: typeof presentation?.cityId === 'string' ? presentation.cityId : null,
    remaining,
    line,
  });
}

function progressRemaining(presentation) {
  return Number.isInteger(presentation?.got)
    && Number.isInteger(presentation?.total)
    && presentation.got >= 0
    && presentation.total >= presentation.got
    ? presentation.total - presentation.got
    : null;
}

// S10 "가장 가까운 목표"는 완료 분모가 있어 실제로 감소하는 잔여량만 비교한다.
// 지구 openCount는 현재 제공 범위인 정적 정보값이므로 목표 후보가 아니다.
// S13 NPC 만남도 도시별 완료 분모가 있으므로 후보에 넣고, 기존 우선순위를 보존해
// 동률은 발견 → 만남 → 전역 칭호 순으로 고정한다.
export function stampAlbumNextGoal({
  discovery = null,
  npcMeeting = null,
  stampTitle = null,
} = {}) {
  const discoveryRemaining = progressRemaining(discovery);
  const npcMeetingRemaining = progressRemaining(npcMeeting);
  const stampTitleComplete = stampTitle?.nextMilestone === null
    && Number.isInteger(stampTitle?.stampCount);

  if (
    stampTitleComplete
    && (discoveryRemaining == null || discoveryRemaining === 0)
    && (npcMeetingRemaining == null || npcMeetingRemaining === 0)
  ) {
    return freezeGoal('complete', null, 0, STAMP_ALBUM_COMPLETE_LINE);
  }

  const candidates = [];
  const discoveryLine = lineFrom(discovery, 'label');
  if (positiveInteger(discoveryRemaining) && discoveryLine) {
    candidates.push(freezeGoal('discovery', discovery, discoveryRemaining, discoveryLine));
  }

  const npcMeetingLine = lineFrom(npcMeeting, 'label');
  if (positiveInteger(npcMeetingRemaining) && npcMeetingLine) {
    candidates.push(freezeGoal(
      'npc-meeting',
      npcMeeting,
      npcMeetingRemaining,
      npcMeetingLine,
    ));
  }

  const titleRemaining = stampTitle?.nextMilestone?.remaining;
  const titleLine = lineFrom(stampTitle, 'progressLine');
  if (positiveInteger(titleRemaining) && titleLine) {
    candidates.push(freezeGoal('stamp-title', stampTitle, titleRemaining, titleLine));
  }

  candidates.sort((left, right) => (
    left.remaining - right.remaining
    || GOAL_PRIORITY[left.kind] - GOAL_PRIORITY[right.kind]
  ));
  return candidates[0] ?? null;
}
