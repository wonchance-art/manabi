import Link from 'next/link';
import Button from '../components/Button';

export default function ViewerBottomSheet({
  selectedToken, isSheetOpen, setIsSheetOpen,
  ttsSupported, speak, materialLang,
  isWordSaved, saveAnim, addToVocab, user, trimOkurigana,
}) {
  if (!isSheetOpen || !selectedToken) return null;

  return (
    <>
      <div className="overlay" onClick={() => setIsSheetOpen(false)} />
      <div className="bottom-sheet">
        <div className="bottom-sheet__handle" />
        <div className="bottom-sheet__header">
          <span className="bottom-sheet__pos">{selectedToken.pos}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 className="bottom-sheet__word">{selectedToken.text}</h3>
            {ttsSupported && (
              <button
                onClick={() => speak(selectedToken.text, materialLang)}
                title="발음 듣기"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-full)',
                  padding: '4px 10px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  flexShrink: 0,
                }}
              >
                🔊
              </button>
            )}
          </div>
          {selectedToken.furigana && (() => {
            const f = trimOkurigana(selectedToken.text, selectedToken.furigana);
            return f ? <span className="bottom-sheet__furigana">[{f}]</span> : null;
          })()}
        </div>
        <p className="bottom-sheet__meaning">{selectedToken.meaning || '(뜻 정보 없음)'}</p>
        <div className="bottom-sheet__actions">
          {saveAnim ? (
            <div className="save-anim">
              <div className="save-anim__burst" aria-hidden="true">
                {Array.from({ length: 8 }, (_, i) => (
                  <span key={i} className="save-anim__star" style={{ '--angle': `${i * 45}deg` }}>⭐</span>
                ))}
              </div>
              <span className="save-anim__check">✓ 저장 완료!</span>
            </div>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setIsSheetOpen(false)} style={{ flex: 1 }}>닫기</Button>
              {user ? (
                isWordSaved
                  ? <Button variant="secondary" disabled style={{ flex: 2 }}>✓ 이미 저장됨</Button>
                  : <Button onClick={addToVocab} style={{ flex: 2 }}>⭐ 단어장에 추가</Button>
              ) : (
                <Link href="/auth" className="btn btn--primary" style={{ flex: 2, justifyContent: 'center' }}>🔒 로그인하고 저장하기</Link>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
