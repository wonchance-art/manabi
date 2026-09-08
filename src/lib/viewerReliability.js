// 화면과 저장은 같은 문맥 토큰을 사용한다. 표기가 같다는 사실은 뜻 일치의 증거가 아니다.
export function contextualMeaning(token) {
  return typeof token?.meaning === 'string' ? token.meaning : '';
}

export function refreshViewerToken(selected, json) {
  if (!selected?.id || !json?.dictionary?.[selected.id]) return null;
  return { ...json.dictionary[selected.id], id: selected.id };
}

export function referenceMatchesContext(token, word) {
  if (!token || !word || !contextualMeaning(token).trim()) return false;
  const reading = token.furigana || token.reading;
  const normalizeReading = value => value.normalize('NFC').replace(/\s/g, '').toLowerCase();
  return contextualMeaning(token).trim() === word.ko?.trim()
    && (!reading || !word.pinyin || normalizeReading(reading) === normalizeReading(word.pinyin));
}

export function createViewerRequestGate() {
  let current = null;
  return {
    start() {
      current?.abort();
      current = new AbortController();
      return current;
    },
    isCurrent(request) { return current === request && !request.signal.aborted; },
    cancel() { current?.abort(); current = null; },
  };
}

// 해시는 원문 전체와 계정/자료/판본/뜻을 포함한다. 원문을 키에 잘라 넣지 않는다.
export async function viewerCacheKey(kind, scope, input) {
  const bytes = new TextEncoder().encode(JSON.stringify([scope, input]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `${kind}:v2:${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}`;
}

export function viewerCommandAllowed(event, { cardOpen, blocked }) {
  if (!cardOpen || blocked || event.defaultPrevented || event.isComposing || event.repeat) return false;
  const target = event.target;
  if (target?.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return false;
  const card = target?.closest?.('.word-detail-card');
  return !!card && card.getClientRects().length > 0;
}
