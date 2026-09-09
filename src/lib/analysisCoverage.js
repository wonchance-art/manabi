// 줄 번호는 원문 좌표다. last_idx나 임시 토큰의 존재만으로 완료를 판정하지 않는다.
export function analysisTokenLine(id) {
  const match = typeof id === 'string' && /^(?:id|br|failed)_(\d+)_/.exec(id);
  return match ? Number(match[1]) : null;
}

const normalize = value => value.normalize('NFC').replace(/\s/g, '');

export function inspectAnalysisCoverage(text, json) {
  const lines = text.split('\n');
  const lineIds = new Map(), contents = new Map(), broken = new Set(), seen = new Set();
  let validStructure = !json?.sequence || Array.isArray(json.sequence);
  let previousLine = -1;
  for (const id of Array.isArray(json?.sequence) ? json.sequence : []) {
    const line = analysisTokenLine(id);
    if (line === null || line >= lines.length || seen.has(id) || line < previousLine) {
      validStructure = false;
      continue;
    }
    seen.add(id);
    previousLine = line;
    if (!lineIds.has(line)) lineIds.set(line, []);
    lineIds.get(line).push(id);
    const token = json?.dictionary?.[id];
    if (!token || typeof token.text !== 'string' || token.failed || id.startsWith('failed_') || (id.startsWith('br_') && token.pos !== '개행')) {
      broken.add(line);
    } else if (token.pos === '개행') {
      if (token.text.trim()) broken.add(line);
    } else {
      contents.set(line, (contents.get(line) || '') + token.text);
    }
  }
  if (json?.failed_indices != null && !Array.isArray(json.failed_indices)) validStructure = false;
  for (const line of Array.isArray(json?.failed_indices) ? json.failed_indices : []) {
    if (!Number.isInteger(line) || line < 0 || line >= lines.length) validStructure = false;
    else broken.add(line);
  }
  const missingIndices = [];
  lines.forEach((line, index) => {
    if (line.trim() && (broken.has(index) || normalize(line) !== normalize(contents.get(index) || ''))) missingIndices.push(index);
    // 빈 줄에 글자가 붙은 결과도 완료로 저장하지 않는다.
    if (!line.trim() && (broken.has(index) || normalize(contents.get(index) || ''))) validStructure = false;
  });
  return { validStructure, missingIndices, lineIds };
}

// 분석 요청은 문단 단위여도 정상 줄의 식별자·독음·뜻은 교체하지 않는다.
export function mergeReanalysisLines(text, original, result, selected) {
  const before = inspectAnalysisCoverage(text, original);
  const after = inspectAnalysisCoverage(text, result);
  if (!before.validStructure || !after.validStructure) throw new Error('분석 결과의 줄 위치가 올바르지 않아 기존 분석을 유지합니다.');
  const targets = new Set(selected), sequence = [], dictionary = {};
  const lines = text.split('\n');
  for (let line = 0; line < lines.length; line++) {
    const useResult = targets.has(line) || (!lines[line].trim() && !before.lineIds.has(line));
    const source = useResult ? result : original;
    const ids = (useResult ? after : before).lineIds.get(line) || [];
    for (const id of ids) {
      sequence.push(id);
      dictionary[id] = source.dictionary[id];
    }
  }
  const failed_indices = [...new Set([
    ...(original?.failed_indices || []).filter(line => !targets.has(line)),
    ...(result?.failed_indices || []).filter(line => targets.has(line)),
  ])];
  return { ...result, sequence, dictionary, failed_indices, status: failed_indices.length ? 'partial' : 'completed' };
}
