// 「그림 한 장 읽기」 해설 원문 받기 — 출처 응답 → 카탈로그 text (ART-P0-2).
//
// 해설은 출처에서 받은 그대로 싣고 SHA-256으로 묶는다(artCatalog.textSha256). 다만 출처마다 응답 모양이 달라
// 「그대로」의 뜻을 한 함수로 고정한다 — 시카고 미술관 description은 HTML 조각이라 태그를 벗기고,
// ColBase 解説은 평문이라 줄바꿈만 맞춘다. 낱말·문장부호는 어느 쪽도 바꾸지 않는다.
// 받는 일(네트워크)은 scripts/fetch-art-description.mjs가 하고, 이 파일은 순수 함수만 둔다.

const ENTITIES = Object.freeze({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' });

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/**
 * 출처 문자열 → 카탈로그 해설 text. 문단은 빈 줄 하나로 나눈다.
 *   · 줄바꿈 CRLF·CR → LF, 문단 태그(</p><p>)는 빈 줄, <br>은 줄바꿈, 나머지 태그는 지운다(속 글자는 남긴다).
 *   · HTML 엔티티를 글자로 푼다.
 *   · 줄 끝 공백과 줄 앞 ASCII 공백·탭만 지운다 — 일본어 문단 머리 전각 공백(U+3000)은 원문 그대로 둔다.
 *   · 빈 줄이 여럿이면 하나로, 앞뒤 빈 줄은 지운다.
 */
export function artSourceText(raw) {
  if (typeof raw !== 'string') return '';
  const text = raw
    .replace(/\r\n?/g, '\n')
    .replace(/<\/p>\s*<p\b[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?p\b[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/^[ \t]+/, '').replace(/[ \t\u00a0]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '');
}

/**
 * 출처별 받는 곳 — API 주소, 응답에서 해설 문자열 꺼내기, 사람이 여는 원문 페이지.
 * 카탈로그 description.source 값이 키다(artCatalog의 source와 같은 이름).
 */
export const ART_SOURCES = Object.freeze({
  aic: Object.freeze({
    apiUrl: (id) => `https://api.artic.edu/api/v1/artworks/${encodeURIComponent(id)}?fields=id,title,description`,
    rawText: (json) => json?.data?.description ?? '',
    pageUrl: (id) => `https://www.artic.edu/artworks/${encodeURIComponent(id)}`,
  }),
});
