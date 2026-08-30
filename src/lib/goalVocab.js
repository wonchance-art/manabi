/**
 * 목표 어휘 커버리지 — 순수 계산 (v2-D R3, #1077 설계 §3).
 *
 * ── 왜 필요한가
 *
 * 계획표에는 처음부터 "어휘는 제외"라고 적혀 있었다(설계 §0 문제 ③). 그런데 HSK5든 B2든
 * 문법 챕터만 끝낸다고 도달하는 목표가 아니다 — 정본은 레벨마다 어휘를 갖고 있고,
 * 사용자는 이미 단어를 담고 '이미 앎'을 찍고 있는데 그 둘이 목표와 만나지 않았다.
 *
 * 여기서 하는 일은 하나다: **정본 어휘 중 내가 확보한 몫**. 확보는 담았거나(=FSRS 큐에
 * 들어 있거나) 이미 안다고 표시한 것 — 둘 다 "다시 배우지 않아도 되는 말"이라 한 셈에
 * 들어간다. 새로 적재하는 기록은 없다(설계 §5 이음새 신설 0).
 *
 * 조회·인덱스 로드는 소비 화면 몫이다(`weeklyReport`·`goalPace` 관례).
 */

/**
 * 내가 확보한 말의 집합.
 *
 * @param {object} p
 * @param {Array} [p.vocabRows] user_vocabulary [{ word_text, language }]
 * @param {Array} [p.knownRows] user_known_words [{ word_text }] — 조회에서 이미 언어로 좁혀 온다
 * @param {string} [p.language] 'Chinese' 등 — 단어장 행을 좁힐 언어
 * @returns {Set<string>}
 */
export function haveWordSet({ vocabRows, knownRows, language } = {}) {
  const have = new Set();
  for (const r of vocabRows || []) {
    const w = typeof r?.word_text === 'string' ? r.word_text.trim() : '';
    if (!w) continue;
    // language가 비어 있는 옛 행도 받는다. 어차피 정본 어휘와 교집합을 낼 것이라
    // 남의 언어 단어는 저절로 떨어지고, 여기서 빼 버리면 컬럼이 생기기 전에 담은
    // 단어가 통째로 사라져 "0% 확보"라는 거짓말이 된다.
    if (language && r.language && r.language !== language) continue;
    have.add(w);
  }
  for (const r of knownRows || []) {
    const w = typeof r?.word_text === 'string' ? r.word_text.trim() : '';
    if (w) have.add(w);
  }
  return have;
}

/**
 * 목표 레벨까지의 정본 어휘 커버리지.
 *
 * @param {Map<string, {level: string}>} index refVocabIndex — 단어 → { level }
 * @param {Array<string>} levelKeys 계획에 든 레벨 키(계획 순서 그대로)
 * @param {Set<string>} haveSet 확보한 말
 * @returns {object|null} 셀 것이 없으면 null — 화면은 그 줄을 그리지 않는다
 *   { total, have, pct, byLevel: [{ level, total, have }] }
 */
export function vocabCoverage(index, levelKeys, haveSet) {
  if (!index || typeof index.entries !== 'function') return null;
  const order = (levelKeys || []).filter(Boolean);
  if (order.length === 0) return null;

  // 레벨 순서는 계획이 정한다 — 인덱스 순회 순서로 두면 화면에서 레벨이 뒤섞인다.
  const byLevel = new Map(order.map((key) => [key, { level: key, total: 0, have: 0 }]));

  let total = 0;
  let have = 0;
  for (const [word, entry] of index.entries()) {
    const bucket = byLevel.get(entry?.level);
    if (!bucket) continue;                       // 목표 밖 레벨(H6·생활 등)은 세지 않는다
    bucket.total += 1;
    total += 1;
    if (haveSet?.has(word)) { bucket.have += 1; have += 1; }
  }

  if (total === 0) return null;
  return {
    total,
    have,
    pct: Math.round((have / total) * 100),
    // 어휘가 0인 레벨(OT 등)은 줄에서 뺀다 — "OT 0/0"은 아무것도 말하지 않는다.
    byLevel: [...byLevel.values()].filter((b) => b.total > 0),
  };
}
