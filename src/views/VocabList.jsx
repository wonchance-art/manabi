import { useState } from 'react';
import Link from 'next/link';
import Button from '../components/Button';
import { detectLang } from '../lib/constants';

export default function VocabList({
  filteredVocab, visibleCount, setVisibleCount,
  search, setSearch, sortBy, setSortBy, langFilter, setLangFilter,
  ttsSupported, speak, setConfirmAction, deleteMutation, onWordClick,
  bulkDeleteMutation,
}) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(filteredVocab.slice(0, visibleCount).map(v => v.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const confirmBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmAction({
      message: `선택한 ${selectedIds.size}개 단어를 삭제할까요?`,
      onConfirm: () => {
        bulkDeleteMutation?.mutate(Array.from(selectedIds));
        clearSelection();
        setSelectMode(false);
        setConfirmAction(null);
      },
    });
  };

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
          {filteredVocab.length > 0 && (
            <button
              onClick={() => { selectMode ? exitSelectMode() : setSelectMode(true); }}
              className={`chip ${selectMode ? 'chip--active' : ''}`}
              style={{ marginLeft: 'auto' }}
            >
              {selectMode ? '✕ 취소' : '☑ 선택'}
            </button>
          )}
        </div>
      </div>

      {/* 선택 모드 툴바 */}
      {selectMode && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', marginBottom: 16,
          background: 'var(--primary-glow)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--primary)',
        }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
            {selectedIds.size}개 선택됨
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={selectAllVisible}>
              현재 페이지 전체 선택
            </Button>
            {selectedIds.size > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={clearSelection}>해제</Button>
                <Button
                  size="sm"
                  onClick={confirmBulkDelete}
                  disabled={bulkDeleteMutation?.isPending}
                  style={{ background: 'var(--danger)' }}
                >
                  🗑️ 삭제 ({selectedIds.size})
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="feature-grid">
        {filteredVocab.length > 0 ? filteredVocab.slice(0, visibleCount).map(v => {
          const selected = selectedIds.has(v.id);
          const handleClick = () => {
            if (selectMode) toggleSelect(v.id);
            else onWordClick?.(v);
          };
          return (
          <div
            key={v.id}
            className="card vocab-card"
            style={{
              cursor: 'pointer',
              outline: selected ? '2px solid var(--primary)' : 'none',
              background: selected ? 'var(--primary-glow)' : undefined,
            }}
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleClick())}
            aria-label={`${v.word_text} — ${v.meaning}${selectMode ? (selected ? ' (선택됨)' : '') : ''}`}
          >
            <div className="vocab-card__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectMode && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, borderRadius: 4,
                    border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                    background: selected ? 'var(--primary)' : 'transparent',
                    color: '#fff', fontSize: '0.8rem', flexShrink: 0,
                  }}>
                    {selected ? '✓' : ''}
                  </span>
                )}
                <div>
                  {v.furigana && <div className="vocab-card__furigana">{v.furigana}</div>}
                  <h3 className="vocab-card__word">{v.word_text}</h3>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                <span className="badge" style={{ fontSize: '0.7rem' }}>{v.pos}</span>
                {!selectMode && ttsSupported && (
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
                {!selectMode && (
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
                )}
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
          );
        }) : (
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
