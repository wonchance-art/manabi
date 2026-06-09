/**
 * 프랑스어 레퍼런스 공용 렌더링 헬퍼
 * 콘텐츠 본문은 **굵게** 마크업만 지원 (SCHEMA.md 참고)
 */

/** "**굵게**" 마크업을 <strong>으로 변환 */
export function frInline(text) {
  if (!text) return null;
  return String(text)
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

/** 섹션 콜아웃 — 렌더 순서 고정 */
export const CALLOUT_ORDER = ['pitfall', 'vsEn', 'etym', 'tip'];

export const CALLOUT_KINDS = {
  pitfall: { icon: '🚨', label: '한국인이 헷갈리는 포인트', cls: 'fr-callout--pitfall' },
  vsEn:    { icon: '🇬🇧', label: '영어와 비교', cls: 'fr-callout--vsen' },
  etym:    { icon: '🌱', label: '라틴어 뿌리 — 영어와 연결', cls: 'fr-callout--etym' },
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
      <p className="fr-callout__body">{frInline(text)}</p>
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
