/**
 * 공통 섹션 헤더 — 페이지/카드 안 섹션 제목 일관화
 */
export default function SectionHeader({ icon, title, meta, action, level = 2 }) {
  const Tag = level === 2 ? 'h2' : 'h3';
  return (
    <div className="u-row u-row--between u-mb-sm" style={{ alignItems: 'baseline' }}>
      <Tag style={{ fontSize: level === 2 ? '1rem' : '0.92rem', fontWeight: 700, margin: 0 }}>
        {icon && <span style={{ marginRight: 6 }}>{icon}</span>}
        {title}
      </Tag>
      <div className="u-row u-row--gap-sm">
        {meta && <span className="u-text-xs u-text-muted">{meta}</span>}
        {action}
      </div>
    </div>
  );
}
