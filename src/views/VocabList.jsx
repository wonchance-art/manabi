import Link from 'next/link';
import Button from '../components/Button';

function detectLang(word) {
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(word) ? 'Japanese' : 'English';
}

export default function VocabList({
  filteredVocab, visibleCount, setVisibleCount,
  search, setSearch, sortBy, setSortBy, langFilter, setLangFilter,
  ttsSupported, speak, setConfirmAction, deleteMutation,
}) {
  return (
    <>
      {/* 검색 + 필터 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        <div className="filter-row">
          <div className="search-wrap" style={{ flex: 1 }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="단어, 의미, 후리가나 검색..."
              className="search-input"
            />
          </div>
          <div className="chip-group">
            {[
              { value: 'due', label: '복습 순' },
              { value: 'newest', label: '최신 순' },
              { value: 'alpha', label: '가나다 순' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className={`chip ${sortBy === opt.value ? 'chip--active' : ''}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="chip-group">
          {[
            { value: 'all', label: '🌍 전체' },
            { value: 'Japanese', label: '🇯🇵 일본어' },
            { value: 'English', label: '🇬🇧 영어' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setLangFilter(f.value)}
              className={`chip ${langFilter === f.value ? 'chip--active' : ''}`}
            >
              {f.label}
            </button>
          ))}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
            {filteredVocab.length}개
          </span>
        </div>
      </div>

      <div className="feature-grid">
        {filteredVocab.length > 0 ? filteredVocab.slice(0, visibleCount).map(v => (
          <div key={v.id} className="card vocab-card">
            <div className="vocab-card__header">
              <div>
                {v.furigana && <div className="vocab-card__furigana">{v.furigana}</div>}
                <h3 className="vocab-card__word">{v.word_text}</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="badge" style={{ fontSize: '0.7rem' }}>{v.pos}</span>
                {ttsSupported && (
                  <button
                    onClick={() => speak(v.word_text, v.language || detectLang(v.word_text))}
                    title="발음 듣기"
                    style={{
                      width: '26px', height: '26px', borderRadius: 'var(--radius-sm)',
                      background: 'transparent', border: '1px solid var(--border)',
                      color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    🔊
                  </button>
                )}
                <button
                  onClick={() => setConfirmAction({
                    message: `"${v.word_text}" 를 단어장에서 삭제할까요?`,
                    onConfirm: () => { deleteMutation.mutate(v.id); setConfirmAction(null); },
                  })}
                  style={{
                    width: '26px', height: '26px', borderRadius: 'var(--radius-sm)',
                    background: 'transparent', border: '1px solid transparent',
                    color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  title="삭제"
                >
                  ✕
                </button>
              </div>
            </div>
            <p className="vocab-card__meaning">{v.meaning}</p>
            <div className="vocab-card__footer">
              <span>{new Date(v.next_review_at) <= new Date()
                ? '🔴 복습 필요'
                : `📅 ${new Date(v.next_review_at).toLocaleDateString('ko-KR')}`}
              </span>
              <span style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: v.interval >= 30 ? 'rgba(74,138,92,0.15)' : v.interval >= 7 ? 'rgba(252,196,25,0.15)' : 'rgba(255,107,107,0.1)',
                color: v.interval >= 30 ? 'var(--accent)' : v.interval >= 7 ? 'var(--warning)' : 'var(--danger)',
                fontWeight: 600,
              }}>
                {v.interval >= 30 ? '숙련' : v.interval >= 7 ? '학습 중' : '초기'}
              </span>
            </div>
          </div>
        )) : (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state__icon">{search ? '🔍' : '⭐'}</div>
            <p className="empty-state__msg">
              {search
                ? '검색 결과가 없습니다.'
                : '아직 수집한 단어가 없어요'}
            </p>
            {!search && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 320 }}>
                  자료를 읽으면서 모르는 단어를 탭하면<br />자동으로 단어장에 추가돼요
                </p>
                <Link href="/materials" className="btn btn--primary btn--md">
                  📰 자료 읽으러 가기 →
                </Link>
              </div>
            )}
            {search && (
              <button className="empty-state__link" onClick={() => setSearch('')}>
                검색어 지우기
              </button>
            )}
          </div>
        )}
      </div>
      {filteredVocab.length > visibleCount && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button variant="secondary" onClick={() => setVisibleCount(c => c + 30)}>
            더 보기 ({filteredVocab.length - visibleCount}개 남음)
          </Button>
        </div>
      )}
    </>
  );
}
