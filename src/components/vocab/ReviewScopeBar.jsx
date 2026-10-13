'use client';
// 범위 막대 · 범위 시트(REV-SCOPE R1-A §5-1 · §5-2). 칩은 모두 범위 주소로 가는 링크다 —
// 주소가 곧 범위라 새로고침 · 공유 · 뒤로 가기가 같은 범위를 연다. 숫자는 countReviewScope.byLang.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { langNameKo } from '../../lib/constants';
import { saveLearningLang } from '../../lib/learningLang';
import {
  REVIEW_SCOPE_BOOKS, REVIEW_SCOPE_LANGS, REVIEW_SCOPE_LEVELS, reviewLevelLabel, reviewScopeHref, reviewStateLabel,
} from '../../lib/reviewScope';

const LANG_CLASS = { Japanese: 'ja', Chinese: 'zh', English: 'en', French: 'fr' };
const omit = (scope, key) => Object.fromEntries(Object.entries(scope).filter(([name]) => name !== key));

export default function ReviewScopeBar({ scope, byLang, options, sourceLabel, returnTo }) {
  const [open, setOpen] = useState(false);
  const langs = REVIEW_SCOPE_LANGS.filter(lang => lang === scope.lang || (byLang?.[lang] || 0) > 0);
  const chips = [
    scope.level && { key: 'level', label: reviewLevelLabel(scope.level), href: reviewScopeHref(omit(scope, 'level'), { returnTo }) },
    scope.src && { key: 'src', label: sourceLabel, href: reviewScopeHref(omit(scope, 'src')) },
    scope.state !== 'due' && { key: 'state', label: reviewStateLabel(scope.state), href: reviewScopeHref({ ...scope, state: 'due' }, { returnTo }) },
  ].filter(Boolean);
  return <section className="review-scope" aria-label="복습 범위">
    <div className="review-scope__langs" role="group" aria-label="복습 언어">
      {langs.map(lang => <Link key={lang} href={reviewScopeHref({ lang, state: 'due' })} prefetch={false}
        className={`review-scope__lang review-scope__lang--${LANG_CLASS[lang]}`} aria-current={lang === scope.lang ? 'true' : undefined}
        aria-label={byLang ? `${langNameKo(lang)} 오늘 ${byLang[lang] || 0}개` : langNameKo(lang)} onClick={() => saveLearningLang(lang)}>
        {langNameKo(lang)}{byLang && <b aria-hidden="true">{byLang[lang] || 0}</b>}
      </Link>)}
    </div>
    <div className="review-scope__chips" role="group" aria-label="범위">
      {chips.map(chip => <Link key={chip.key} href={chip.href} prefetch={false} className="review-scope__chip is-on" aria-label={`${chip.label} 범위 빼기`}>
        {chip.label} <span aria-hidden="true">✕</span>
      </Link>)}
      <button type="button" className="review-scope__chip" aria-haspopup="dialog" onClick={() => setOpen(true)}>＋ 범위</button>
    </div>
    {open && <ReviewScopeSheet scope={scope} options={options} returnTo={returnTo} onClose={() => setOpen(false)} />}
  </section>;
}

function Choice({ on, disabled, onClick, children, count }) {
  return <button type="button" className={`review-scope__chip${on ? ' is-on' : ''}`} aria-pressed={on} disabled={disabled} onClick={onClick}>
    {children}{count != null && <span className="review-scope__count">{count}</span>}
  </button>;
}

function ReviewScopeSheet({ scope, options, returnTo, onClose }) {
  const router = useRouter();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [draft, setDraft] = useState(scope);
  const book = Object.entries(REVIEW_SCOPE_BOOKS).find(([, spec]) => spec.lang === scope.lang);
  const src = draft.src;
  const setSrc = next => setDraft(current => next ? { ...current, src: next } : omit(current, 'src'));
  const lessons = book ? Array.from({ length: book[1].lessons }, (_, index) => index + 1) : [];
  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusInitial = window.setTimeout(() => dialog?.querySelector('[data-dialog-initial-focus]')?.focus(), 0);
    function onKeyDown(event) {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current?.(); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialog?.querySelectorAll(selector) || [])].filter(el => !el.disabled);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => { window.clearTimeout(focusInitial); document.removeEventListener('keydown', onKeyDown); previousFocus?.focus?.(); };
  }, []);
  const toggleMaterial = id => {
    const ids = src?.kind === 'material' ? src.ids : [];
    const next = ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id].slice(0, 20);
    setSrc(next.length ? { kind: 'material', ids: next } : null);
  };
  const apply = () => {
    const keepReturn = draft.src?.kind === 'book' && scope.src?.kind === 'book';
    router.push(reviewScopeHref(draft, { returnTo: keepReturn ? returnTo : null }));
    onClose();
  };
  const name = langNameKo(scope.lang);
  return <div className="modal-overlay review-scope-overlay" onClick={onClose}>
    <div ref={dialogRef} className="review-scope-sheet" role="dialog" aria-modal="true" aria-labelledby="review-scope-title" onClick={event => event.stopPropagation()}>
      <h2 id="review-scope-title">범위 고르기 · {name}</h2>
      <p className="review-scope-sheet__sub">{name} 담은 표현 {options.total}개(아는 단어 제외)</p>
      {REVIEW_SCOPE_LEVELS[scope.lang] && <>
        <h3>급수</h3>
        <div className="review-scope__chips">
          <Choice on={!draft.level} onClick={() => setDraft(current => omit(current, 'level'))}>전체</Choice>
          {REVIEW_SCOPE_LEVELS[scope.lang].map(level => {
            const count = options.levels?.get(level) || 0;
            return <Choice key={level} on={draft.level === level} count={options.levels ? count : null} disabled={!options.levels || (!count && draft.level !== level)}
              onClick={() => setDraft(current => ({ ...current, level }))}>{reviewLevelLabel(level)}</Choice>;
          })}
        </div>
      </>}
      <h3>출처</h3>
      <div className="review-scope__chips">
        <Choice on={!src} onClick={() => setSrc(null)}>전체</Choice>
        <Choice on={src?.kind === 'deck'} disabled={!options.decks.length} count={options.decks.reduce((sum, deck) => sum + deck.count, 0)}
          onClick={() => setSrc({ kind: 'deck', ref: options.decks[0].ref })}>사전 급수 덱</Choice>
        <Choice on={src?.kind === 'material'} disabled={!options.materials.length} count={options.materials.length}
          onClick={() => setSrc({ kind: 'material', ids: [options.materials[0].id] })}>내 서재 자료</Choice>
        <Choice on={src?.kind === 'study'} disabled={!options.study} count={options.study} onClick={() => setSrc({ kind: 'study' })}>오늘 학습</Choice>
        <Choice on={src?.kind === 'book'} disabled={!book} onClick={() => setSrc({ kind: 'book', bookId: book[0], from: 1, to: book[1].lessons })}>{book ? '교재' : `교재 — ${name} 교재 없음`}</Choice>
      </div>
      {src?.kind === 'deck' && <div className="review-scope__chips" role="group" aria-label="사전 급수 덱">
        {options.decks.map(deck => <Choice key={deck.ref} on={src.ref === deck.ref} count={deck.count} onClick={() => setSrc({ kind: 'deck', ref: deck.ref })}>{deck.ref}</Choice>)}
      </div>}
      {src?.kind === 'material' && <ul className="review-scope-sheet__list" aria-label="내 서재 자료">
        {options.materials.map(item => <li key={item.id}><label>
          <input type="checkbox" checked={src.ids.includes(item.id)} onChange={() => toggleMaterial(item.id)} />
          <span>{item.title}</span><span className="review-scope__count">{item.count}</span>
        </label></li>)}
      </ul>}
      {src?.kind === 'book' && <div className="review-scope-sheet__range">
        <label>처음 과 <select value={src.from} onChange={event => { const from = Number(event.target.value); setSrc({ ...src, from, to: Math.max(from, src.to) }); }}>
          {lessons.map(n => <option key={n} value={n}>{n}과</option>)}</select></label>
        <label>마지막 과 <select value={src.to} onChange={event => { const to = Number(event.target.value); setSrc({ ...src, to, from: Math.min(src.from, to) }); }}>
          {lessons.map(n => <option key={n} value={n}>{n}과</option>)}</select></label>
      </div>}
      <h3>상태</h3>
      <div className="review-scope__chips">
        {['due', 'new', 'fragile'].map(state => <Choice key={state} on={draft.state === state} onClick={() => setDraft(current => ({ ...current, state }))}>{reviewStateLabel(state)}</Choice>)}
      </div>
      <div className="review-scope-sheet__actions">
        <button type="button" className="btn btn--primary" data-dialog-initial-focus onClick={apply}>이 범위로 보기</button>
        <button type="button" className="btn btn--ghost" onClick={onClose}>닫기</button>
      </div>
      <p className="review-scope-sheet__note">출처가 기록되지 않은 옛 표현은 「출처 · 전체」에서만 나와요.</p>
    </div>
  </div>;
}
