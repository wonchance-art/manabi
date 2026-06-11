/**
 * 언어 레퍼런스 공용 렌더링 헬퍼 (프랑스어·일본어·영어)
 * 콘텐츠 본문은 **굵게** 마크업만 지원 (각 언어 SCHEMA.md 참고)
 */

/** "**굵게**" 마크업을 <strong>으로 변환 */
export function refInline(text) {
  if (!text) return null;
  return String(text)
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

/** 예문·단어의 원문/발음 필드 — 언어별 키를 흡수 */
export function refMain(item) {
  return item.fr ?? item.ja ?? item.en ?? '';
}
export function refPron(item) {
  return item.ipa ?? item.yomi ?? null;
}

/* ── 일본어 요미가나(루비) 정렬 ──
 * ja(한자 혼용)와 yomi(전체 히라가나)를 정렬해 한자 구간에만 후리가나를 단다.
 * 정렬 실패(한글 병기·특수 표기 등) 시 null → 호출부가 기존 표기로 폴백.
 */
const isKanjiLike = ch => /[一-鿿々〆ヶ0-9０-９]/.test(ch);
const kataToHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const PUNCT = '。、・！？!?,. 　「」『』();（）:〜';

// 한자 독음(rt) 후보 제약 — 독음은 가나로만 구성되고, 음절 경계상 올 수 없는 글자로 시작하지 않는다.
const isKanaCh = c => (c >= 'ぁ' && c <= 'ゖ') || c === 'ー';
const RT_BAD_START = 'んっーゃゅょぁぃぅぇぉゎ';
const UO_VOWEL = 'うくすつぬふむゆるぐずづぶぷぅゅょおこそとのほもよろをごぞどぼぽぉ'; // う단·お단 — 뒤따르는 「う」는 장음
const SMALL_KANA = 'ぁぃぅぇぉゃゅょゎっー';
const moraLen = rt => rt.reduce((n, c) => n + (SMALL_KANA.includes(c) ? 0 : 1), 0); // 한자당 독음 길이 추정용

export function alignFurigana(ja, yomiRaw) {
  if (!ja || !yomiRaw) return null;
  if (/[가-힣]/.test(yomiRaw)) return null;          // 한글 병기(OT) — 정렬 대상 아님
  if (![...ja].some(isKanjiLike)) return null;       // 한자 없음 — 루비 불필요

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
  return r ? r.parts : null;                           // 정렬 불가 — 정렬 신뢰 불가
}

/** 일본어 텍스트 — 한자 위 요미가나 루비, 실패 시 기존(원문+독음) 폴백 */
const normJa = s => kataToHira(String(s || '').replace(/[\s　]+/g, '')).replace(/[。、・！？!?,.「」『』]/g, '');

export function JaText({ ja, yomi, fallbackPron = true }) {
  const segs = alignFurigana(ja, yomi);
  if (!segs) {
    // 가나 전용 문장은 독음이 원문과 같으므로 중복 표시하지 않음
    const showPron = fallbackPron && yomi && normJa(yomi) !== normJa(ja);
    return (
      <>
        <span lang="ja">{ja}</span>
        {showPron && <span className="fr-example__ipa">{yomi}</span>}
      </>
    );
  }
  return (
    <span lang="ja" className="ja-ruby">
      {segs.map((s, i) =>
        s.rt
          ? <ruby key={i}>{s.text}<rt>{s.rt}</rt></ruby>
          : <span key={i}>{s.text}</span>
      )}
    </span>
  );
}

/** 섹션 콜아웃 — 렌더 순서 고정 */
export const CALLOUT_ORDER = ['pitfall', 'vsKo', 'vsEn', 'hanja', 'etym', 'tip'];

export const CALLOUT_KINDS = {
  pitfall: { icon: '🚨', label: '한국인이 헷갈리는 포인트', cls: 'fr-callout--pitfall' },
  vsKo:    { icon: '🇰🇷', label: '한국어와 비교', cls: 'fr-callout--vsen' },
  vsEn:    { icon: '🇬🇧', label: '영어와 비교', cls: 'fr-callout--vsen' },
  hanja:   { icon: '🈶', label: '한자어 연결', cls: 'fr-callout--etym' },
  etym:    { icon: '🌱', label: '어원 연결', cls: 'fr-callout--etym' },
  tip:     { icon: '💡', label: '팁', cls: 'fr-callout--tip' },
};

export function Callout({ kind, text }) {
  const k = CALLOUT_KINDS[kind];
  if (!k || !text) return null;
  return (
    <div className={`fr-callout ${k.cls}`}>
      <span className="fr-callout__label">
        <span aria-hidden="true">{k.icon}</span> {k.label}
      </span>
      <p className="fr-callout__body">{refInline(text)}</p>
    </div>
  );
}

/** 레벨 동그라미 배지 */
export function LevelDot({ meta, size = 'md' }) {
  if (!meta) return null;
  return (
    <span
      className={`fr-level-dot ${size === 'sm' ? 'fr-level-dot--sm' : ''}`}
      style={{ background: meta.bg, border: `2px solid ${meta.color}`, color: meta.color }}
    >
      {meta.short || meta.key}
    </span>
  );
}
