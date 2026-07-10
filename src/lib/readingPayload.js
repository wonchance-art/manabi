/**
 * 독해 트랙 서버 페이로드 빌더 — 정답표 노출 최소화(P2-7 최소분).
 *
 * 배경: 순차 잠금은 클라이언트 UX 경계일 뿐이라, 트랙 전체를 props 로 내리면
 * 잠긴 글의 questions(answer·why = 정답표)까지 RSC 응답에 통째로 실린다.
 * 그래서 문항 포함 범위를 **서버가 아는 통과 집합** 기준으로 자른다:
 *   포함 = 통과 노드 전부 + 잠금 체인상 다음 열린 노드 1개
 *        + (열린 노드가 글이면) 같은 위치(afterOrder)의 드릴
 * 드릴 선포함 근거: 글 통과 직후 그 위치의 드릴이 즉시 열리는데, 그 시점의
 * 서버 재조회(router.refresh)는 통과 upsert 와 경합할 수 있다 — 한 걸음만
 * 미리 내려 두면 통과→드릴 진입이 왕복 없이 이어진다(그다음 글부터는 재조회).
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
 * 게스트(빈 통과 집합)는 order 1 글(+그 위치의 드릴)만 열린다.
 * @param {object} track - 원본 트랙(getReadingTrack 결과)
 * @param {Iterable<string>} passedIds - 서버가 아는 통과 글/드릴 id 집합
 * @returns {Set<string>}
 */
export function questionOpenIds(track, passedIds) {
  const stated = nodeStates(buildNodes(track), passedIds);
  const open = new Set();
  let openTextIdx = -1;
  for (let i = 0; i < stated.length; i++) {
    const n = stated[i];
    if (n.status === 'passed' || n.status === 'open') open.add(n.id);
    if (n.status === 'open' && n.kind === 'text') openTextIdx = i;
  }
  // 열린 글 **바로 다음** 노드가 드릴이면 그 1개만 선포함 — 글 통과 즉시 열리는 "한 걸음"
  // (열린 노드가 드릴이면 선포함 없음: 드릴 통과 후엔 어차피 재조회가 돈다). 같은 afterOrder 에
  // 드릴이 여럿이어도 체인상 다음 1개만 — 2번째 드릴은 1번째 통과 후에야 열린다(P2-6).
  if (openTextIdx >= 0) {
    const nextNode = stated[openTextIdx + 1];
    if (nextNode && nextNode.kind === 'drill') open.add(nextNode.id);
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
