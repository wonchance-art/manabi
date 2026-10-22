// 레벨 단어 예문 나눔 · 후리가나의 짧은 꼴 — 서버(levelListData)가 줄여 싣고 카드(WordCard)가 그릴 때 되살린다.
// 배열 그대로면 RSC 페이로드의 값 하나하나를 화면이 JSON.parse 되살리기로 지나간다(H7 10만 개 중 seg가 4.9만 · N3 8.7만 중 furi · seg · lem이 6.5만).
// 문자열 하나로 묶어 그 수를 줄인다(값 손실 0 — 왕복 동치). 되살리기는 배열도 받는다(묶지 못한 값 · 시험 입력).
//   seg  중국어 「2,1,3」 = [2,1,3]
//        일본어 「2.,1-,3=する」 = seg [2,1,3] · lem [1,0,'する'] (. 조각 그대로 · - 누르지 않음 · = 원형)
//   furi 「0,2,いっさい;2,1,かた」 = [[0,2,'いっさい'],[2,1,'かた']]

const SAFE = /^[^,;=]*$/;

/** 예문 나눔 줄이기 — lem이 있으면(일본어) 조각마다 표시를 붙인다. 원형에 구분 글자가 있으면 줄이지 않는다. */
export function encodeExampleSeg(seg, lem = null) {
  if (!Array.isArray(seg)) return { seg };
  if (!Array.isArray(lem)) return { seg: seg.join(',') };
  if (lem.length !== seg.length || lem.some((l) => typeof l === 'string' && !SAFE.test(l))) return { seg, lem };
  return { seg: seg.map((n, i) => `${n}${lem[i] === 1 ? '.' : lem[i] ? `=${lem[i]}` : '-'}`).join(',') };
}

/** encodeExampleSeg를 되돌린다 — { seg: 숫자 배열 | null, lem: 배열 | null }. */
export function decodeExampleSeg(ex) {
  const raw = ex?.seg;
  if (Array.isArray(raw)) return { seg: raw, lem: Array.isArray(ex.lem) ? ex.lem : null };
  if (typeof raw !== 'string' || !raw) return { seg: null, lem: null };
  const seg = [], lem = [];
  let marked = false;
  for (const t of raw.split(',')) {
    const m = /^(\d+)(?:(\.)|(-)|=(.*))?$/.exec(t);
    if (!m) return { seg: null, lem: null };
    seg.push(Number(m[1]));
    if (m[2] || m[3] || m[4] !== undefined) marked = true;
    lem.push(m[2] ? 1 : m[3] ? 0 : m[4] ?? null);
  }
  return { seg, lem: marked ? lem : null };
}

/** 후리가나 줄이기 — 읽기에 구분 글자가 있으면 줄이지 않는다. */
export function encodeFuri(furi) {
  if (!Array.isArray(furi) || furi.some(([, , rt]) => !SAFE.test(String(rt)))) return furi;
  return furi.map(([s, n, rt]) => `${s},${n},${rt}`).join(';');
}

/** encodeFuri를 되돌린다 — [[시작, 글자 수, 읽기]] 또는 null. */
export function decodeFuri(furi) {
  if (Array.isArray(furi)) return furi;
  if (typeof furi !== 'string' || !furi) return null;
  return furi.split(';').map((t) => { const [s, n, rt] = t.split(','); return [Number(s), Number(n), rt]; });
}
