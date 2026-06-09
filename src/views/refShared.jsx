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
      {meta.key}
    </span>
  );
}
