import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import { hasUnsavedEdits, useDiscardGuard } from '../lib/useDiscardGuard';
import { detectLang, displayWord } from '../lib/constants';
import { refInline } from './refShared';
import { ZH_HSK_LEVELS, zhHskLevelLabel } from '../lib/zhHskLevel';
import { wordStage } from '../lib/growthStats';
import { isVocabularyReviewDue } from '../lib/vocabularyLearningRead';

const EDIT_FIELDS = ['word_text', 'furigana', 'meaning', 'pos'];

const LANG_CODE = { Japanese: 'ja', Chinese: 'zh-Hans', English: 'en', French: 'fr', Korean: 'ko' };

// 급수 자동 분류 필터(②) — 급수는 HSK 2026 표에서 표시 시점 계산(ZH-LEVEL-2026-001). 'NONE'=표 밖.
const LEVEL_OPTIONS = [
  { value: 'all', label: '급수 전체' },
  ...ZH_HSK_LEVELS.map((level) => ({ value: `H${level}`, label: zhHskLevelLabel(level) })),
  { value: 'NONE', label: '미분류' },
];

export default function VocabList({
  vocab = [], filteredVocab, visibleCount, setVisibleCount,
  search, setSearch, sortBy, setSortBy, langFilter, setLangFilter, langAllOption = true, languages = null,
  levelFilter = 'all', setLevelFilter, showLevelFilter = false, refLevelOf,
  ttsSupported, speak, setConfirmAction, deleteMutation, onWordClick,
  bulkDeleteMutation, updateVocabMutation,
  koreanLearningSupported = false, readOnly = false, learningById, now = new Date(),
}) {
  const canModify = word => !readOnly && !!word && (word.language !== 'Korean' || koreanLearningSupported);
  // 단어장에 실제로 존재하는 언어(표시 순서는 고정 라벨 순)
  const LANG_LABELS = [
    { value: 'Japanese', label: '일본어' },
    { value: 'English', label: '영어' },
    { value: 'French', label: '프랑스어' },
    { value: 'Chinese', label: '중국어' },
    { value: 'Korean', label: '한국어' },
  ];
  // 복습방은 범위로 이미 좁힌 목록을 넘기므로, 고를 수 있는 언어는 부모가 따로 준다(languages).
  const langsInVocab = LANG_LABELS.filter(l => (languages ? languages.includes(l.value) : vocab.some(v => v.language === l.value)));

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editing, setEditing] = useState(null); // 편집 중인 단어
  const [editOrigin, setEditOrigin] = useState(null); // 편집을 연 시점의 값 — 바뀐 입력 판정용
  const editDialogRef = useRef(null);
  const editingOpen = !!editing;
  const openEdit = (v) => {
    const initial = { id: v.id, word_text: v.word_text, furigana: v.furigana || '', meaning: v.meaning || '', pos: v.pos || '' };
    setEditOrigin(initial);
    setEditing(initial);
  };
  // 취소·Esc·배경 클릭이 고친 입력을 말없이 버리지 않게(WALL-STATES-001 ④) — 바뀐 게 있으면 한 번 묻는다.
  const discardEdit = useDiscardGuard({ dirty: hasUnsavedEdits(editOrigin, editing, EDIT_FIELDS), onClose: () => setEditing(null) });
  const requestEditClose = discardEdit.requestClose;
  const isAskingDiscard = discardEdit.isAsking;

  useEffect(() => {
    if (!editingOpen) return undefined;
    const previousFocus = document.activeElement;
    const dialog = editDialogRef.current;
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusInitial = window.setTimeout(() => dialog?.querySelector('[data-dialog-initial-focus]')?.focus(), 0);
    function onKeyDown(event) {
      // 버리기 확인 창이 떠 있으면 그 창(ConfirmModal)이 Esc·Tab을 맡는다. 이 처리기는 먼저 등록돼 먼저 불린다.
      if (isAskingDiscard()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        requestEditClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialog?.querySelectorAll(selector) || [])].filter(el => !el.disabled);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusInitial);
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, [editingOpen, isAskingDiscard, requestEditClose]);

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
    if (selectedIds.size === 0 || [...selectedIds].some(id => !canModify(vocab.find(word => word.id === id)))) return;
    setConfirmAction({
      title: `선택한 ${selectedIds.size}개 단어를 삭제할까요?`,
      message: '삭제하면 되돌릴 수 없어요.',
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
              placeholder="표현 목록 검색"
              aria-label="표현 목록 검색"
              className="search-input"
            />
          </div>
        </div>
        <div className="vocab-filter-row">
          {/* 정렬은 검색과 다른 성격이라 필터 줄로 내렸다 — 검색 줄에 함께 두니 줄이 하나 더 생겼다 */}
          <select
            className="vocab-sort"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            aria-label="정렬 순서"
          >
            <option value="due">복습 순</option>
            <option value="newest">최신 순</option>
            <option value="alpha">가나다 순</option>
          </select>
          {showLevelFilter && (
            <select
              className="vocab-sort"
              value={levelFilter}
              onChange={e => setLevelFilter?.(e.target.value)}
              aria-label="급수 필터"
            >
              {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
        <div className="chip-group" role="group" aria-label="표현 목록 언어">
          {/* 4개 언어를 늘 깔아 두면 단어가 한 언어뿐일 때도 칩 5개가 자리를 먹는다 —
              단어장에 실제로 있는 언어만, 그것도 둘 이상일 때만 보여준다. 복습방(REV-SCOPE-R1A)에서는 언어가
              범위의 첫 축이라 「전체」가 없고, 저장은 부모(범위 저장 규칙)가 맡는다 — 명시 범위에서 저장 설정을 덮지 않게. */}
          {(langsInVocab.length > 1
            ? [...(langAllOption ? [{ value: 'all', label: '전체' }] : []), ...langsInVocab]
            : []
          ).map(f => (
            <button
              type="button"
              key={f.value}
              onClick={() => setLangFilter(f.value)}
              className={`chip ${langFilter === f.value ? 'chip--active' : ''}`}
              aria-pressed={langFilter === f.value}
            >
              {f.label}
            </button>
          ))}
        </div>
          <span className="vocab-filter-row__count">{filteredVocab.length}개</span>
          {filteredVocab.length > 0 && (
            <button
              type="button"
              onClick={() => { selectMode ? exitSelectMode() : setSelectMode(true); }}
              className={`chip ${selectMode ? 'chip--active' : ''}`}
              aria-pressed={selectMode}
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
                  disabled={bulkDeleteMutation?.isPending || [...selectedIds].some(id => !canModify(vocab.find(word => word.id === id)))}
                  style={{ background: 'var(--danger)' }}
                >
                  삭제 ({selectedIds.size})
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="vocab-list">
        {filteredVocab.length > 0 ? filteredVocab.slice(0, visibleCount).map(v => {
          const selected = selectedIds.has(v.id);
          const handleClick = () => {
            if (selectMode) toggleSelect(v.id);
            else onWordClick?.(v);
          };
          const learning = learningById?.get(v.id);
          const stage = learning ? wordStage(learning) : null;
          const stageColor = stage?.key === 'mastered' ? 'var(--accent)' : stage?.key === 'learning' ? 'var(--warning)' : 'var(--danger)';
          const stageLabel = learning?.review.excluded ? '제외' : stage?.label || '—';
          const due = !!learning && isVocabularyReviewDue(learning, Math.max(new Date(now).getTime(), Date.parse(learning.review.evaluatedAt)));
          const lc = LANG_CODE[v.language];
          const refLevel = zhHskLevelLabel(refLevelOf?.(v));
          return (
          <div
            key={v.id}
            className={`card vocab-row${selectMode ? ' vocab-row--sel' : ''}`}
            style={{
              cursor: 'pointer',
              outline: selected ? '2px solid var(--primary)' : 'none',
              background: selected ? 'var(--primary-glow)' : undefined,
            }}
            onClick={handleClick}
          >
            {selectMode && (
              <span className="vocab-row__check" style={{
                borderColor: selected ? 'var(--primary)' : 'var(--border)',
                background: selected ? 'var(--primary)' : 'transparent',
              }}>{selected ? '✓' : ''}</span>
            )}

            {/* 1행: 품사 · 듣기 · 단어 · 뜻 · 우측 / 2행: 발음 · 예문 */}
            {v.pos
              ? <span className="vocab-row__pos" title={v.pos}>{v.pos}</span>
              : <span className="vocab-row__pos vocab-row__pos--empty" aria-hidden="true" />}

            {ttsSupported && v.language !== 'Korean' ? (
              <button type="button" className="vocab-row__tts" title="발음 듣기" aria-label={`${v.word_text} 발음 듣기`}
                onClick={e => { e.stopPropagation(); speak(v.word_text, v.language || detectLang(v.word_text)); }}>▷</button>
            ) : <span className="vocab-row__tts vocab-row__tts--empty" aria-hidden="true" />}

            <h3 className="vocab-row__word" lang={lc}>
              <button
                type="button"
                className="vocab-row__word-button"
                onClick={e => { e.stopPropagation(); handleClick(); }}
                aria-label={`${v.word_text} — ${v.meaning}${selectMode ? (selected ? ' (선택됨)' : ' (선택 안 됨)') : ' 상세 열기'}`}
                aria-pressed={selectMode ? selected : undefined}
              >
                {displayWord(v.word_text, v.pos)}
              </button>
            </h3>
            {v.furigana && <span className="vocab-row__reading">{v.furigana}</span>}

            <p className="vocab-row__meaning">{v.meaning}</p>
            {(v.etym || v.hanja || v.source_sentence) && (
              <div className="vocab-row__sub">
                {(v.etym || v.hanja) && (
                  <p className="vocab-row__note">
                    <strong>{v.hanja ? '한자' : '어원'}</strong> · {refInline(v.etym || v.hanja)}
                  </p>
                )}
                {v.source_sentence && <p className="vocab-row__ex" lang={lc}>{v.source_sentence}</p>}
              </div>
            )}

            <div className="vocab-row__right" onClick={e => e.stopPropagation()}>
              {refLevel && <span className="vocab-row__level">{refLevel}</span>}
              {due
                ? <span className="vocab-row__due">복습</span>
                : <span className="vocab-row__dot" style={{ background: stageColor }} title={stageLabel} aria-label={stageLabel} />}
              {!selectMode && updateVocabMutation && (
                <button type="button" className="vocab-row__act" title="편집" aria-label={`${v.word_text} 편집`}
                  disabled={!canModify(v)}
                  onClick={() => openEdit(v)}>✎</button>
              )}
              {!selectMode && (
                <button type="button" className="vocab-row__act vocab-row__act--danger" title="삭제" aria-label={`${v.word_text} 삭제`}
                  disabled={!canModify(v)}
                  onClick={() => setConfirmAction({
                    title: `"${v.word_text}" 단어를 삭제할까요?`,
                    message: '삭제하면 되돌릴 수 없어요.',
                    onConfirm: () => { deleteMutation.mutate(v.id); setConfirmAction(null); },
                  })}>✕</button>
              )}
            </div>
          </div>
          );
        }) : (
          <div className="empty-state">
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
                  자료 읽으러 가기 →
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

      {/* 편집 모달 */}
      {editing && (
        <div className="modal-overlay" onClick={requestEditClose}>
          <div ref={editDialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="vocab-edit-title" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 id="vocab-edit-title" style={{ margin: '0 0 16px', fontSize: '1.05rem' }}>단어 편집</h3>

            <label htmlFor="vocab-edit-word" className="u-text-sm u-text-bold" style={{ display: 'block', marginBottom: 4 }}>단어</label>
            <input
              id="vocab-edit-word"
              type="text"
              value={editing.word_text}
              onChange={e => setEditing(s => ({ ...s, word_text: e.target.value }))}
              className="form-input"
              data-dialog-initial-focus
              style={{ marginBottom: 12 }}
            />

            <label htmlFor="vocab-edit-reading" className="u-text-sm u-text-bold" style={{ display: 'block', marginBottom: 4 }}>후리가나 / 발음</label>
            <input
              id="vocab-edit-reading"
              type="text"
              value={editing.furigana}
              onChange={e => setEditing(s => ({ ...s, furigana: e.target.value }))}
              className="form-input"
              placeholder="(선택)"
              style={{ marginBottom: 12 }}
            />

            <label htmlFor="vocab-edit-meaning" className="u-text-sm u-text-bold" style={{ display: 'block', marginBottom: 4 }}>의미</label>
            <input
              id="vocab-edit-meaning"
              type="text"
              value={editing.meaning}
              onChange={e => setEditing(s => ({ ...s, meaning: e.target.value }))}
              className="form-input"
              style={{ marginBottom: 12 }}
            />

            <label htmlFor="vocab-edit-pos" className="u-text-sm u-text-bold" style={{ display: 'block', marginBottom: 4 }}>품사</label>
            <input
              id="vocab-edit-pos"
              type="text"
              value={editing.pos}
              onChange={e => setEditing(s => ({ ...s, pos: e.target.value }))}
              className="form-input"
              placeholder="(선택)"
              style={{ marginBottom: 16 }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={requestEditClose} style={{ flex: 1 }}>취소</Button>
              <Button
                onClick={() => {
                  updateVocabMutation.mutate(
                    { id: editing.id, updates: editing },
                    { onSuccess: () => setEditing(null) }
                  );
                }}
                disabled={updateVocabMutation?.isPending || !canModify(vocab.find(word => word.id === editing.id))}
                style={{ flex: 2 }}
              >
                {updateVocabMutation?.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        {...discardEdit.confirmProps}
        onCancel={() => {
          discardEdit.confirmProps.onCancel();
          editDialogRef.current?.querySelector('[data-dialog-initial-focus]')?.focus();
        }}
      />
    </>
  );
}
