import { useState } from 'react';
import Link from 'next/link';
import Button from '../components/Button';

export default function ViewerBottomSheet({
  selectedToken, isSheetOpen, setIsSheetOpen,
  ttsSupported, speak, materialLang,
  isWordSaved, saveAnim, addToVocab, user, trimOkurigana,
  onCorrectToken, corrections = [],
}) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});

  if (!isSheetOpen || !selectedToken) return null;

  const startEdit = () => {
    setEditData({
      furigana: selectedToken.furigana || '',
      meaning: selectedToken.meaning || '',
      pos: selectedToken.pos || '',
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditData({});
  };

  const submitEdit = () => {
    if (onCorrectToken) {
      onCorrectToken(selectedToken.id, editData);
    }
    setEditing(false);
    setEditData({});
  };

  return (
    <>
      <div className="overlay" onClick={() => { setEditing(false); setIsSheetOpen(false); }} />
      <div className="bottom-sheet">
        <div className="bottom-sheet__handle" />

        {editing ? (
          /* 수정 모드 */
          <div className="bottom-sheet__edit">
            <div className="bottom-sheet__edit-header">
              <h3 className="bottom-sheet__word">{selectedToken.text}</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AI 분석 결과 수정</span>
            </div>
            <div className="bottom-sheet__edit-fields">
              <label className="bottom-sheet__edit-label">
                <span>후리가나</span>
                <input
                  type="text"
                  value={editData.furigana}
                  onChange={e => setEditData(d => ({ ...d, furigana: e.target.value }))}
                  className="form-input"
                  placeholder="읽는 법"
                  style={{ fontSize: '0.9rem', padding: '6px 10px' }}
                />
              </label>
              <label className="bottom-sheet__edit-label">
                <span>의미</span>
                <input
                  type="text"
                  value={editData.meaning}
                  onChange={e => setEditData(d => ({ ...d, meaning: e.target.value }))}
                  className="form-input"
                  placeholder="뜻"
                  style={{ fontSize: '0.9rem', padding: '6px 10px' }}
                />
              </label>
              <label className="bottom-sheet__edit-label">
                <span>품사</span>
                <input
                  type="text"
                  value={editData.pos}
                  onChange={e => setEditData(d => ({ ...d, pos: e.target.value }))}
                  className="form-input"
                  placeholder="품사"
                  style={{ fontSize: '0.9rem', padding: '6px 10px' }}
                />
              </label>
            </div>
            <div className="bottom-sheet__actions">
              <Button variant="ghost" onClick={cancelEdit} style={{ flex: 1 }}>취소</Button>
              <Button onClick={submitEdit} style={{ flex: 2 }}>✓ 수정 저장</Button>
            </div>
          </div>
        ) : (
          /* 기본 보기 모드 */
          <>
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
                {user && (
                  <button
                    onClick={startEdit}
                    title="AI 분석 결과 수정"
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
                    ✏️
                  </button>
                )}
              </div>
              {selectedToken.furigana && (() => {
                const f = trimOkurigana(selectedToken.text, selectedToken.furigana);
                return f ? <span className="bottom-sheet__furigana">[{f}]</span> : null;
              })()}
            </div>
            <p className="bottom-sheet__meaning">{selectedToken.meaning || '(뜻 정보 없음)'}</p>

            {/* 교정 히스토리 */}
            {corrections.length > 0 && (
              <details style={{ margin: '8px 0 12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
                  ✏️ 이 단어는 {corrections.length}번 수정됐어요
                </summary>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {corrections.slice(0, 3).map(c => (
                    <div key={c.id} style={{
                      padding: '6px 10px', background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-sm)', fontSize: '0.72rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600 }}>{c.profiles?.display_name || '익명'}</span>
                        <span>{new Date(c.created_at).toLocaleDateString('ko-KR')}</span>
                      </div>
                      {c.after_value && Object.entries(c.after_value).filter(([, v]) => v).map(([k, v]) => (
                        <div key={k} style={{ color: 'var(--text-secondary)' }}>
                          {k}: <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{c.before_value?.[k] || '(없음)'}</span>
                          {' → '}
                          <span style={{ color: 'var(--accent)' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            )}

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
          </>
        )}
      </div>
    </>
  );
}
