import Button from '../components/Button';
import { detectLang } from '../lib/constants';

export default function VocabDecks({
  user, vocab, publicDecks,
  deckModal, setDeckModal, deckTitle, setDeckTitle, deckLang, setDeckLang,
  createDeckMutation, deleteDeckMutation, importDeckMutation,
  setConfirmAction,
}) {
  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          내 단어장을 공유하거나 다른 사람의 덱을 가져와 복습하세요.
        </p>
        {user && (
          <Button size="sm" onClick={() => setDeckModal(true)}>
            + 덱 공유하기
          </Button>
        )}
      </div>

      {/* 덱 만들기 모달 */}
      {deckModal && (
        <div className="card" style={{ marginBottom: '24px', padding: '20px', border: '1px solid var(--primary-glow)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '16px' }}>내 단어장 공유하기</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="form-label">덱 이름</label>
              <input
                className="search-input"
                value={deckTitle}
                onChange={e => setDeckTitle(e.target.value)}
                placeholder="예: N3 필수 어휘 200개"
                maxLength={80}
              />
            </div>
            <div>
              <label className="form-label">언어</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['Japanese', 'English'].map(lang => (
                  <button
                    key={lang}
                    onClick={() => setDeckLang(lang)}
                    className={`chip ${deckLang === lang ? 'chip--active' : ''}`}
                  >
                    {lang === 'Japanese' ? '🇯🇵 일본어' : '🇬🇧 영어'}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                {vocab.filter(v => (v.language === deckLang) || (!v.language && detectLang(v.word_text) === deckLang)).length}개 단어가 포함됩니다
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button onClick={() => createDeckMutation.mutate()} disabled={!deckTitle.trim() || createDeckMutation.isPending}>
                {createDeckMutation.isPending ? '공유 중...' : '공유'}
              </Button>
              <Button variant="ghost" onClick={() => { setDeckModal(false); setDeckTitle(''); }}>취소</Button>
            </div>
          </div>
        </div>
      )}

      {/* 덱 목록 */}
      {publicDecks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🃏</div>
          <p className="empty-state__msg">아직 공유된 단어장이 없습니다.<br />첫 번째로 덱을 공유해보세요!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {publicDecks.map(deck => {
            const isOwn = deck.owner_id === user?.id;
            return (
              <div key={deck.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.85rem' }}>{deck.language === 'Japanese' ? '🇯🇵' : '🇬🇧'}</span>
                    <h4 style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {deck.title}
                    </h4>
                    {isOwn && <span style={{ fontSize: '0.72rem', background: 'var(--primary-glow)', color: 'var(--primary-light)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>내 덱</span>}
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                    {deck.owner?.display_name || '익명'} · {deck.word_count}개 단어 · {new Date(deck.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  {!isOwn && user && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={importDeckMutation.isPending}
                      onClick={() => importDeckMutation.mutate(deck.id)}
                    >
                      가져오기
                    </Button>
                  )}
                  {isOwn && (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={deleteDeckMutation.isPending}
                      onClick={() => setConfirmAction({
                        message: `"${deck.title}" 덱을 삭제할까요?`,
                        onConfirm: () => { deleteDeckMutation.mutate(deck.id); setConfirmAction(null); },
                      })}
                    >
                      삭제
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
