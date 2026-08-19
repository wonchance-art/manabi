// 문장 이동(▲ 위 / ▼ 아래) — 지정 가능한 문장 목록과 이동 대상 계산(오너 승인 2026-08-19).
// "문장"의 단위는 문장 막대(¦)가 붙는 단위와 동일해야 한다: 본문 줄 중 토큰이 있고
// 정리된 텍스트가 2자 이상인 줄. 여기 조건이 렌더(ViewerPage lineHead)와 어긋나면
// 버튼이 막대 없는 줄로 이동하는 불일치가 생긴다 — 계약 테스트로 동조를 지킨다.

/** 렌더와 동일한 줄 텍스트 정리(헤딩 마커 제거) */
export function cleanLineText(rawLine) {
  return (rawLine ?? '').trim().replace(/^#{1,3}\s/, '');
}

/**
 * 지정 가능한 문장 목록 — [{ rawIdx, text, firstTokenId }] (본문 순서).
 * lineGroups: [{ rawIdx, tokenIds }] (ViewerPage가 sequence에서 파생하는 것과 동일 구조)
 */
export function pickableSentences(lineGroups, rawLines) {
  const out = [];
  for (const group of lineGroups || []) {
    if (!group.tokenIds?.length) continue;
    const text = cleanLineText(rawLines?.[group.rawIdx]);
    if (text.length < 2) continue; // 막대(¦)와 동일 임계 — 구두점 홀로 남은 줄 등 제외
    out.push({ rawIdx: group.rawIdx, text, firstTokenId: group.tokenIds[0] });
  }
  return out;
}

/**
 * 현재 지정(rawIdx)에서 dir(+1 아래 / -1 위)만큼 이동한 대상.
 * 경계 밖이면 null(버튼은 비활성 — 순환 없음). 현재 지정이 목록에 없으면
 * (예: 지정 줄이 재분석으로 사라짐) 방향 기준 가장 가까운 문장으로 회복한다.
 */
export function adjacentSentence(sentences, currentRawIdx, dir) {
  if (!sentences?.length) return null;
  const i = sentences.findIndex((s) => s.rawIdx === currentRawIdx);
  if (i !== -1) return sentences[i + dir] ?? null;
  // 회복 경로: 아래 이동이면 현재보다 뒤 첫 문장, 위 이동이면 앞 마지막 문장
  return dir > 0
    ? sentences.find((s) => s.rawIdx > currentRawIdx) ?? null
    : [...sentences].reverse().find((s) => s.rawIdx < currentRawIdx) ?? null;
}
