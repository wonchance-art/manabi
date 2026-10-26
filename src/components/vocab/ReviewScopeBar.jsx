'use client';

// 복습 범위 막대 · 범위 시트 · 범위 상태 문구(REV-SCOPE-R1A · R1B-1 — 설계 §5-1 · §5-2 · §5-6).
// 숫자는 전부 부모가 넘긴 countFor(= countReviewScope)에서 나온다 — 이 파일은 따로 세지 않는다(원칙 3).
// 축: 언어 · 급수 · 출처 · 상태 · 종류(단어 · 문장, R1-B-1 — 문형은 R2). 최근 범위 · 고정은 R2라 그리지 않는다.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BOOK_LESSONS, SCOPE_LANG_LABELS, STUDY_SOURCE_REF, ZH_SCOPE_LEVELS, REVIEW_SCOPE_TYPES,
  scopeLevelLabel, scopeSourceLabel, scopeStateLabel, scopeTypeLabel, wordScopeLanguage, MAX_SCOPE_MATERIALS,
} from '../../lib/reviewScope';
import { BOOK_ID } from '../../lib/textbook/contract';

const RELEASE = { level: '급수 풀기', state: '상태 풀기', source: '출처 풀기', type: '종류 풀기' };

export function clearScopeAxis(scope, axis) {
  if (axis === 'level') return { ...scope, level: null };
  if (axis === 'state') return { ...scope, state: 'due' };
  if (axis === 'type') { const { type: _type, ...rest } = scope; return rest; }
  return { ...scope, source: null };
}

function scopeChips(scope, materialTitles) {
  const chips = [];
  if (scope.level) chips.push({ axis: 'level', label: scopeLevelLabel(scope.level) });
  if (scope.source) chips.push({ axis: 'source', label: scopeSourceLabel(scope.source, { materialTitles }) });
  if (scope.state && scope.state !== 'due') chips.push({ axis: 'state', label: scopeStateLabel(scope.state) });
  if (scope.type) chips.push({ axis: 'type', label: scopeTypeLabel(scope.type) });
  return chips;
}

// 「HSK 2를」 · 「교재 7과를」 · 「흐릿 · 위험을」 — 받침에 맞춘 목적격 조사.
export function objectParticle(text) {
  const last = String(text || '').trim().slice(-1);
  if (/[0-9]/.test(last)) return '013678'.includes(last) ? '을' : '를';
  const code = last.charCodeAt(0) - 0xac00;
  if (code >= 0 && code <= 11171) return code % 28 ? '을' : '를';
  return '를';
}

/**
 * 범위 상태 문구(§5-6) — 0개 · 한도 막힘 · 남은 새 표현 · 밀린 복습(새 표현 0) · 뜻 없는 표현.
 * onPractice가 있으면 0개 · 한도 막힘에 「집중 연습」을 낸다(집중 연습은 일정 · 한도를 바꾸지 않는다).
 */
export function ReviewScopeNotice({ empty = false, scope, count, countFor, remainingNew = 0, languages = [], onChange, fallback = null, materialTitles,
  onPractice = null, onFillMeaning = null }) {
  const singleLesson = scope.source?.kind === 'book' && scope.source.from === scope.source.to;
  const paused = !!count.backlog?.active;
  const limit = !paused && count.newLocked > 0
    ? `${singleLesson ? '이 과' : '이 범위'} 새 표현 ${count.newAllowed + count.newLocked}개 · 오늘 시작 ${count.newAllowed}개(새 표현 한도) · 나머지 ${count.newLocked}개는 내일`
    : null;
  const alternative = useMemo(() => {
    if (!empty) return null;
    for (const axis of ['level', 'state', 'source', 'type']) {
      const active = axis === 'level' ? !!scope.level : axis === 'state' ? scope.state !== 'due' : axis === 'type' ? !!scope.type : !!scope.source;
      if (!active) continue;
      const next = clearScopeAxis(scope, axis);
      const result = countFor(next);
      if (result.status === 'ready' && result.total > 0) {
        const label = axis === 'level' ? scopeLevelLabel(scope.level) : axis === 'state' ? scopeStateLabel(scope.state)
          : axis === 'type' ? scopeTypeLabel(scope.type) : scopeSourceLabel(scope.source, { materialTitles });
        return { axis, next, total: result.total, label };
      }
    }
    return null;
  }, [empty, scope, countFor, materialTitles]);
  const together = languages.length > 1 ? `(${languages.map(lang => SCOPE_LANG_LABELS[lang]).join(' · ')} 합쳐서)` : '';
  // 밀린 복습(§6-1 ③): 그 언어의 기한 지난 복습이 하루 평균의 2배를 넘으면 새 표현을 쉰다 — 줄은 잊기 쉬운 순서.
  const backlog = paused ? <p className="review-room-note review-scope-notice__backlog" role="status">
    밀린 복습부터 — 잊기 쉬운 순서로. 오늘은 새 표현을 쉬어요(밀린 복습 {count.backlog.overdue} · 하루 평균 {Math.round(count.backlog.baseline * 10) / 10}).</p> : null;
  const noMeaning = count.noMeaning > 0 ? <p className="review-room-note review-scope-notice__meaning">뜻이 없는 표현 {count.noMeaning}개는 복습에서 빠져요.
    {onFillMeaning && <button type="button" className="btn btn--ghost btn--sm" onClick={onFillMeaning}>뜻 채우기</button>}</p> : null;
  const practice = onPractice ? <button type="button" className="btn btn--ghost btn--sm review-scope-notice__practice" onClick={onPractice}>{empty ? '집중 연습' : '지금 집중 연습으로 보기'}</button> : null;
  if (empty) return <>
    {alternative ? <div className="review-scope-notice" role="status">
      <p className="review-room-note">이 범위에는 지금 복습할 표현이 없어요 · {alternative.label}{objectParticle(alternative.label)} 빼면 {alternative.total}개</p>
      <button type="button" className="btn btn--ghost btn--sm review-scope-notice__release" onClick={() => onChange(alternative.next)}>{RELEASE[alternative.axis]}</button>
      {practice}
    </div> : <><p className="review-room-note">{limit || fallback}</p>{practice && <div className="review-scope-notice">{practice}</div>}</>}
    {alternative && limit && <p className="review-room-note">{limit}</p>}
    {backlog}
    {noMeaning}
  </>;
  return <>
    {backlog}
    {limit && <div className="review-scope-notice"><p className="review-room-note review-scope-notice__limit">{limit}</p>{practice}</div>}
    {!limit && !paused && remainingNew > 0 && <p className="review-room-note">새 표현 · 오늘 {remainingNew}개 더{together}</p>}
    {noMeaning}
  </>;
}

/** 범위 막대(§5-1) — 언어 칩(byLang) · 범위 칩(✕ = 그 축 풀기) · ＋ 범위(시트).
 *  pending = 서버가 센 첫 화면 숫자만 있고 목록을 받는 중(VOCAB-FIRST-NUMBERS-001) — 시트는 목록이 있어야 세므로 「＋ 범위」를 잠근다. */
export default function ReviewScopeBar({ scope, languages, byLang = {}, countFor, allVocab, learningById, materialTitles, levels, onChange, onSelectLanguage, pending = false }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const chips = scopeChips(scope, materialTitles);
  return (
    <section className="review-scope" aria-label="복습 범위">
      {languages.length > 0 && <div className="review-scope__row" role="group" aria-label="복습 언어">
        <span className="review-scope__label" aria-hidden="true">언어</span>
        {languages.map(lang => (
          <button key={lang} type="button" className={`review-scope__lang${lang === scope.lang ? ' is-active' : ''}`} aria-pressed={lang === scope.lang}
            onClick={() => onSelectLanguage(lang)}>
            {SCOPE_LANG_LABELS[lang]} <span className="review-scope__num">{byLang[lang] ?? 0}</span>
          </button>
        ))}
      </div>}
      <div className="review-scope__row" role="group" aria-label="범위 칩">
        <span className="review-scope__label" aria-hidden="true">범위</span>
        {chips.length === 0 && <span className="review-scope__all">{SCOPE_LANG_LABELS[scope.lang]} 전체</span>}
        {chips.map(chip => (
          <span key={chip.axis} className="review-scope__chip">
            <button type="button" className="review-scope__chip-label" aria-haspopup="dialog" onClick={event => { triggerRef.current = event.currentTarget; setOpen(true); }}>{chip.label}</button>
            <button type="button" className="review-scope__chip-clear" aria-label={`${chip.label} 범위 풀기`} onClick={() => onChange(clearScopeAxis(scope, chip.axis))}>✕</button>
          </span>
        ))}
        <button type="button" className="review-scope__add" aria-haspopup="dialog" disabled={pending} onClick={event => { triggerRef.current = event.currentTarget; setOpen(true); }}>＋ 범위</button>
      </div>
      {open && !pending && <ReviewScopeSheet scope={scope} countFor={countFor} allVocab={allVocab} learningById={learningById} materialTitles={materialTitles}
        levels={levels} onApply={next => { setOpen(false); onChange(next); }} onClose={() => { setOpen(false); triggerRef.current?.focus?.(); }} />}
    </section>
  );
}

function Option({ active, disabled, onClick, children, count }) {
  return (
    <button type="button" className={`review-scope-option${active ? ' is-active' : ''}`} aria-pressed={active} disabled={disabled} onClick={onClick}>
      {children}{count != null && <span className="review-scope__num">{typeof count === 'number' ? count.toLocaleString('ko-KR') : count}</span>}
    </button>
  );
}

/** 범위 고르기 시트(§5-2) — 각 선택지 숫자 = 그 선택을 적용한 범위의 오늘 개수(countFor). 고를 수 없는 조합은 회색. */
function ReviewScopeSheet({ scope, countFor, allVocab, learningById, materialTitles, levels, onApply, onClose }) {
  const [draft, setDraft] = useState(scope);
  const dialogRef = useRef(null);
  const lang = draft.lang;
  const langLabel = SCOPE_LANG_LABELS[lang];
  const langWords = useMemo(() => allVocab.filter(word => wordScopeLanguage(word) === lang), [allVocab, lang]);
  const usable = useMemo(() => langWords.filter(word => { const p = learningById.get(word.id); return p && !p.review.known && !p.review.excluded; }), [langWords, learningById]);
  const decks = useMemo(() => [...new Set(usable.map(word => word.source_ref).filter(ref => ref && ref !== STUDY_SOURCE_REF))].sort(), [usable]);
  const hasStudy = usable.some(word => word.source_ref === STUDY_SOURCE_REF);
  const materials = useMemo(() => {
    const counts = new Map();
    for (const word of usable) if (word.source_material_id != null) counts.set(String(word.source_material_id), (counts.get(String(word.source_material_id)) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id, saved]) => ({ id, saved, title: materialTitles?.get?.(Number(id)) ?? materialTitles?.get?.(id) ?? `자료 ${id}` }));
  }, [usable, materialTitles]);
  const ready = target => { const result = countFor(target); return result.status === 'ready' ? result.total : null; };
  const draftCount = countFor(draft);
  const sourceKind = draft.source?.kind || 'all';
  const [sourcePanel, setSourcePanel] = useState(sourceKind === 'all' || sourceKind === 'study' ? null : sourceKind === 'note' ? 'material' : sourceKind);
  const book = draft.source?.kind === 'book' ? draft.source : { kind: 'book', bookId: BOOK_ID, from: 1, to: BOOK_LESSONS };
  const pickedMaterials = draft.source?.kind === 'material' ? draft.source.ids : [];

  useEffect(() => {
    const dialog = dialogRef.current;
    const selector = 'button:not([disabled]), select, [href], [tabindex]:not([tabindex="-1"])';
    const focusTimer = window.setTimeout(() => dialog?.querySelector('[data-dialog-initial-focus]')?.focus(), 0);
    function onKeyDown(event) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialog?.querySelectorAll(selector) || [])];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => { window.clearTimeout(focusTimer); document.removeEventListener('keydown', onKeyDown); };
  }, [onClose]);

  const toggleMaterial = id => {
    const ids = pickedMaterials.includes(id) ? pickedMaterials.filter(x => x !== id) : [...pickedMaterials, id].slice(0, MAX_SCOPE_MATERIALS);
    setDraft({ ...draft, source: ids.length ? { kind: 'material', ids } : null });
  };
  const lessons = Array.from({ length: BOOK_LESSONS }, (_, i) => i + 1);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={dialogRef} className="modal review-scope-sheet" role="dialog" aria-modal="true" aria-labelledby="review-scope-sheet-title" onClick={event => event.stopPropagation()}>
        <div className="review-scope-sheet__head">
          <h2 id="review-scope-sheet-title">범위 고르기 · {langLabel}</h2>
          <button type="button" className="review-scope-sheet__close" aria-label="범위 고르기 닫기" data-dialog-initial-focus onClick={onClose}>✕</button>
        </div>
        <p className="review-scope-sheet__summary">{langLabel} 담은 표현 {langWords.length.toLocaleString('ko-KR')}개 · 이 범위 {draftCount.status === 'ready' ? `${draftCount.stored.toLocaleString('ko-KR')}개` : '확인 전'}(아는 단어 제외)</p>

        <fieldset className="review-scope-sheet__group">
          <legend>급수</legend>
          {lang === 'Chinese' ? (levels ? <div className="review-scope-sheet__options">
            <Option active={!draft.level} onClick={() => setDraft({ ...draft, level: null })} count={ready({ ...draft, level: null })}>전체</Option>
            {ZH_SCOPE_LEVELS.map(level => (
              <Option key={level} active={draft.level === level} onClick={() => setDraft({ ...draft, level, source: draft.source?.kind === 'book' ? null : draft.source })}
                count={ready({ ...draft, level })}>{scopeLevelLabel(level)}</Option>
            ))}
          </div> : <p className="review-scope-sheet__muted" aria-busy="true">급수 표 불러오는 중…</p>)
            : <p className="review-scope-sheet__muted">급수는 중국어만 고를 수 있어요. 일본어 N급은 준비 중이에요.</p>}
        </fieldset>

        <fieldset className="review-scope-sheet__group">
          <legend>출처</legend>
          <div className="review-scope-sheet__options">
            <Option active={sourceKind === 'all'} onClick={() => { setSourcePanel(null); setDraft({ ...draft, source: null }); }} count={ready({ ...draft, source: null })}>전체</Option>
            <Option active={sourceKind === 'deck'} disabled={!decks.length} onClick={() => setSourcePanel('deck')}>{decks.length ? '사전 급수 덱' : '사전 급수 덱 — 없음'}</Option>
            <Option active={sourceKind === 'material' || sourceKind === 'note'} disabled={!materials.length} onClick={() => setSourcePanel('material')}>{materials.length ? '내 서재 자료' : '내 서재 자료 — 없음'}</Option>
            <Option active={sourceKind === 'study'} disabled={!hasStudy} onClick={() => { setSourcePanel(null); setDraft({ ...draft, source: { kind: 'study' } }); }}
              count={hasStudy ? ready({ ...draft, source: { kind: 'study' } }) : null}>{STUDY_SOURCE_REF}</Option>
            <Option active={sourceKind === 'book'} disabled={lang !== 'Japanese' || !!draft.level} onClick={() => { setSourcePanel('book'); setDraft({ ...draft, level: null, source: book }); }}>
              {lang === 'Japanese' ? '교재' : `교재 — ${langLabel} 교재 없음`}</Option>
          </div>
          {sourcePanel === 'deck' && <div className="review-scope-sheet__options review-scope-sheet__sub" role="group" aria-label="사전 급수 덱">
            {decks.map(ref => <Option key={ref} active={draft.source?.kind === 'deck' && draft.source.ref === ref} onClick={() => setDraft({ ...draft, source: { kind: 'deck', ref } })}
              count={ready({ ...draft, source: { kind: 'deck', ref } })}>{ref}</Option>)}
          </div>}
          {sourcePanel === 'material' && <div className="review-scope-sheet__options review-scope-sheet__sub" role="group" aria-label="내 서재 자료">
            {materials.map(material => <Option key={material.id} active={pickedMaterials.includes(material.id)} onClick={() => toggleMaterial(material.id)}>
              {pickedMaterials.includes(material.id) ? '✓ ' : ''}{material.title} · 담음 {material.saved}</Option>)}
          </div>}
          {sourcePanel === 'book' && lang === 'Japanese' && <div className="review-scope-sheet__range" role="group" aria-label="교재 과 범위">
            <label>처음 과<select value={book.from} onChange={event => { const from = Number(event.target.value); setDraft({ ...draft, source: { ...book, from, to: Math.max(from, book.to) } }); }}>
              {lessons.map(n => <option key={n} value={n}>{n}과</option>)}</select></label>
            <span aria-hidden="true">–</span>
            <label>마지막 과<select value={book.to} onChange={event => { const to = Number(event.target.value); setDraft({ ...draft, source: { ...book, to, from: Math.min(book.from, to) } }); }}>
              {lessons.map(n => <option key={n} value={n}>{n}과</option>)}</select></label>
          </div>}
          {(sourcePanel === 'material' || sourcePanel === 'book') && <p className="review-scope-sheet__muted">자료 · 교재 범위의 오늘 개수는 「이 범위로 보기」를 누른 뒤 확인해요.</p>}
        </fieldset>

        <fieldset className="review-scope-sheet__group">
          <legend>상태</legend>
          <div className="review-scope-sheet__options">
            {['due', 'new', 'fragile'].map(state => <Option key={state} active={draft.state === state} onClick={() => setDraft({ ...draft, state })}
              count={ready({ ...draft, state })}>{scopeStateLabel(state)}</Option>)}
          </div>
        </fieldset>

        <fieldset className="review-scope-sheet__group">
          <legend>종류</legend>
          <div className="review-scope-sheet__options">
            <Option active={!draft.type} onClick={() => setDraft(clearScopeAxis(draft, 'type'))} count={ready(clearScopeAxis(draft, 'type'))}>전체</Option>
            {REVIEW_SCOPE_TYPES.map(type => <Option key={type} active={draft.type === type} onClick={() => setDraft({ ...draft, type })}
              count={ready({ ...draft, type })}>{scopeTypeLabel(type)}</Option>)}
          </div>
        </fieldset>

        <div className="review-scope-sheet__foot">
          <button type="button" className="btn btn--primary btn--md" onClick={() => onApply(draft)}>이 범위로 보기</button>
          <p className="review-scope-sheet__muted">출처가 기록되지 않은 옛 표현은 「출처 · 전체」에서만 나와요. 종류는 담은 문장 · 끝 부호로 정해요(「문형」은 준비 중).</p>
        </div>
      </div>
    </div>
  );
}
