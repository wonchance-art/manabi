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

export function alignFurigana(ja, yomiRaw) {
  if (!ja || !yomiRaw) return null;
  if (/[가-힣]/.test(yomiRaw)) return null;          // 한글 병기(OT) — 정렬 대상 아님
  if (![...ja].some(isKanjiLike)) return null;       // 한자 없음 — 루비 불필요

  const yomi = kataToHira(yomiRaw.replace(/[\s　]+/g, ''));
  // ja → [한자 구간 | 가나·기호 구간] 세그먼트
  const segs = [];
  for (const ch of ja) {
    const t = isKanjiLike(ch) ? 'k' : 'p';
    if (segs.length && segs[segs.length - 1].t === t) segs[segs.length - 1].s += ch;
    else segs.push({ t, s: ch });
  }

  let yi = 0;
  const out = [];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (seg.t === 'p') {
      const norm = kataToHira(seg.s.replace(/[\s　]+/g, ''));
      for (const c of norm) {
        if (yi < yomi.length && yomi[yi] === c) yi++;
        else if (PUNCT.includes(c)) continue;          // yomi 쪽에 구두점이 없는 경우 허용
        else return null;
      }
      out.push({ text: seg.s });
    } else {
      // 다음 가나 구간의 첫 글자를 앵커로 한자 독음 범위를 결정
      let endIdx = yomi.length;
      const next = segs[i + 1];
      if (next) {
        const anchorNorm = kataToHira(next.s.replace(/[\s　]+/g, ''));
        const anchor = [...anchorNorm].find(c => !PUNCT.includes(c));
        if (anchor) {
          const found = yomi.indexOf(anchor, yi + 1);
          if (found === -1) return null;
          endIdx = found;
        }
      }
      const rt = yomi.slice(yi, endIdx);
      if (!rt) return null;
      out.push({ text: seg.s, rt });
      yi = endIdx;
    }
  }
  if (yi < yomi.length) return null;                   // 남는 독음 — 정렬 신뢰 불가
  return out;
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
