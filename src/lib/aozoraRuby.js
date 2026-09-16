// 분석 토큰과 青空文庫 원문 루비를 문자 범위로 결합하는 순수 경계.
// 원문 루비가 토큰 하나와 정확히 일치할 때만 분석기 독음을 덮고, 추정 분할은 하지 않는다.

function invariant(condition, message) {
  if (!condition) throw new TypeError(message);
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
}

function validateLock(lock, rawText) {
  invariant(lock && typeof lock === 'object', 'ruby lock must be an object');
  invariant(Number.isInteger(lock.start) && Number.isInteger(lock.end) && lock.start >= 0 && lock.end > lock.start,
    'ruby lock must have a valid range');
  invariant(lock.end <= rawText.length, 'ruby lock exceeds raw text');
  invariant(typeof lock.base === 'string' && lock.base, 'ruby lock base is required');
  invariant(typeof lock.reading === 'string' && lock.reading, 'ruby lock reading is required');
  invariant(rawText.slice(lock.start, lock.end) === lock.base, 'ruby lock base does not match raw text');
}

/** raw_text 안에서 분석 sequence의 각 토큰이 차지하는 문자 범위를 순서대로 찾는다. */
export function indexAozoraTokenSpans(rawText, sequence, dictionary) {
  invariant(typeof rawText === 'string', 'rawText must be a string');
  invariant(Array.isArray(sequence), 'sequence must be an array');
  invariant(new Set(sequence).size === sequence.length, 'sequence token IDs must be unique');
  invariant(dictionary && typeof dictionary === 'object' && !Array.isArray(dictionary), 'dictionary must be an object');

  let cursor = 0;
  return Object.freeze(sequence.map((tokenId, sequenceIndex) => {
    const token = dictionary[tokenId];
    invariant(token && typeof token === 'object', `Missing token: ${tokenId}`);
    invariant(typeof token.text === 'string', `Token text must be a string: ${tokenId}`);
    if (token.pos === '개행') {
      const newline = rawText.indexOf('\n', cursor);
      invariant(newline >= 0, `Newline token cannot be mapped: ${tokenId}`);
      cursor = newline + 1;
      return freezeDeep({ tokenId, sequenceIndex, start: newline, end: newline + 1, text: '\n' });
    }
    invariant(token.text.length > 0, `Empty token cannot be mapped: ${tokenId}`);
    const start = rawText.indexOf(token.text, cursor);
    invariant(start >= 0, `Token cannot be mapped to raw text: ${tokenId}`);
    const span = { tokenId, sequenceIndex, start, end: start + token.text.length, text: token.text };
    cursor = span.end;
    return freezeDeep(span);
  }));
}

/**
 * 정확히 한 토큰에 맞는 원문 루비만 furigana에 적용한다.
 * 여러 토큰에 걸친 루비는 임의로 독음을 분할하지 않고 diagnostics에 남긴다.
 */
export function applyAozoraRubyLocks({ rawText, sequence, dictionary, rubyLocks }) {
  invariant(Array.isArray(rubyLocks), 'rubyLocks must be an array');
  rubyLocks.forEach((lock) => validateLock(lock, rawText));
  const orderedLocks = rubyLocks.map((lock) => ({ ...lock })).sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 1; index < orderedLocks.length; index++) {
    invariant(orderedLocks[index - 1].end <= orderedLocks[index].start, 'ruby locks must not overlap');
  }

  const spans = indexAozoraTokenSpans(rawText, sequence, dictionary);
  const appliedLockIndexes = new Set();
  const nextDictionary = { ...dictionary };
  for (const span of spans) {
    const lockIndex = orderedLocks.findIndex((lock, index) => !appliedLockIndexes.has(index)
      && lock.start === span.start && lock.end === span.end && lock.base === span.text);
    if (lockIndex < 0) continue;
    const lock = orderedLocks[lockIndex];
    nextDictionary[span.tokenId] = {
      ...dictionary[span.tokenId],
      furigana: lock.reading,
      reading_source: 'aozora',
      reading_locked: true,
    };
    appliedLockIndexes.add(lockIndex);
  }

  const unmatchedLocks = orderedLocks.filter((_, index) => !appliedLockIndexes.has(index));
  return freezeDeep({
    dictionary: nextDictionary,
    diagnostics: {
      lockCount: orderedLocks.length,
      appliedCount: appliedLockIndexes.size,
      unmatchedLocks,
    },
  });
}
