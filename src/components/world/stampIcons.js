// 🗾 여행 스탬프 앨범 — 순수 표시 로직(노드→배지 아이콘, 방문일 포맷).
// React·QuestReview·Supabase 의존 0 → vitest(node)에서 그대로 임포트해 검증한다
// (StampAlbum.jsx 는 이 모듈을 소비 — 컴포넌트 트리를 끌어오지 않아 테스트가 가볍다).

// 노드별 스탬프 아이콘 — kind/peak/npc 로 데이터 기반 선택 + 몇몇은 실물 정합 위해 id 오버라이드.
//   우선순위: id 오버라이드 > npc(ramen/shrine) > peak(설산) > kind(city/airport/port/landmark) > 폴백.
const ICON_OVERRIDE = { haneda: '✈️', tottori: '🏜️' };
const KIND_ICON = { city: '🏙️', airport: '✈️', port: '⚓', landmark: '⛰️' };

export function stampIcon(node) {
  if (!node) return '📍';
  if (ICON_OVERRIDE[node.id]) return ICON_OVERRIDE[node.id];
  if (node.npc === 'ramen') return '🍜';
  if (node.npc === 'shrine') return '⛩️';
  if (node.peak) return '🗻';
  return KIND_ICON[node.kind] || '📍';
}

// timestamptz(ISO) → 'YYYY.MM.DD'(로컬 타임존 · 0 패딩). 빈 값/파싱 실패는 빈 문자열.
export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
