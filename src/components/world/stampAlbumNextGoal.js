export const STAMP_ALBUM_COMPLETE_LINE = '여권이 가득 찼어요';

const GOAL_PRIORITY = Object.freeze({
  district: 0,
  discovery: 1,
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

// S7 "가장 가까운 목표"는 각 기존 presentation이 제공하는 정본 개수를 비교한다.
// 동률은 도시 상세 문맥을 우선해 지구 → 발견 → 전역 칭호 순으로 고정한다.
export function stampAlbumNextGoal({
  district = null,
  discovery = null,
  stampTitle = null,
} = {}) {
  const discoveryRemaining = Number.isInteger(discovery?.got)
    && Number.isInteger(discovery?.total)
    && discovery.got >= 0
    && discovery.total >= discovery.got
    ? discovery.total - discovery.got
    : null;
  const stampTitleComplete = stampTitle?.nextMilestone === null
    && Number.isInteger(stampTitle?.stampCount);

  // 지구는 개방 영역의 현재 탐험 폭이고 별도 완료 분모가 없다.
  // 여권과 현재 도시의 발견을 모두 마쳤을 때는 정보성 지구 수보다 완주 카피가 우선한다.
  if (stampTitleComplete && (discoveryRemaining == null || discoveryRemaining === 0)) {
    return freezeGoal('complete', null, 0, STAMP_ALBUM_COMPLETE_LINE);
  }

  const candidates = [];
  const districtLine = lineFrom(district, 'countLabel');
  if (positiveInteger(district?.openCount) && districtLine) {
    candidates.push(freezeGoal('district', district, district.openCount, districtLine));
  }

  const discoveryLine = lineFrom(discovery, 'label');
  if (positiveInteger(discoveryRemaining) && discoveryLine) {
    candidates.push(freezeGoal('discovery', discovery, discoveryRemaining, discoveryLine));
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
