'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import SaveContextButton from '@/components/learning/SaveContextButton';
import MaterialChapterLinks from '@/components/learning/MaterialChapterLinks';
import { BOOK_ID, bookHref } from '@/lib/textbook/contract';
import { readingDraftKey, readingUnit } from '@/lib/bookNavigation';
import useReadingProgress from './useReadingProgress';
import BookHome from './BookHome';
import './reading-content.css';

function withoutRuby(node) {
  if (!node) return '';
  const clone = node.cloneNode(true);
  clone.querySelectorAll('rt,.book-example-save').forEach(el => el.remove());
  return clone.textContent.trim();
}

function readingText(node) {
  const clone = node.cloneNode(true);
  clone.querySelectorAll('ruby').forEach(ruby => { const reading = ruby.querySelector('rt')?.textContent; if (reading) ruby.replaceWith(reading); });
  return clone.textContent.trim();
}

export default function BookReader({ book, sectionIndex, preview = false }) {
  const { user } = useAuth();
  const { progress, update, storageAvailable, hasProgress, ready } = useReadingProgress(book.edition);
  const content = useRef(null), root = useRef(null), dialog = useRef(null), pendingAnchor = useRef(null);
  const [pageId, setPageId] = useState('cover'), [active, setActive] = useState('');
  const [sections, setSections] = useState([]), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [focus, setFocus] = useState(false), [selection, setSelection] = useState(null), [expression, setExpression] = useState(''), [meaning, setMeaning] = useState('');
  const [examples, setExamples] = useState([]), [panel, setPanel] = useState('selection'), [query, setQuery] = useState(''), [searchCount, setSearchCount] = useState(0), [draftStatus, setDraftStatus] = useState('');
  const unit = readingUnit(pageId, sectionIndex);
  const lesson = book.lessons.find(item => item.id === unit);
  const unitSections = sectionIndex.filter(section => section.unit === unit);
  const draftKey = readingDraftKey(book.edition, user?.id);
  // Keep this object stable: React must not replace imperative answer fields and portal mounts on progress updates.
  const markup = useMemo(() => ({ __html: sections.map(section => section.html).join('\n') }), [sections]);

  useEffect(() => {
    const sync = () => {
      let id;
      try { id = decodeURIComponent(window.location.hash.slice(1)) || 'cover'; } catch { id = 'cover'; }
      id = id.replace(/^(?:web|pdf|audio)-/, '');
      pendingAnchor.current = id; setPageId(id); setActive(id);
    };
    sync();
    window.addEventListener('hashchange', sync); window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, [book.edition]);

  useEffect(() => {
    const controller = new AbortController();
    setExamples([]); setSections([]); setError(''); setQuery('');
    if (!unit || unit === 'cover') { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    fetch(`/api/books/${BOOK_ID}/${book.edition}/reading?unit=${unit}`, { signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || '본문을 불러오지 못했어요.'); return data; })
      .then(data => { setSections(data.sections); setLoading(false); })
      .catch(cause => { if (cause.name !== 'AbortError') { setError(cause.message); setLoading(false); } });
    return () => controller.abort();
  }, [book.edition, unit]);

  useEffect(() => {
    const node = content.current;
    if (!node || !sections.length) return;
    let drafts = {};
    try { drafts = JSON.parse(localStorage.getItem(draftKey) || 'null') || {}; } catch { /* Reading works without local storage. */ }
    for (const input of node.querySelectorAll('[data-save]')) {
      const saved = drafts[input.dataset.save];
      if (input.type === 'radio') input.checked = input.value === saved;
      else if (input.type === 'checkbox') input.checked = !!saved;
      else input.value = saved === undefined ? '' : String(saved);
    }
    const remember = event => {
      const input = event.target.closest('[data-save]');
      if (!input) return;
      // Read the current snapshot so another tab's answers are not overwritten.
      try {
        drafts = JSON.parse(localStorage.getItem(draftKey) || 'null') || {};
        for (const field of node.querySelectorAll('[data-save]')) {
          if (field.type === 'radio') { if (field.checked) drafts[field.dataset.save] = field.value; }
          else drafts[field.dataset.save] = field.type === 'checkbox' ? field.checked : field.value;
        }
        localStorage.setItem(draftKey, JSON.stringify(drafts)); setDraftStatus('답안을 이 브라우저에 저장했어요.');
      } catch { setDraftStatus('이 브라우저에서 답안을 저장할 수 없어요.'); }
    };
    node.addEventListener('input', remember);
    const mounts = [];
    if (!preview) for (const example of node.querySelectorAll('.example')) {
      const source = example.closest('[data-book-source]');
      const japanese = example.querySelector(':scope > [lang="ja"]');
      const translation = example.querySelector(':scope > p');
      const quote = withoutRuby(japanese), translated = translation?.textContent.trim();
      if (!source || !quote || quote.length > 160 || !translated) continue;
      const mount = document.createElement('div'); mount.className = 'book-example-save'; example.append(mount);
      mounts.push({ mount, pageId: source.id, quote, meaning: translated, furigana: readingText(japanese) });
    }
    setExamples(mounts);
    return () => { node.removeEventListener('input', remember); mounts.forEach(item => item.mount.remove()); };
  }, [sections, draftKey, preview]);

  useEffect(() => {
    if (unit !== 'cover' && (!sections.length || sections[0].unit !== unit)) return;
    let frame, cancelled = false;
    document.fonts.ready.then(() => { if (cancelled) return; frame = requestAnimationFrame(() => {
      const id = pendingAnchor.current;
      if (!id || id !== pageId) return;
      const target = document.getElementById(id);
      target?.closest('details')?.setAttribute('open', '');
      if (id === 'cover' || id === unit || id === `${unit}-start`) window.scrollTo({ top: 0 });
      else (target || root.current)?.scrollIntoView({ block: 'start' });
      pendingAnchor.current = null;
      if (/^u\d{2}/.test(id)) update({ page: id });
    }); });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [pageId, sections, unit, update, ready]);

  useEffect(() => {
    if (!sections.length) return;
    let timer;
    const track = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (pendingAnchor.current || dialog.current?.open) return;
        const articles = [...(content.current?.querySelectorAll('article[data-unit-page]') || [])];
        const current = articles.filter(article => article.getBoundingClientRect().top < Math.min(240, innerHeight * .32)).at(-1) || articles[0];
        if (current) { setActive(current.id); if (lesson) update({ page: current.id }); }
      }, 120);
    };
    window.addEventListener('scroll', track, { passive: true }); track();
    return () => { clearTimeout(timer); window.removeEventListener('scroll', track); };
  }, [sections, lesson, update]);

  useEffect(() => {
    const search = query.trim().toLocaleLowerCase();
    const cards = [...(content.current?.querySelectorAll('.lex-card') || [])];
    cards.forEach(card => { card.hidden = !!search && !card.textContent.toLocaleLowerCase().includes(search); });
    setSearchCount(cards.filter(card => !card.hidden).length);
    if (unit === 'reference') content.current?.querySelectorAll('article').forEach(article => { article.hidden = !!search && !article.querySelector('.lex-card:not([hidden])'); });
  }, [query, sections, unit]);

  const go = useCallback(id => {
    dialog.current?.close();
    window.history.pushState(window.history.state, '', bookHref(book.edition, id));
    pendingAnchor.current = id; setPageId(id); setActive(id);
    if (/^u\d{2}/.test(id)) update({ page: id });
    if (id === pageId) requestAnimationFrame(() => { document.getElementById(id)?.scrollIntoView({ block: 'start' }); pendingAnchor.current = null; });
  }, [book.edition, pageId, update]);

  function interact(event) {
    const anchor = event.target.closest('a[href]');
    if (anchor && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      const url = new URL(anchor.href, window.location.href);
      if (url.origin === location.origin && url.pathname === `/books/${BOOK_ID}` && url.hash) { event.preventDefault(); go(decodeURIComponent(url.hash.slice(1))); return; }
    }
    const button = event.target.closest('button');
    if (button?.dataset.unit) go(button.dataset.unit);
    if (button?.classList.contains('translation')) {
      const dialogue = button.closest('article')?.querySelector('.dialogue');
      const hidden = dialogue?.classList.toggle('hide-ko');
      button.setAttribute('aria-pressed', String(!!hidden)); button.textContent = hidden ? '뜻 보기' : '뜻 가리기';
    }
    if (button?.classList.contains('hide-meanings')) {
      const hidden = button.closest('article')?.classList.toggle('meaning-hidden');
      button.setAttribute('aria-pressed', String(!!hidden)); button.textContent = hidden ? '뜻 보기' : '뜻 가리기';
    }
  }

  function chooseText() {
    const selected = window.getSelection();
    if (!selected?.rangeCount || selected.isCollapsed) return;
    const range = selected.getRangeAt(0), node = range.commonAncestorContainer;
    const element = node.nodeType === 1 ? node : node.parentElement;
    const source = element?.closest('[data-book-source]');
    if (!source || !content.current?.contains(source)) return;
    const quote = withoutRuby(range.cloneContents());
    if (!quote || quote.length > 4000) return;
    setSelection({ pageId: source.id, quote }); setExpression(quote.length <= 160 ? quote : ''); setMeaning('');
  }
  function openPanel(next) { setPanel(next); dialog.current?.showModal(); }
  const next = lesson && book.lessons.find(item => item.number === lesson.number + 1);
  const title = lesson ? lesson.title : ({ guide: '첫 문장 전에, 가볍게 준비', reference: '단어·문형·한자 찾기', materials: '일본어로 넓히는 일상' }[unit] || '교재 위치를 찾지 못했어요');
  return <div ref={root} className={`book-reader${focus ? ' is-focused' : ''}`} onClick={interact}>
    {preview && <p className="manabi-preview-note">관리자 미리보기 · 발행 전 원고입니다.</p>}
    {unit === 'cover' ? <BookHome book={book} progress={progress} hasProgress={hasProgress} ready={ready} /> : <div className="manabi-reader-page">
      <div className="manabi-reader-toolbar"><a href={bookHref(book.edition)}>← 책으로</a><span>일본어 · N5{lesson ? ` / ${String(lesson.number).padStart(2, '0')}과` : ''}</span><div><a href={bookHref(book.edition, 'reference-start')}>찾아보기</a><Link href={`/books/japanese-n5/review?edition=${book.edition}`}>복습</Link>{lesson && <button type="button" onClick={() => openPanel('materials')}>내 자료</button>}<button type="button" aria-pressed={focus} onClick={() => setFocus(!focus)}>{focus ? '기본 보기' : '집중 읽기'}</button></div></div>
      <div className="manabi-reader-grid"><aside className="manabi-reader-outline"><p className="manabi-eyebrow">{lesson ? `${String(lesson.number).padStart(2, '0')}과 · 읽는 순서` : '이 안에서'}</p><nav aria-label="과 안의 목차">{unitSections.map(section => <a key={section.id} href={bookHref(book.edition, section.id)} aria-current={active === section.id ? 'location' : undefined}>{section.title}</a>)}</nav><Link href={`/books/japanese-n5/materials?edition=${book.edition}`}>함께 읽기 ↗</Link></aside>
        <div className="manabi-reader-main"><details className="manabi-mobile-toc"><summary>이 과의 목차</summary><nav aria-label="모바일 과 목차">{unitSections.map(section => <a key={section.id} href={bookHref(book.edition, section.id)} onClick={event => event.currentTarget.closest('details').removeAttribute('open')}>{section.title}</a>)}</nav></details>
          <header className="manabi-chapter-opening"><div><p className="manabi-eyebrow">{lesson?.part || 'JAPANESE · N5'}</p>{lesson?.subtitle && <p className="manabi-chapter-subtitle">{lesson.subtitle}</p>}<h1>{title}</h1>{lesson && <p className="manabi-chapter-goal">{lesson.goal}</p>}</div>{lesson && <span className="manabi-chapter-number" aria-hidden="true">{String(lesson.number).padStart(2, '0')}</span>}</header>
          {unit === 'reference' && <label className="manabi-reference-search">어휘·문형·한자 검색<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="일본어 또는 한국어로 찾아보세요" /></label>}
          {loading && <p className="manabi-status" role="status">본문을 펼치고 있어요…</p>}{error && <p className="manabi-status" role="alert">{error} <button type="button" onClick={() => location.reload()}>다시 열기</button></p>}
          {!unit && <p className="manabi-status"><a href={bookHref(book.edition)}>책 목차에서 다시 열기 →</a></p>}
          {unit === 'reference' && query.trim() && <p className="manabi-status" role="status">{searchCount ? `${searchCount}개 항목을 찾았어요.` : '일치하는 항목이 없어요. 다른 말로 찾아보세요.'}</p>}
          <div ref={content} className={`book-reading-content${lesson ? ' is-lesson' : ''}`} dangerouslySetInnerHTML={markup} onMouseUp={chooseText} onKeyUp={chooseText} onTouchEnd={chooseText} />
          {lesson && !loading && !error && sections.length > 0 && <section className="manabi-chapter-finish"><p className="manabi-eyebrow">한 과를 마치며</p><h2>이제 내 말로 꺼내 볼까요?</h2><p>{lesson.goal}</p><div className="manabi-row"><button className="manabi-button" type="button" disabled={progress.completed.includes(unit)} onClick={() => update({ completed: [...progress.completed, unit] })}>{progress.completed.includes(unit) ? '학습한 과예요 ✓' : '이 과 학습 완료'}</button>{next ? <a className="manabi-link" href={bookHref(book.edition, `${next.id}-start`)}>{String(next.number).padStart(2, '0')}과로 →</a> : <Link className="manabi-link" href={`/books/japanese-n5/review?edition=${book.edition}`}>담은 표현 복습하기 →</Link>}</div><small role="status">{!storageAvailable ? '현재 브라우저에서 읽기 기록을 저장할 수 없어요.' : draftStatus || '읽던 위치와 답안은 이 브라우저에 기억해요.'}</small></section>}
        </div></div>
    </div>}
    {selection && !preview && <div className="manabi-selection-bar"><p lang="ja">{selection.quote}</p><button type="button" className="manabi-button" onClick={() => openPanel('selection')}>이 표현 담기</button><button type="button" className="manabi-link" aria-label="선택 닫기" onClick={() => setSelection(null)}>닫기</button></div>}
    {examples.map((item, index) => createPortal(user ? <SaveContextButton word={{ word_text: item.quote, meaning: item.meaning, furigana: item.furigana, language: 'Japanese' }} source={{ kind: 'textbook', bookId: BOOK_ID, editionId: book.edition, pageId: item.pageId, quote: item.quote }} label="이 예문 담기 +" /> : <Link className="manabi-example-signin" href="/auth">로그인 후 담기 +</Link>, item.mount, `${item.pageId}:${index}:${user?.id || 'guest'}`))}
    <dialog ref={dialog} className="manabi-reading-dialog" aria-labelledby="reading-dialog-title"><div className="manabi-section-heading"><h2 id="reading-dialog-title">{panel === 'selection' ? '기억할 표현' : '이 과와 함께 읽기'}</h2><button type="button" className="manabi-link" onClick={() => dialog.current.close()}>닫기</button></div>
      {panel === 'selection' && selection ? <><blockquote lang="ja">{selection.quote}</blockquote><label>기억할 표현<input maxLength={160} lang="ja" value={expression} onChange={event => setExpression(event.target.value)} /></label><label>한국어 뜻<input maxLength={1000} value={meaning} onChange={event => setMeaning(event.target.value)} /></label>{expression.trim() && meaning.trim() ? <SaveContextButton key={`${selection.pageId}:${expression}:${meaning}`} word={{ word_text: expression, meaning, language: 'Japanese' }} source={{ kind: 'textbook', bookId: BOOK_ID, editionId: book.edition, ...selection }} /> : <p>표현과 뜻을 채워 주세요.</p>}</> : <><p>{lesson?.title}</p>{lesson && !preview && <MaterialChapterLinks key={unit} lang="Japanese" slug={`n5-book-${unit}`} />}<Link className="manabi-link" href={`/books/japanese-n5/materials?edition=${book.edition}`}>문화 읽기와 내 자료 →</Link></>}
    </dialog>
  </div>;
}
