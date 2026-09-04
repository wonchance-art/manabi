/**
 * 본문 첫 줄로 제목 채우기(자료 추가 정돈 R2, #1077 5547576227).
 *
 * 제목 칸이 비었을 때만 쓴다 — 입력한 제목은 절대 덮지 않는다(호출측 계약). 첫 **내용** 줄(빈 줄
 * 건너뜀)을 공백 정리해 `max`자에서 자른다. EPUB 챕터 제목 추정(epub.js guessChapterTitle)과
 * 같은 40자 기준 — 카드 제목 한 줄에 드는 길이.
 */
export const TITLE_MAX_CHARS = 40;

export function titleFromBody(text, max = TITLE_MAX_CHARS) {
  const s = String(text || '');
  let start = 0;
  // 첫 내용 줄만 본다 — 50k 본문을 통째로 split하지 않는다.
  while (start < s.length) {
    let end = s.indexOf('\n', start);
    if (end === -1) end = s.length;
    const line = s.slice(start, end).replace(/\s+/g, ' ').trim();
    if (line) return line.length > max ? `${line.slice(0, max).trimEnd()}…` : line;
    start = end + 1;
  }
  return '';
}
