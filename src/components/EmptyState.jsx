/**
 * 공통 빈 상태 컴포넌트
 * @param {string} icon - 이모지/문자
 * @param {string} title - 메인 메시지
 * @param {string} desc - 보조 설명 (선택)
 * @param {ReactNode} action - 액션 버튼/링크 (선택)
 * @param {string} variant - 'default' | 'compact' (carded vs minimal)
 */
export default function EmptyState({ icon = '📭', title, desc, action, variant = 'default' }) {
  return (
    <div className={`empty-state ${variant === 'compact' ? 'empty-state--compact' : ''}`}>
      <div className="empty-state__icon">{icon}</div>
      {title && <p className="empty-state__msg">{title}</p>}
      {desc && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 320, marginBottom: action ? 16 : 0, lineHeight: 1.6 }}>
          {desc}
        </p>
      )}
      {action}
    </div>
  );
}
