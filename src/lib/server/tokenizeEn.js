// 서버 전용 — 영어 토큰화 (kuromoji 같은 형태소 분석 없이 공백+구두점 분리)
// base_form은 소문자화된 surface로 사용 (run/running/ran 는 별도 키로 취급)
// 완벽한 lemmatization 대신 실용적 캐시 히트율 우선

/**
 * 한 줄을 토큰으로 분리
 * 반환 형식은 tokenizeJa와 호환 (surface/base_form/pos/furigana)
 */
export function tokenizeEnLine(line) {
  if (!line || !line.trim()) return [];

  // 단어 + 구두점 분리 정규식
  // - 축약형(I'm, don't) 유지
  // - 소유격('s)은 단어에 포함
  // - 구두점은 별도 토큰
  const PATTERN = /([A-Za-z][A-Za-z'\-]*[A-Za-z]?|[A-Za-z]|[.,!?;:"'()\[\]]|\d+)/g;
  const tokens = [];
  let match;
  while ((match = PATTERN.exec(line)) !== null) {
    const surface = match[0];
    const isPunct = /^[.,!?;:"'()\[\]]$/.test(surface);
    const isNumber = /^\d+$/.test(surface);

    tokens.push({
      text: surface,
      base_form: isPunct ? surface : surface.toLowerCase(),
      furigana: '', // 영어는 IPA 안 씀
      pos: isPunct ? '기호' : isNumber ? '수사' : null, // 나머지는 Gemini가 채움
    });
  }
  return tokens;
}
