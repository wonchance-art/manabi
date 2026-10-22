// 일본어 요미가나(루비) 정렬 — 순수 함수. 레퍼런스 화면(refShared JaText)과 JLPT 단어 페이지(빌드 때 예문 루비)가 같이 쓴다.
// 화면 부품 파일(refShared.jsx)에서 옮겼다 — 서버 조립(levelListData)이 화면 모듈을 부르지 않게.

/* ── 일본어 요미가나(루비) 정렬 ──
 * ja(한자 혼용)와 yomi(전체 히라가나)를 정렬해 한자 구간에만 후리가나를 단다.
 * 정렬 실패(한글 병기·특수 표기 등) 시 null → 호출부가 기존 표기로 폴백.
 */
const isKanjiLike = ch => /[一-鿿々〆ヶ0-9０-９]/.test(ch);
export const kataToHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const PUNCT = '。、・！？!?,. 　「」『』();（）:〜';

// 한자 독음(rt) 후보 제약 — 독음은 가나로만 구성되고, 음절 경계상 올 수 없는 글자로 시작하지 않는다.
const isKanaCh = c => (c >= 'ぁ' && c <= 'ゖ') || c === 'ー';
const RT_BAD_START = 'んっーゃゅょぁぃぅぇぉゎ';
const UO_VOWEL = 'うくすつぬふむゆるぐずづぶぷぅゅょおこそとのほもよろをごぞどぼぽぉ'; // う단·お단 — 뒤따르는 「う」는 장음
const SMALL_KANA = 'ぁぃぅぇぉゃゅょゎっー';
const moraLen = rt => rt.reduce((n, c) => n + (SMALL_KANA.includes(c) ? 0 : 1), 0); // 한자당 독음 길이 추정용

// 같은 (ja,yomi) 쌍은 목록 렌더·재렌더에서 반복 호출됨 — 결과 캐시
const FURI_CACHE = new Map();

export function alignFurigana(ja, yomiRaw) {
  if (!ja || !yomiRaw) return null;
  if (/[가-힣]/.test(yomiRaw)) return null;          // 한글 병기(OT) — 정렬 대상 아님
  if (![...ja].some(isKanjiLike)) return null;       // 한자 없음 — 루비 불필요

  const cacheKey = ja + '\u0000' + yomiRaw;
  if (FURI_CACHE.has(cacheKey)) return FURI_CACHE.get(cacheKey);

  const yomi = [...kataToHira(yomiRaw.replace(/[\s　]+/g, ''))];
  // ja → [한자 구간 | 가나·기호 구간] 세그먼트
  const segs = [];
  for (const ch of ja) {
    const t = isKanjiLike(ch) ? 'k' : 'p';
    if (segs.length && segs[segs.length - 1].t === t) segs[segs.length - 1].s += ch;
    else segs.push({ t, s: ch });
  }

  // 백트래킹 정렬: 한자 구간마다 가능한 독음 길이를 모두 시도하고,
  // 비용 Σ(독음길이−한자길이)² 가 최소인 전역 정렬을 채택한다(동점이면 앞 구간이 긴 쪽).
  const N = yomi.length;
  const memo = new Map();
  // afterRt: 직전에 소비한 yomi 글자가 한자 독음(rt)이었는지 — 한자↔한자 경계에서만 장음 규칙 적용
  function solve(si, yi, afterRt) {
    if (si === segs.length) {
      let j = yi;
      while (j < N && PUNCT.includes(yomi[j])) j++;    // 꼬리 구두점 허용
      return j === N ? { cost: 0, parts: [] } : null;
    }
    const key = (si * 4096 + yi) * 2 + (afterRt ? 1 : 0);
    if (memo.has(key)) return memo.get(key);
    const seg = segs[si];
    let best = null;
    if (seg.t === 'p') {
      const norm = kataToHira(seg.s.replace(/[\s　]+/g, ''));
      let j = yi, ok = true;
      for (const c of norm) {
        while (j < N && yomi[j] !== c && PUNCT.includes(yomi[j])) j++; // yomi 쪽 구두점 건너뜀
        if (j < N && yomi[j] === c) j++;
        else if (PUNCT.includes(c)) continue;          // yomi 쪽에 구두점이 없는 경우 허용
        else { ok = false; break; }
      }
      if (ok) {
        const rest = solve(si + 1, j, j === yi ? afterRt : false);
        if (rest) best = { cost: rest.cost, parts: [{ text: seg.s }, ...rest.parts] };
      }
    } else {
      // 다음 가나 구간의 첫 글자 — 독음이 뒤따르는 조사·오쿠리가나를 삼키는 동점 해소용
      let nextFirst = null;
      if (segs[si + 1]) {
        const nn = kataToHira(segs[si + 1].s.replace(/[\s　]+/g, ''));
        nextFirst = [...nn].find(c => !PUNCT.includes(c)) || null;
      }
      for (let end = N; end > yi; end--) {
        const rt = yomi.slice(yi, end);
        if (!rt.every(isKanaCh)) continue;
        if (RT_BAD_START.includes(rt[0])) continue;
        if (rt[0] === 'う' && afterRt && yi > 0 && UO_VOWEL.includes(yomi[yi - 1])) continue;
        const rest = solve(si + 1, end, true);
        if (!rest) continue;
        const d = moraLen(rt) - seg.s.length;
        const cost = rest.cost + 8 * d * d + (nextFirst && rt.includes(nextFirst) ? 1 : 0);
        if (!best || cost < best.cost)
          best = { cost, parts: [{ text: seg.s, rt: rt.join('') }, ...rest.parts] };
      }
    }
    memo.set(key, best);
    return best;
  }
  const r = solve(0, 0, false);
  const result = r ? r.parts : null;                   // null = 정렬 불가 — 정렬 신뢰 불가
  if (FURI_CACHE.size > 4000) FURI_CACHE.clear();
  FURI_CACHE.set(cacheKey, result);
  return result;
}

