/**
 * 독해 트랙 RSC 페이로드 빌더.
 *
 * 목록은 잠금 표시·진도 계산에 필요한 메타데이터만 싣고, 본문·문항·문형 카드는
 * URL 로 선택한 노드 하나에만 붙인다. 선택 노드 상세는 서버가 아는 통과 집합으로
 * 검증한다: 포함 가능 = 동선의 연속 통과 prefix + 바로 다음 열린 노드 1개.
 *
 * 따라서 잠긴 노드 id 를 query 로 직접 요청해도 detail 은 null 이며, cardsFor 도
 * 호출하지 않는다. 다음 노드는 통과 저장 → 서버 pull → router.refresh 뒤에야
 * open 이 되어 상세를 받을 수 있다.
 */
import { buildNodes, nodeStates, drillId } from './readingProgress';

/** 선행 동선이 끊기기 전까지의 연속 통과 prefix만 반환한다. */
export function contiguousPassedIds(track, passedIds) {
  const passed = passedIds instanceof Set ? passedIds : new Set(passedIds || []);
  const prefix = new Set();
  for (const node of buildNodes(track)) {
    if (!passed.has(node.id)) break;
    prefix.add(node.id);
  }
  return prefix;
}

/**
 * 문항(questions/items)을 요청할 수 있는 노드 id 집합(순수).
 * 정상 진도에서는 기존 nodeStates 의 passed·open 집합과 같다. 다만 사용자가 자기
 * user_ref_progress 에 임의의 후속 rt: 행을 넣어도 선행 체인이 끊긴 뒤의 id 는 무시한다.
 * 게스트(빈 통과 집합)는 order 1 글 하나만 열린다.
 * @param {object} track - 원본 트랙(getReadingTrack 결과)
 * @param {Iterable<string>} passedIds - 서버가 아는 통과 글/드릴 id 집합
 * @returns {Set<string>}
 */
export function questionOpenIds(track, passedIds) {
  const prefix = contiguousPassedIds(track, passedIds);
  const open = new Set(prefix);
  const next = buildNodes(track).find((node) => !prefix.has(node.id));
  if (next) open.add(next.id);
  return open;
}

/** 서버의 bunkei 사전에서 클라이언트 표시용 카드만 뽑는 순수 resolver. */
export function createPatternCardResolver(bunkei) {
  const cardByPattern = new Map();
  for (const theme of bunkei?.themes || []) {
    for (const item of theme.items || []) {
      cardByPattern.set(item.pattern, {
        pattern: item.pattern,
        ko: item.ko || '',
        explain: item.explain || '',
        contrast: item.contrast || '',
        ex: item.ex || null,
      });
    }
  }
  return (patterns) => (patterns || []).map((pattern) => cardByPattern.get(pattern)).filter(Boolean);
}

function summarizePlace(place) {
  if (!place || typeof place !== 'object') return place || '';
  return { name: place.name || '', ja: place.ja || '' };
}

function textSummary(text) {
  return {
    id: text.id,
    order: text.order,
    title: text.title,
    place: summarizePlace(text.place),
    situation: text.situation,
    patternCount: (text.newPatterns || []).length,
  };
}

function drillSummary(drill, index) {
  return {
    id: drillId(index),
    afterOrder: drill.afterOrder,
    title: drill.title,
    patternCount: (drill.patterns || []).length,
  };
}

function nodeDetail(node, cardsFor) {
  if (node.kind === 'text') {
    const text = node.ref;
    return {
      ...textSummary(text),
      newPatterns: text.newPatterns || [],
      body: text.body || [],
      questions: text.questions || [],
      patternCards: cardsFor(text.newPatterns),
    };
  }

  const drill = node.ref;
  return {
    ...drillSummary(drill, node.index),
    patterns: drill.patterns || [],
    items: drill.items || [],
    patternCards: cardsFor(drill.patterns),
  };
}

/**
 * 직렬화 가능한 목록 manifest + 선택 노드 상세 조립(reading/page.jsx 전용).
 *
 * @param {object} track - 원본 트랙
 * @param {Iterable<string>} passedIds - 서버 통과 집합(게스트는 빈 집합)
 * @param {(patterns: string[]) => Array} cardsFor - 문형 → 사전 카드 매퍼
 * @param {string|null} selectedId - query 로 요청한 노드 id
 * @param {string} viewerScope - 서버 payload 를 만든 인증 주체(uid 또는 guest)
 */
export function buildTrackPayload(
  track,
  passedIds,
  cardsFor = () => [],
  selectedId = null,
  viewerScope = 'guest'
) {
  const texts = track.texts || [];
  const drills = track.drills || [];
  const nodes = buildNodes(track);
  const stated = nodeStates(nodes, passedIds);
  const allowed = questionOpenIds(track, passedIds);
  const requestedId = typeof selectedId === 'string' && selectedId ? selectedId : null;
  const selected = requestedId ? stated.find((node) => node.id === requestedId) : null;
  const canReadDetail = !!(selected && allowed.has(selected.id));

  return {
    track: track.track,
    title: track.title,
    level: track.level,
    estWeeks: track.estWeeks,
    viewerScope,
    // check-reading G1 이 125개 문형의 중복 도입 0을 강제한다. 그래서 노드별 count 합으로
    // 클라이언트가 문자열 목록 없이도 즉시 진도를 계산할 수 있다.
    patternsTotal: texts.reduce((sum, text) => sum + (text.newPatterns || []).length, 0)
      + drills.reduce((sum, drill) => sum + (drill.patterns || []).length, 0),
    texts: texts.map(textSummary),
    drills: drills.map(drillSummary),
    selection: requestedId ? {
      id: requestedId,
      kind: selected?.kind || null,
      status: !selected ? 'missing' : canReadDetail ? selected.status : 'locked',
      detail: canReadDetail ? nodeDetail(selected, cardsFor) : null,
    } : null,
  };
}
