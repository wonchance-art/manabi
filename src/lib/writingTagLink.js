/**
 * 작문 첨삭의 오류 태그 → 관련 문법 챕터 매칭.
 * AI가 붙인 자유 문자열 태그("조사 が", "성수 일치")를 레지스트리의
 * topic·제목·섹션 텍스트와 대조해 가장 그럴듯한 챕터를 찾는다.
 * 서버(API)에서만 호출 — 콘텐츠가 클라이언트 번들로 새지 않는다.
 */

/**
 * @param {Object} ref - getRefLang(...) 레지스트리 (ALL_CHAPTERS 사용)
 * @param {string} tag - 오류 태그
 * @returns {{slug: string, title: string, level: string} | null}
 */
export function findChapterForTag(ref, tag) {
  const t = String(tag || '').trim();
  if (!ref?.ALL_CHAPTERS || !t || t === '기타') return null;
  const tokens = t.split(/[\s·,/()]+/).filter(Boolean);
  if (tokens.length === 0) return null;

  let best = null;
  let bestScore = 0;
  for (const ch of ref.ALL_CHAPTERS) {
    const topic = ch.topic || '';
    const title = ch.title || '';
    const heads = (ch.sections || [])
      .map(s => `${s.heading || ''} ${s.patternKo || ''} ${s.pattern || ''}`)
      .join(' ');

    let score = 0;
    if (topic.includes(t)) score = 4;                 // topic이 태그를 통째로 포함 — 최상
    else if (heads.includes(t)) score = 3;            // 섹션 제목·패턴에 통째로
    else if (
      tokens.every(tok => (topic + ' ' + title + ' ' + heads).includes(tok)) &&
      tokens.some(tok => topic.includes(tok) || title.includes(tok))
    ) {
      // 토큰 전부 등장 + 최소 하나는 topic/제목에 — 한 글자 조사(が 등)의 과잉 매칭 방지
      score = 2;
    }
    if (score > bestScore) { best = ch; bestScore = score; }
  }
  return best ? { slug: best.slug, title: best.title, level: best.level } : null;
}

/**
 * 첨삭 결과의 모든 오류에 href를 부착 (매칭 실패 시 그대로 둠).
 * 같은 태그는 캐시로 1회만 검색.
 */
export function attachTagLinks(feedback, ref) {
  if (!feedback?.sentences || !ref?.base) return feedback;
  const cache = new Map();
  for (const s of feedback.sentences) {
    for (const e of s.errors || []) {
      if (!cache.has(e.tag)) cache.set(e.tag, findChapterForTag(ref, e.tag));
      const hit = cache.get(e.tag);
      if (hit) e.href = `${ref.base}/grammar/${hit.slug}`;
    }
  }
  return feedback;
}
