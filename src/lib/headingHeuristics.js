/**
 * 뷰어 헤딩 자동 감지 — 명시적 #{1,3} 마크다운 + 휴리스틱.
 *
 * 오탐 가드(#988): EPUB 전형 배열(문단 사이 빈 줄·문단 안 연속 줄)에서 문단 첫 줄에 온
 * 대사("……。")가 "앞 빈 줄 + 짧음 + 마침표 없음(닫는 따옴표는 문장 끝 목록에 없었음) +
 * 뒤 긴 줄"을 모두 만족해 h2로 승격 — 본문 글자 크기가 줄마다 널뛰었다.
 *  - 닫는 따옴표·쉼표·콜론 등으로 끝나면 본문
 *  - 여는 따옴표·인용부로 시작하면 본문(대사)
 */

// 문장(본문)으로 보이는 끝 — 종결부호 + 닫는 괄호·인용부 + 이어짐 부호(쉼표·콜론류).
// 곡선 따옴표는 \u 이스케이프로 명시(리터럴로 쓰면 편집 도구가 ASCII로 정규화하는 사고가 있었다).
const SENTENCE_END = /[。！？!?.…」』)）】\]》>~〜“”‘’"'，,、；;：:]$/;
// 대사·인용 시작 부호
const QUOTE_START = /^[“”‘’"'「『《〈（(]/;

/**
 * @param {string[]} rawLines - 원문 줄 배열
 * @returns {number[]} 줄별 헤딩 레벨 (0 = 본문)
 */
export function computeHeadingLevels(rawLines) {
  return rawLines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return 0;

    // 명시적 마크다운
    const md = trimmed.match(/^(#{1,3})\s/);
    if (md) return md[1].length;

    // 대사·인용으로 시작하는 줄은 본문
    if (QUOTE_START.test(trimmed)) return 0;

    const len = trimmed.length;
    const nextLine = rawLines[idx + 1]?.trim() || '';
    const prevLine = rawLines[idx - 1]?.trim() || '';
    const endsWithPunctuation = SENTENCE_END.test(trimmed);

    // 첫 줄이고 짧고 마침표 없으면 → h1 (제목)
    if (idx === 0 && len <= 40 && !endsWithPunctuation) return 1;

    // 짧은 줄 + 마침표 없음 + 앞이 빈줄(또는 첫줄) + 뒤에 긴 줄 → h2
    if (len <= 30 && !endsWithPunctuation
        && (!prevLine || prevLine === '')
        && nextLine.length > len * 1.5) return 2;

    // 좀 더 긴 짧은 줄 + 마침표 없음 + 앞 빈줄 → h3
    if (len <= 50 && len > 1 && !endsWithPunctuation
        && (!prevLine || prevLine === '')
        && nextLine.length > len) return 3;

    return 0;
  });
}
