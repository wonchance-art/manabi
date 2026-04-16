/**
 * 일본어·영어 텍스트의 문단 경계를 자동 감지해서 빈 줄을 삽입.
 * 이미 빈 줄로 구분돼 있으면 그대로 유지.
 *
 * 감지 기준:
 * - 전각 스페이스(　) 들여쓰기 시작 → 새 문단
 * - 「 대화 시작 → 새 문단
 * - 마크다운 헤딩 (# ) → 새 문단
 * - 이전 줄이 문장 종결(。！？!?)로 끝나고, 현재 줄이 새 문장 시작 → 새 문단 후보
 *   (단, 짧은 줄 연속은 문단 내 줄바꿈일 수 있어 보수적으로 처리)
 */
export function autoSplitParagraphs(rawText) {
  if (!rawText) return rawText;

  const lines = rawText.split('\n');

  // 이미 빈 줄이 충분하면(전체 줄의 5% 이상) 추가 분리 안 함
  const blankCount = lines.filter(l => !l.trim()).length;
  if (blankCount >= lines.length * 0.05 && blankCount >= 2) return rawText;

  const SENTENCE_END = /[。！？!?」』]$/;
  const PARAGRAPH_START = /^[　\u3000「『【#＃※●■□▶▷►☆★・]/;

  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const prevTrimmed = i > 0 ? lines[i - 1].trim() : '';

    // 현재 줄이 빈 줄이면 그냥 추가
    if (!trimmed) {
      result.push(line);
      continue;
    }

    // 첫 줄은 빈 줄 안 넣음
    if (i === 0) {
      result.push(line);
      continue;
    }

    // 이전 줄이 빈 줄이면 이미 분리됨
    if (!prevTrimmed) {
      result.push(line);
      continue;
    }

    let shouldBreak = false;

    // 전각 들여쓰기 / 대화 / 마크다운 헤딩 시작 → 새 문단
    if (PARAGRAPH_START.test(trimmed)) {
      shouldBreak = true;
    }
    // 이전 줄이 문장 종결로 끝나고, 현재 줄도 문단 시작 패턴이거나 충분히 길면
    else if (SENTENCE_END.test(prevTrimmed) && trimmed.length > 10) {
      // 대화문 연속(」→「)은 이미 위에서 처리됨
      // 서술문이 끝나고 새 서술문이 시작되는 경우
      if (PARAGRAPH_START.test(trimmed) || /^[ぁ-ん]/.test(trimmed) || /^[A-Z]/.test(trimmed)) {
        shouldBreak = true;
      }
    }

    if (shouldBreak) {
      result.push(''); // 빈 줄 삽입
    }
    result.push(line);
  }

  return result.join('\n');
}
