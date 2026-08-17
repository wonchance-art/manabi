const DEFAULT_LINE_TOLERANCE = 2;
const PARAGRAPH_GAP_RATIO = 1.6;

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function itemGeometry(item, index) {
  const transform = Array.isArray(item?.transform) ? item.transform : [];
  const height = Math.abs(Number(item?.height) || Number(transform[3]) || 0);
  return {
    index,
    text: String(item?.str || ''),
    x: Number(transform[4]) || 0,
    y: Number(transform[5]) || 0,
    width: Math.abs(Number(item?.width) || 0),
    height,
    hasEOL: item?.hasEOL === true,
  };
}

function shouldInsertSpace(previous, current) {
  if (!previous.text || !current.text) return false;
  if (/\s$/.test(previous.text) || /^\s/.test(current.text)) return false;
  if (/\p{Script=Han}$/u.test(previous.text) && /^\p{Script=Han}/u.test(current.text)) return false;
  if (/^[,.;:!?%)\]}、。！？）」』】]/.test(current.text)) return false;
  if (/[([{（「『【]$/.test(previous.text)) return false;

  const gap = current.x - (previous.x + previous.width);
  const referenceHeight = Math.max(previous.height, current.height, 1);
  return gap > referenceHeight * 0.16;
}

function buildLine(items) {
  const sorted = [...items].sort((a, b) => (a.x - b.x) || (a.index - b.index));
  let text = '';
  let previous = null;

  for (const item of sorted) {
    if (!item.text) continue;
    if (previous && shouldInsertSpace(previous, item)) text += ' ';
    text += item.text;
    previous = item;
  }

  return {
    text: text.replace(/[ \t]+/g, ' ').trim(),
    x: sorted[0]?.x || 0,
    y: sorted.reduce((sum, item) => sum + item.y, 0) / Math.max(sorted.length, 1),
    height: Math.max(...sorted.map(item => item.height), 0),
    hasEOL: sorted.some(item => item.hasEOL),
  };
}

/**
 * pdf.js TextContent items를 읽기 순서의 줄 단위 구조로 바꾼다.
 * 입력 객체를 수정하지 않으며 수평 텍스트의 일반적인 좌→우·상→하 흐름만 다룬다.
 */
export function groupPdfTextLines(textContentOrItems, { lineTolerance = DEFAULT_LINE_TOLERANCE } = {}) {
  const sourceItems = Array.isArray(textContentOrItems)
    ? textContentOrItems
    : textContentOrItems?.items;
  if (!Array.isArray(sourceItems) || sourceItems.length === 0) return [];

  const items = sourceItems
    .map(itemGeometry)
    .filter(item => item.text.trim());
  const lines = [];

  for (const item of items) {
    const line = lines.find(candidate => Math.abs(candidate.anchorY - item.y) <= lineTolerance);
    if (line) {
      line.items.push(item);
      line.anchorY = line.items.reduce((sum, entry) => sum + entry.y, 0) / line.items.length;
    } else {
      lines.push({ anchorY: item.y, items: [item] });
    }
  }

  return lines
    .sort((a, b) => b.anchorY - a.anchorY)
    .map(line => buildLine(line.items))
    .filter(line => line.text);
}

function joinsHyphenatedWord(previous, current) {
  return /[A-Za-z]-$/.test(previous) && /^[a-z]/.test(current);
}

/**
 * 한 PDF 페이지의 TextContent를 선택·분석 가능한 문자열로 재구성한다.
 * - 같은 줄 조각은 좌표 간격에 따라 결합
 * - 큰 세로 간격은 빈 줄로 보존
 * - 영어 줄끝 하이픈은 다음 줄의 소문자 단어와 병합
 */
export function reconstructPdfPageText(textContentOrItems, options) {
  const lines = groupPdfTextLines(textContentOrItems, options);
  if (lines.length === 0) return '';

  const verticalGaps = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    const gap = lines[index].y - lines[index + 1].y;
    if (gap > 0) verticalGaps.push(gap);
  }
  const typicalGap = median(verticalGaps);
  let result = lines[0].text;

  for (let index = 1; index < lines.length; index += 1) {
    const previous = lines[index - 1];
    const current = lines[index];
    if (joinsHyphenatedWord(previous.text, current.text)) {
      result = result.replace(/-$/, '') + current.text;
      continue;
    }

    const gap = previous.y - current.y;
    const paragraphThreshold = Math.max(
      typicalGap * PARAGRAPH_GAP_RATIO,
      Math.max(previous.height, current.height, 1) * PARAGRAPH_GAP_RATIO,
    );
    result += gap > paragraphThreshold ? `\n\n${current.text}` : `\n${current.text}`;
  }

  return result.trim();
}
