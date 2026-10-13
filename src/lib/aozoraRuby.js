// 분석 토큰과 青空文庫 원문 루비(저자 독음)를 문자 범위로 결합하는 순수 경계.
// 원문 루비가 토큰 하나와 **정확히** 일치할 때만 분석기 독음을 덮고, 추정 분할은 하지 않는다
// (독음을 쪼개 맞추면 정책 §1.1의 「가짜 요미」와 같은 사고가 난다).
//
// 우선순위(설계 §7 · P0 확정): 사용자 교정 > 저자 루비 > 분석기.
//   · 분석기 < 저자 루비: analyzeText 말미 훅(applyMaterialRubyLocks)이 재분석마다 다시 덮는다.
//   · 저자 루비 < 사용자 교정: 교정 적용(applyTokenCorrections)과 재분석 보존(preserveReanalysisTokens)이
//     잠금 위에 교정값을 얹고 잠금 표식을 지운다(clearRubyLockOnCorrection).

export const RUBY_LOCK_SOURCE = 'aozora';

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
 * 여러 토큰에 걸친 루비·실패 토큰 위의 루비는 임의로 독음을 분할하지 않고 diagnostics에 남긴다.
 */
export function applyAozoraRubyLocks({ rawText, sequence, dictionary, rubyLocks }) {
  invariant(Array.isArray(rubyLocks), 'rubyLocks must be an array');
  rubyLocks.forEach((lock) => validateLock(lock, rawText));
  const orderedLocks = rubyLocks.map((lock) => ({ ...lock })).sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 1; index < orderedLocks.length; index++) {
    invariant(orderedLocks[index - 1].end <= orderedLocks[index].start, 'ruby locks must not overlap');
  }

  const spans = indexAozoraTokenSpans(rawText, sequence, dictionary);
  const lockAt = new Map(orderedLocks.map((lock, index) => [`${lock.start}:${lock.end}`, index]));
  const appliedLockIndexes = new Set();
  const nextDictionary = { ...dictionary };
  for (const span of spans) {
    const token = dictionary[span.tokenId];
    if (token.failed || token.pos === '개행') continue;
    const lockIndex = lockAt.get(`${span.start}:${span.end}`);
    if (lockIndex == null || appliedLockIndexes.has(lockIndex) || orderedLocks[lockIndex].base !== span.text) continue;
    nextDictionary[span.tokenId] = {
      ...token,
      furigana: orderedLocks[lockIndex].reading,
      reading_source: RUBY_LOCK_SOURCE,
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

/**
 * analyzeText 말미 훅 — processed_json.metadata.literature.rubyLocks가 있을 때만 사전 독음을 저자 루비로 덮는다.
 * 유일한 분석 경로 끝에서 돌기 때문에 재분석·재시도 뒤에도 잠금이 다시 적용된다.
 * 잠금이 원문과 하나라도 어긋나면(원문 수정으로 오프셋이 낡음) **하나도 적용하지 않는다** — 낡은 오프셋이
 * 우연히 같은 글자에 걸려 다른 문맥의 독음을 덮는 일을 막는다(fail-closed). 분석 결과 자체는 그대로 돌려준다.
 * @returns {{json: object, diagnostics: null | {lockCount, appliedCount, unmatchedCount, skipped?: string}}}
 */
export function applyMaterialRubyLocks(rawText, json) {
  const rubyLocks = json?.metadata?.literature?.rubyLocks;
  if (!Array.isArray(rubyLocks) || rubyLocks.length === 0) return { json, diagnostics: null };
  try {
    const result = applyAozoraRubyLocks({ rawText, sequence: json.sequence, dictionary: json.dictionary, rubyLocks });
    // 분석 결과는 이후 단계(교정 보존·저장)가 수정할 수 있는 평범한 객체여야 한다 — 동결 사본을 풀어 둔다.
    const dictionary = Object.fromEntries(Object.entries(result.dictionary).map(([id, token]) => [id, { ...token }]));
    return {
      json: { ...json, dictionary },
      diagnostics: {
        lockCount: result.diagnostics.lockCount,
        appliedCount: result.diagnostics.appliedCount,
        unmatchedCount: result.diagnostics.unmatchedLocks.length,
      },
    };
  } catch (error) {
    return { json, diagnostics: { lockCount: rubyLocks.length, appliedCount: 0, unmatchedCount: rubyLocks.length, skipped: error.message } };
  }
}

/** 이미 저장된 분석에서 저자 루비가 실제로 적용된 토큰 수(적용률 검수용 — 따로 저장하지 않고 늘 다시 센다). */
export function countAppliedRubyLocks(json) {
  return (json?.sequence || []).filter((id) => json.dictionary?.[id]?.reading_source === RUBY_LOCK_SOURCE).length;
}

/**
 * 사용자 교정이 독음(furigana·reading)을 바꾸면 그 토큰은 더는 저자 루비 표시가 아니다 — 잠금 표식을 지운다.
 * 교정이 독음을 건드리지 않으면 토큰을 그대로 돌려준다.
 */
export function clearRubyLockOnCorrection(token, corrections) {
  if (!token || token.reading_source !== RUBY_LOCK_SOURCE || !corrections || typeof corrections !== 'object') return token;
  if (!Object.hasOwn(corrections, 'furigana') && !Object.hasOwn(corrections, 'reading')) return token;
  const next = { ...token };
  delete next.reading_source;
  delete next.reading_locked;
  return next;
}
