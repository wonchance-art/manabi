/**
 * 독해 트랙 서버 페이로드 빌더 — 정답표 노출 최소화(P2-7 최소분).
 *
 * 배경: 순차 잠금은 클라이언트 UX 경계일 뿐이라, 트랙 전체를 props 로 내리면
 * 잠긴 글의 questions(answer·why = 정답표)까지 RSC 응답에 통째로 실린다.
 * 그래서 문항 포함 범위를 **서버가 아는 통과 집합** 기준으로 자른다:
 *   포함 = 통과 노드 전부 + 잠금 체인상 다음 열린 노드 1개(그뿐)
 * 즉 nodeStates 의 passed·open 노드만 — 어떤 노드도 **선전송하지 않는다**(P2-6).
 * (이전엔 열린 글 다음 드릴을 한 걸음 미리 내렸으나, 그 선전송이 2번째 드릴 정답표를
 *  조기 노출하거나 통과 체인 직렬화와 어긋났다. 이제 통과→원격 upsert 확인→pull→
 *  router.refresh 가 성공한 뒤에야 다음 노드가 open 이 되어 문항이 존재한다 — handlePass
 *  가 그 순서를 보장하므로 왕복이 정합적으로 직렬화된다.)
 *
 * 잠긴 노드는 questions/items 를 빈 배열로 스트립하고 stripped 표식을 남긴다
 * (클라이언트가 "문항 미수신"과 "원래 빈 문항"을 구분해 회복 UI 를 띄우는 근거).
 * 목록·진도 헤더가 쓰는 title·situation·newPatterns·patterns 는 유지해 깨짐 0.
 * 본문 body 는 정답이 아니라 읽기 콘텐츠라 유지 — 이번 최소분의 차단 대상은
 * 통과 판정을 무력화하는 정답표(answer·why)다.
 *
 * 전부 순수 함수(부수효과 0) — 잠금 체인 정의는 readingProgress 의
 * buildNodes/nodeStates 를 그대로 재사용해 클라이언트 잠금 UX 와 갈라지지 않는다.
 */
import { buildNodes, nodeStates, drillId } from './readingProgress';

/**
 * 문항(questions/items)을 포함해도 되는 노드 id 집합(순수).
 * 순수하게 nodeStates 의 **passed·open 노드만** — 선전송 없음(P2-6). 게스트(빈 통과 집합)는
 * order 1 글 하나만 열린다(그 위치 드릴조차 글1 통과 전엔 잠금). 다음 노드는 통과→서버 반영→
 * 재조회 뒤에야 open 이 되어 문항이 존재한다(handlePass 가 순서를 직렬화).
 * @param {object} track - 원본 트랙(getReadingTrack 결과)
 * @param {Iterable<string>} passedIds - 서버가 아는 통과 글/드릴 id 집합
 * @returns {Set<string>}
 */
export function questionOpenIds(track, passedIds) {
  const stated = nodeStates(buildNodes(track), passedIds);
  const open = new Set();
  for (const n of stated) {
    if (n.status === 'passed' || n.status === 'open') open.add(n.id);
  }
  return open;
}

/**
 * 직렬화 가능한 경량 페이로드(함수·미사용 필드 배제) 조립 — reading/page.jsx 전용.
 * @param {object} track - 원본 트랙
 * @param {Iterable<string>} passedIds - 통과 집합(게스트는 빈 집합)
 * @param {(patterns: string[]) => Array} cardsFor - 문형 → 사전 카드(bunkei) 매퍼(서버 주입)
 */
export function buildTrackPayload(track, passedIds, cardsFor = () => []) {
  const open = questionOpenIds(track, passedIds);
  return {
    track: track.track,
    title: track.title,
    level: track.level,
    estWeeks: track.estWeeks,
    texts: (track.texts || []).map((t) => ({
      id: t.id,
      order: t.order,
      title: t.title,
      situation: t.situation,
      place: t.place,
      frame: t.frame,
      newPatterns: t.newPatterns || [],
      body: t.body || [],
      // 스트립 — 잠긴 글의 정답표(answer·why)는 응답에 싣지 않는다
      questions: open.has(t.id) ? t.questions || [] : [],
      ...(open.has(t.id) ? {} : { stripped: true }),
      patternCards: cardsFor(t.newPatterns),
    })),
    drills: (track.drills || []).map((d, i) => ({
      afterOrder: d.afterOrder,
      title: d.title,
      style: d.style,
      patterns: d.patterns || [],
      // 드릴 items 에도 answer·why 가 실리므로 글과 같은 규칙으로 스트립
      items: open.has(drillId(i)) ? d.items || [] : [],
      ...(open.has(drillId(i)) ? {} : { stripped: true }),
      patternCards: cardsFor(d.patterns),
    })),
  };
}
