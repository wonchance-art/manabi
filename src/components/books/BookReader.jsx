'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authEntryHref } from '@/lib/authRedirect';
import { useAuth } from '@/lib/AuthContext';
import SaveContextButton from '@/components/learning/SaveContextButton';
import MaterialChapterLinks from '@/components/learning/MaterialChapterLinks';
import { BOOK_ID, bookHref as textbookHref, previewBookHref } from '@/lib/textbook/contract';
import { bookReferenceHref, bookReviewHref } from '@/lib/bookReviewNavigation';
import { readingDraftKey, readingUnit } from '@/lib/bookNavigation';
import useReadingProgress from './useReadingProgress';
import BookHome from './BookHome';
import BookEditionFonts from './BookEditionFonts';
import BookReaderSkeleton from './BookReaderSkeleton';
import { HASH_GATE, announceFragmentUrl, coverPage, hashGate, pageFromHash, rememberRouterTree } from './bookEntryGate';
import { BOOK_COVER_PLACE_KEY, bookCoverPlaceOf, lessonPage, withBookCoverPlace } from './bookEntryGate';
import './reading-content.css';
import useLibraryActivity from '@/components/library/useLibraryActivity';
import {LibraryReturnLinkTo} from '@/components/web/LibraryReturnLink';
import {safeLibraryReturn, libraryReaderHref} from '@/lib/libraryReturn';
import { friendlyToastMessage } from '@/lib/errorMessage';
import { loadUnit, prefetchUnit, rememberedUnit } from './unitMemory';
import { focusIsLost, focusPageIfLost } from '@/lib/routeFocus';

function withoutRuby(node) {
  if (!node) return '';
  const clone = node.cloneNode(true);
  clone.querySelectorAll('rt,.reading-note,.book-example-save').forEach(el => el.remove());
  return clone.textContent.trim();
}

function readingText(node) {
  const clone = node.cloneNode(true);
  clone.querySelectorAll('ruby').forEach(ruby => { const reading = ruby.querySelector('rt')?.textContent; if (reading) ruby.replaceWith(reading); });
  return clone.textContent.trim();
}

/** 표지 목차에서 열려 있는 파트 이름들(BOOK-HOME-RESTORE-001) — 사용자가 연 파트까지 같아야 돌아왔을 때 높이가 같다. */
const openTocParts = node => [...(node?.querySelectorAll('.manabi-book-home details[data-toc-part]') || [])].filter(group => group.open).map(group => group.dataset.tocPart);

// 본문 위치로 바로 열기 — 첫 쪽 판정 · 하드 로드 감춤 한 줄 · 본문 골격은 bookEntryGate · BookReaderSkeleton(BOOK-HASH-ENTRY-001 · BOOK-ENTRY-SKELETON-001).

// 「돌아가기」 맥락(?returnTo)은 주소에서 읽는다 — 쿼리가 붙은 교재 화면(동적 갈래)이 이 부품을 쓴다.
// 쿼리 없는 표지 판(ISR, GUEST-STATIC-001 4단계)은 BookReaderView를 returnTo 없이 직접 쓴다: 정적으로 굽는 화면이 useSearchParams를 부르면
// 가까운 Suspense까지 서버 HTML이 비어(CSR bailout) 표지가 붙은 뒤에야 그려진다. 그 판은 middleware가 쿼리 없는 요청에만 고르므로 returnTo가 늘 없다.
// 책 안 이동(go)은 주소의 returnTo를 그대로 옮겨 적으므로(window.location) 한 문서 안에서 맥락이 바뀌지 않는다.
export default function BookReader(props) {
  const params = useSearchParams();
  return <BookReaderView {...props} returnTo={params.get('returnTo')} />;
}

export function BookReaderView({ book, sectionIndex, preview = false, reference = false, sessionHint = false, returnTo = null }) {
  const bookId = book.bookId || BOOK_ID;
  const level = book.level || 'N5';
  const bookHref = useCallback((edition, page = 'cover') => textbookHref(edition, page, bookId), [bookId]);
  const { user, loading: authLoading } = useAuth();
  const { progress, update, storageAvailable, hasProgress, ready } = useReadingProgress(book.edition, book.bookId || BOOK_ID);
  const content = useRef(null), root = useRef(null), toolbar = useRef(null), referenceMenu = useRef(null), dialog = useRef(null), dialogOrigin = useRef(null), pendingAnchor = useRef(null), pendingPosition = useRef(null);
  // 책 안 이동(목차 → 과 · 다음 과 · ← 책 목차 · 뒤로 · 앞으로)은 pathname이 같아 전역 되찾기(Layout · routeFocus)가 건너뛴다 —
  // 누른 링크가 새 쪽에서 사라지면 초점이 body로 떨어졌다(키보드 둘러보기 Preview 8d2b681 실측). 첫 진입(새로 열기)은 옮기지 않는다.
  const focusAfterMove = useRef(false);
  const [pageId, setPageId] = useState('cover'), [active, setActive] = useState('');
  const [anchorRequest, setAnchorRequest] = useState(0);
  const [entryDecided, setEntryDecided] = useState(false);
  const [sections, setSections] = useState([]), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [focus, setFocus] = useState(false), [selection, setSelection] = useState(null), [expression, setExpression] = useState(''), [meaning, setMeaning] = useState('');
  const [examples, setExamples] = useState([]), [panel, setPanel] = useState('selection'), [query, setQuery] = useState(''), [searchCount, setSearchCount] = useState(0), [draftStatus, setDraftStatus] = useState('');
  const unit = readingUnit(pageId, sectionIndex, bookId);
  // 표지 자리(BOOK-HOME-RESTORE-001)에 쓰는 값 — 전체 목차 펼침은 표지가 다시 붙어도(다른 화면에서 뒤로) 이어진다.
  const [tocAll, setTocAll] = useState(false), [tocOpen, setTocOpen] = useState(null);
  const unitRef = useRef(unit), tocAllRef = useRef(tocAll);
  // pendingCover = sync가 이 기록에서 찾은 표지 자리(스크롤 단계가 주소로 다시 찾지 않게). coverHold = 높이가 모자라 잘라 옮긴
  // 자리 — 사용자가 움직이기 전까지는 잘린 값을 이 기록에 다시 쓰지 않는다(원래 자리를 지킨다).
  const pendingCover = useRef(null), coverHold = useRef(null);
  unitRef.current = unit; tocAllRef.current = tocAll;
  const lesson = book.lessons.find(item => item.id === unit);
  // 판본 읽기 기록의 context는 page 하나 — DB 트리거(validate_library_activity)가 판본에는 page만 받는다. bookId를 함께 보내 10-17(#1510)부터
  // 교재 읽기 기록이 모두 400(22023 invalid_library_page)이었다(운영 edge 로그 2026-10-26 KST: 36번 중 34번). 책은 서재 RPC가 판본에서 급수로 내려 준다.
  useLibraryActivity({target_kind:'edition',target_id:book.edition,context:{page:active.startsWith(`${unit}-`)?active:pageId}},!reference&&!preview&&!loading&&!error&&!!lesson&&!!sections.length&&sections[0].unit===unit);
  const unitSections = sectionIndex.filter(section => section.unit === unit);
  const draftKey = readingDraftKey(book.edition, user?.id);
  // Keep this object stable: React must not replace imperative answer fields and portal mounts on progress updates.
  const markup = useMemo(() => ({ __html: sections.map(section => section.html).join('\n') }), [sections]);

  useEffect(() => {
    const closeOutside = event => {
      const menu = referenceMenu.current;
      if (menu && !menu.contains(event.target)) menu.open = false;
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);

  function leaveReferenceMenu(event) {
    // Safari focuses the tabindex=-1 reader before activating a pointer link.
    // Outside pointer presses are handled separately; Tab targets remain >= 0.
    if (event.relatedTarget?.tabIndex >= 0 && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
  }

  const measureToolbar = useCallback(() => {
    const bar = toolbar.current;
    if (bar) root.current?.style.setProperty('--book-toolbar-height', `${bar.getBoundingClientRect().height}px`);
  }, []);

  useLayoutEffect(() => {
    const reader = root.current, bar = toolbar.current;
    if (!reader || !bar) return;
    // A narrow screen or larger text can wrap the toolbar. Anchors must clear
    // its rendered height, not a second, independently maintained breakpoint.
    measureToolbar();
    const observer = new ResizeObserver(measureToolbar);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [unit, measureToolbar, loading]); // 과를 받는 동안은 골격이 도구 줄 자리를 대신한다 — 다 받으면 새 도구 줄을 다시 잰다

  // 첫 쪽(BOOK-HASH-ENTRY-001) — 계정 확인을 기다리지 않고 hash로 정한다. 읽던 자리(이 기록의 manabiBookPosition)는 계정과
  // 판본을 대조해야 하므로 sync가 정할 때까지 표지를 감춘 채 둔다. 앵커 이동 · 진도 기록은 그대로 sync 뒤에 한다(pendingAnchor).
  useLayoutEffect(() => {
    const id = pageFromHash(window.location.hash);
    if (!coverPage(id)) { pendingAnchor.current = id; setPageId(id); setActive(id); }
    if (window.history.state?.manabiBookPosition?.href === window.location.href) hashGate(true);
    else setEntryDecided(true);
  }, []);
  useLayoutEffect(() => { if (entryDecided) hashGate(false); }, [entryDecided]);
  useLayoutEffect(() => () => hashGate(false), []);

  const rememberPosition = useCallback(current => {
    if (authLoading || pendingAnchor.current || dialog.current?.open) return;
    // 표지(책 목차)는 쪽이 없다 — 이 기록에 세로 위치 · 전체 목차 펼침 · 열린 파트만 남긴다(BOOK-HOME-RESTORE-001 · bookCoverPlaceOf).
    // 열린 파트는 화면(details)에서 읽는다 — 사용자가 연 파트까지 같아야 돌아왔을 때 높이가 같다.
    // unit은 ref로 읽는다 — 의존성에 넣으면 쪽이 바뀔 때마다 sync 효과가 다시 돌아 앵커 이동이 되풀이된다.
    if (unitRef.current === 'cover') {
      const open = openTocParts(root.current);
      const hold = coverHold.current;
      if (hold && Math.abs(window.scrollY - hold.top) < 1 && hold.all === tocAllRef.current && hold.open === JSON.stringify(open)) return;
      coverHold.current = null;
      window.history.replaceState(withBookCoverPlace(window.history.state, { href: window.location.href, y: Math.round(window.scrollY), all: tocAllRef.current, open }), '', window.location.href);
      return;
    }
    const articles = [...(content.current?.querySelectorAll('article[data-unit-page]') || [])];
    current ||= articles.filter(article => article.getBoundingClientRect().top < Math.min(240, innerHeight * .32)).at(-1) || articles[0];
    if (!current) return;
    const position = {
      href: window.location.href, document: performance.timeOrigin, edition: book.edition, account: user?.id || 'guest', reference,
      page: current.id, offset: current.getBoundingClientRect().top - (toolbar.current?.getBoundingClientRect().bottom || 0),
    };
    // Keep Next's routing state and the explicit URL anchor intact. This belongs
    // to one history entry, not to the account's reading-progress storage.
    rememberRouterTree(); // 같은 문서 tree를 기억해 둔다 — 고유 hash 이동의 새 기록에 표지와 함께 찍는다(announceFragmentUrl)
    window.history.replaceState({ ...window.history.state, manabiBookPosition: position }, '', window.location.href);
  }, [authLoading, book.edition, user?.id, reference]);

  useEffect(() => {
    if (authLoading) return;
    // Own restoration while mounted, including after a bfcache return.
    const restoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    // href = 그 이동의 주소(이벤트가 준 것) — 지금 주소는 라우터가 잠깐 옛 hash로 되돌려 놓았을 수 있다(announceFragmentUrl).
    const sync = (restorePosition, href = window.location.href) => {
      let id = pageFromHash(new URL(href).hash);
      const saved = window.history.state?.manabiBookPosition;
      const position = restorePosition && saved?.href === href && saved.edition === book.edition
        && saved.account === (user?.id || 'guest') && saved.reference === reference
        && Number.isFinite(saved.offset) && sectionIndex.some(section => section.id === saved.page) ? saved : null;
      if (position) id = position.page;
      // 표지로 돌아오면(뒤로 · 앞으로 · 새로 고침 · bfcache) 그 기록의 전체 목차 · 열린 파트부터 — 높이가 같아야 남긴 세로 위치로
      // 맞는다(옮기기는 앵커 효과가 pendingCover로). 자리 기록이 없는 표지(새로 연 표지)는 기본값(지금 파트만, 맨 위)이다.
      const coverPlace = id === 'cover' && restorePosition ? bookCoverPlaceOf(window.history.state, href) : null;
      if (coverPlace) { setTocAll(coverPlace.all); setTocOpen(coverPlace.open); }
      else if (id === 'cover') { setTocAll(false); setTocOpen(null); }
      pendingCover.current = coverPlace; coverHold.current = null;
      pendingPosition.current = position;
      pendingAnchor.current = id; setPageId(id); setActive(id);
      // The same hash can belong to entries with distinct reading positions.
      setAnchorRequest(request => request + 1);
      setEntryDecided(true);
    };
    // Next preserves custom state on traversal, and clears it on fresh Link navigation.
    // Internal reader links also clear the snapshot before pushing an explicit anchor.
    rememberRouterTree(); // 붙을 때 이 문서의 Next tree(뒤로/앞으로 기록의 tree는 announceFragmentUrl이 그때 기억한다)
    sync(true);
    let traversedHref;
    const pop = () => { traversedHref = window.location.href; focusAfterMove.current = true; sync(true, traversedHref); };
    const hash = event => {
      const href = event?.newURL || window.location.href;
      // 라우터가 이 주소를 알게 한다 — 모르면 늦게 든 라우터 갱신이 주소를 옛 hash로 되돌린다(BOOK-HASH-RACE-001).
      announceFragmentUrl(href);
      // Traversal can emit both events; its hashchange must not erase the snapshot.
      if (traversedHref === href) { traversedHref = null; return; }
      traversedHref = null; focusAfterMove.current = true; sync(false, href);
    };
    // 떠날 때 자리 남기기는 bfcache로 들어가지 않는 길(새로 고침 등)에서만 — pagehide 안의 history.replaceState는 Chromium이
    // 그 페이지를 bfcache에서 내쫓는다(IgnoreEventAndEvict, 실측 2026-10-17 KST). bfcache로 돌아오면 화면 · 스크롤이 그대로고,
    // 굴리기(120ms) · 이동(go) · 첫 쪽 맞춤이 이미 이 기록에 자리를 남긴다. scrollRestoration 되돌리기는 내쫓지 않아 그대로 둔다.
    const release = event => { if (!event?.persisted) rememberPosition(); window.history.scrollRestoration = restoration; };
    const acquire = event => { window.history.scrollRestoration = 'manual'; if (event.persisted) sync(true); };
    window.addEventListener('hashchange', hash); window.addEventListener('popstate', pop);
    window.addEventListener('pagehide', release); window.addEventListener('pageshow', acquire);
    return () => {
      window.removeEventListener('hashchange', hash); window.removeEventListener('popstate', pop);
      window.removeEventListener('pagehide', release); window.removeEventListener('pageshow', acquire);
      window.history.scrollRestoration = restoration;
    };
  }, [authLoading, book.edition, user?.id, reference, sectionIndex, rememberPosition]);

  useEffect(() => {
    const controller = new AbortController();
    let stale = false;
    setExamples([]); setError(''); setQuery('');
    if (!unit || unit === 'cover') { setSections([]); setLoading(false); return () => controller.abort(); }
    const memoryKey = `${bookId}:${book.edition}:${unit}`, remembered = preview ? null : rememberedUnit(memoryKey);
    if (remembered) { setSections(remembered); setLoading(false); return () => controller.abort(); }
    setSections([]); setLoading(true);
    const url = `/api/books/${bookId}/${book.edition}/reading?unit=${unit}`;
    // 공개 판본은 미리 받기(과 끝 줄)와 같은 요청을 함께 쓴다(loadUnit) — 같은 과를 두 번 받지 않는다. 미리보기는 따로, 기억 없이.
    const request = preview
      ? fetch(url, { signal: controller.signal }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || '본문을 불러오지 못했어요.'); return data.sections; })
      : loadUnit(memoryKey, url);
    request
      .then(next => { if (!stale) { setSections(next); setLoading(false); } })
      .catch(cause => { if (!stale && cause.name !== 'AbortError') { setError(friendlyToastMessage(cause)); setLoading(false); } });
    return () => { stale = true; controller.abort(); };
  }, [bookId, book.edition, unit, preview]);

  useEffect(() => {
    const node = content.current;
    if (!node || !sections.length) return;
    // Present the immutable manuscript without repeating its stage heading.
    const duplicateStages = [];
    for (const stage of node.querySelectorAll('.stage')) {
      const heading = stage.nextElementSibling;
      const text = element => element.textContent.replace(/\s+/g, ' ').trim();
      if (heading?.tagName === 'H2' && text(stage) === text(heading) && getComputedStyle(heading).display !== 'none') {
        stage.classList.add('is-duplicate-stage'); duplicateStages.push(stage);
      }
    }
    // Each later page repeats the chapter subtitle the opening already shows.
    // Supplement pages carry their own subtitle, so only exact repeats are hidden.
    const duplicateSubtitles = [];
    const subtitle = lesson?.subtitle?.replace(/\s+/g, ' ').trim();
    if (subtitle) for (const line of node.querySelectorAll('.paper > .subtitle')) {
      if (line.textContent.replace(/\s+/g, ' ').trim() === subtitle) { line.classList.add('is-duplicate-subtitle'); duplicateSubtitles.push(line); }
    }
    // Reading and listening questions are unmarked in the body; give them the
    // same name the answer key uses for that chapter so the two can be matched.
    const questionLabels = [];
    const label = (question, text) => {
      if (!question || !text || question.querySelector(':scope > .book-question-label')) return;
      const tag = document.createElement('span'); tag.className = 'book-question-label'; tag.textContent = text;
      question.prepend(tag); questionLabels.push(tag);
    };
    const answerName = (unitPage, names) => [...node.querySelectorAll(`[data-unit-page="${unitPage}"] .answer > b`)]
      .map(item => item.textContent.trim()).find(text => names.includes(text));
    for (const question of node.querySelectorAll('.listen-question')) {
      const unitPage = question.closest('[data-unit-page]')?.dataset.unitPage;
      if (unitPage) label(question, answerName(unitPage, ['대화 확인', '먼저 듣기']));
    }
    for (const passage of node.querySelectorAll('article[id$="-practice"] .reading')) {
      const question = passage.nextElementSibling;
      const unitPage = passage.closest('[data-unit-page]')?.dataset.unitPage;
      if (question?.tagName === 'P' && !question.className && unitPage) label(question, answerName(unitPage, ['읽기']));
    }
    const dialogueHeaders = [];
    for (const button of node.querySelectorAll('.dialogue .translation')) {
      // A dialogue inside its own titled block keeps the control beside that title.
      if (button.closest('.learning-block')?.querySelector(':scope > h3')) continue;
      const heading = button.closest('article')?.querySelector(':scope > h2');
      if (!heading) continue;
      const marker = document.createComment('translation control');
      const header = document.createElement('div'); header.className = 'book-dialogue-heading';
      button.before(marker); heading.before(header); header.append(heading, button);
      dialogueHeaders.push({ header, heading, button, marker });
    }
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
    return () => {
      node.removeEventListener('input', remember); mounts.forEach(item => item.mount.remove());
      duplicateStages.forEach(stage => stage.classList.remove('is-duplicate-stage'));
      duplicateSubtitles.forEach(line => line.classList.remove('is-duplicate-subtitle'));
      questionLabels.forEach(tag => tag.remove());
      dialogueHeaders.forEach(({ header, heading, button, marker }) => { header.before(heading); marker.replaceWith(button); header.remove(); });
    };
  }, [sections, draftKey, preview, lesson?.subtitle]);

  useEffect(() => {
    // 계정 확인(sync) 전에는 옮기지 않는다 — 첫 쪽을 hash로 먼저 정해도 읽던 자리 대조는 sync가 한다.
    if (authLoading || !ready || (unit !== 'cover' && (!sections.length || sections[0].unit !== unit))) return;
    // Imperative mounts precede their React portals. Restore only after the
    // controls occupy their final space; native scroll anchoring is not exact.
    if (examples.some(({ mount }) => !content.current?.contains(mount) || !mount.firstElementChild)
      || content.current?.querySelector('.book-example-save:empty')) return;
    let frame, cancelled = false;
    document.fonts.ready.then(() => { if (cancelled) return; frame = requestAnimationFrame(() => {
      const id = pendingAnchor.current;
      if (!id || id !== pageId) return;
      const target = document.getElementById(id);
      target?.closest('details')?.setAttribute('open', '');
      measureToolbar();
      // Complete restoration before clearing the pending anchor or tracking progress.
      const position = pendingPosition.current;
      if (position && target) {
        // Settle the sticky toolbar before applying the saved relative offset.
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
        window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - (toolbar.current?.getBoundingClientRect().bottom || 0) - position.offset, behavior: 'instant' });
      }
      else if (id === 'cover') {
        // 표지 — 이 기록에 남긴 세로 위치로, 없으면(새로 들어온 표지) 맨 위로(BOOK-HOME-RESTORE-001). 더 내려갈 수 없으면 끝까지.
        const place = pendingCover.current, top = place ? Math.min(place.y, Math.max(0, document.documentElement.scrollHeight - innerHeight)) : 0;
        window.scrollTo({ top, behavior: 'instant' });
        // 잘라 옮겼으면 그 자리 · 펼침이 그대로인 동안은 원래 값을 지킨다(rememberPosition이 건너뛴다).
        if (place && top < place.y) coverHold.current = { top, all: tocAllRef.current, open: JSON.stringify(openTocParts(root.current)) };
      }
      else if (id === unit || id === `${unit}-start`) window.scrollTo({ top: 0, behavior: 'instant' });
      else (target || root.current)?.scrollIntoView({ block: 'start', behavior: 'instant' });
      if (target?.classList.contains('kanji-card')) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
      // 살아 있는 초점은 빼앗지 않는다 — 잃었을 때만 새 쪽의 첫 제목(없으면 본문)으로(routeFocus 정본).
      if (focusAfterMove.current) {
        focusAfterMove.current = false;
        // 누른 링크가 접혀 숨은 것도 잃은 것이다 — 모바일 「이 과의 목차」는 누르면 접혀, 초점이 보이지 않는 링크에 남았다가
        // body로 떨어졌다(390 실측 2026-10-17 KST). 숨은 초점을 풀고 새 쪽의 첫 제목(없으면 본문)으로.
        const active = document.activeElement;
        if (!focusIsLost(document) && active?.getClientRects?.().length === 0) active.blur();
        focusPageIfLost(document);
      }
      pendingAnchor.current = null; pendingPosition.current = null; pendingCover.current = null;
      rememberPosition();
      if (!reference && /^u\d{2}/.test(id)) update({ page: id });
    }); });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [authLoading, pageId, anchorRequest, sections, examples, unit, update, ready, measureToolbar, reference, rememberPosition]);

  useEffect(() => {
    if (!sections.length) return;
    let timer;
    const track = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (pendingAnchor.current || dialog.current?.open) return;
        const articles = [...(content.current?.querySelectorAll('article[data-unit-page]') || [])];
        const current = articles.filter(article => article.getBoundingClientRect().top < Math.min(240, innerHeight * .32)).at(-1) || articles[0];
        if (current) { rememberPosition(current); setActive(current.id); if (lesson && !reference) update({ page: current.id }); }
      }, 120);
    };
    window.addEventListener('scroll', track, { passive: true }); track();
    return () => { clearTimeout(timer); window.removeEventListener('scroll', track); };
  }, [sections, lesson, update, reference, rememberPosition]);

  useEffect(() => {
    if (unit !== 'cover') return undefined;
    // 표지 자리 남기기(BOOK-HOME-RESTORE-001, LevelListPage와 같은 때) — 굴리기를 멈췄을 때 · 링크를 누를 때(capture: Next Link가
    // 새 기록을 쌓기 전). 떠날 때는 release(bfcache로 들어가지 않는 길만), 책 안 이동은 go가 남긴다.
    let timer;
    const scroll = () => { clearTimeout(timer); timer = setTimeout(() => rememberPosition(), 120); };
    const click = event => { if (event.target?.closest?.('a[href]')) rememberPosition(); };
    window.addEventListener('scroll', scroll, { passive: true });
    document.addEventListener('click', click, true);
    return () => { clearTimeout(timer); window.removeEventListener('scroll', scroll); document.removeEventListener('click', click, true); };
  }, [unit, rememberPosition]);

  useEffect(() => {
    const search = query.trim().toLocaleLowerCase();
    const cards = [...(content.current?.querySelectorAll('.lex-card,.kanji-card,.grammar-recall,.n4-reference > [data-search],.n3-reference > [data-search]') || [])];
    cards.forEach(card => { card.hidden = !!search && !String(card.dataset.search || card.textContent).toLocaleLowerCase().includes(search); });
    setSearchCount(cards.filter(card => !card.hidden).length);
    if (unit === 'reference') content.current?.querySelectorAll('article').forEach(article => { article.hidden = !!search && !article.querySelector('.lex-card:not([hidden]),.kanji-card:not([hidden]),.grammar-recall:not([hidden]),.n4-reference > [data-search]:not([hidden]),.n3-reference > [data-search]:not([hidden])'); });
  }, [query, sections, unit]);

  const go = useCallback((id, originAnchor) => {
    dialog.current?.close();
    rememberPosition();
    const navigationState = { ...window.history.state };
    delete navigationState.manabiBookPosition; delete navigationState[BOOK_COVER_PLACE_KEY];
    const back=new URLSearchParams(window.location.search).get('returnTo');
    const destination=new URL(bookHref(book.edition,id),window.location.origin);
    if(back)destination.searchParams.set('returnTo',safeLibraryReturn(back));
    if(reference)destination.searchParams.set('reference','1');
    // 미리보기는 책 안 이동 뒤 새로고침도 동적 화면에 남는다(표식 — previewBookHref, GUEST-STATIC-001 5단계). 학습자 주소는 그대로.
    if(preview)destination.searchParams.set('preview','1');
    // Return from a reading link to the exact card, including after a search.
    if (originAnchor && unit === 'reference') {
      const origin = new URL(window.location.href); origin.hash = originAnchor;
      window.history.replaceState(navigationState, '', origin.pathname+origin.search+origin.hash);
    }
    window.history.pushState(navigationState, '', destination.pathname+destination.search+destination.hash);
    setQuery('');
    pendingPosition.current = null; pendingAnchor.current = id; setPageId(id); setActive(id);
    // 책 안에서 새로 연 표지(「← 책 목차」)는 새 기록이다 — 목차 펼침 · 열린 파트를 기본값으로, 자리는 맨 위.
    pendingCover.current = null; coverHold.current = null;
    if (id === 'cover') { setTocAll(false); setTocOpen(null); }
    focusAfterMove.current = true;
    setAnchorRequest(request => request + 1);
    if (!reference && /^u\d{2}/.test(id)) update({ page: id });
  }, [book.edition, bookHref, unit, update, reference, preview, rememberPosition]);

  function interact(event) {
    const anchor = event.target.closest('a[href]');
    anchor?.closest('.manabi-reference-menu')?.removeAttribute('open');
    if (anchor && !anchor.hasAttribute('data-reading-resume') && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      const url = new URL(anchor.href, window.location.href);
      if (url.origin === location.origin && url.pathname === `/books/${bookId}` && url.hash) { event.preventDefault(); go(decodeURIComponent(url.hash.slice(1)), anchor.closest('.kanji-card')?.id); return; }
    }
    const button = event.target.closest('button');
    if (button?.dataset.unit) go(button.dataset.unit);
    if (button?.classList.contains('translation')) {
      const dialogue = button.closest('article')?.querySelector('.dialogue');
      const hidden = dialogue?.classList.toggle('hide-ko');
      button.setAttribute('aria-pressed', String(!!hidden)); button.textContent = hidden ? '해석 보기' : '해석 가리기';
    }
    if (button?.classList.contains('hide-meanings')) {
      const hidden = button.closest('article')?.classList.toggle('meaning-hidden');
      button.setAttribute('aria-pressed', String(!!hidden)); button.textContent = button.closest('article').querySelector('.kanji-card') ? (hidden ? '읽기·뜻 보기' : '읽기·뜻 가리기') : (hidden ? '뜻 보기' : '뜻 가리기');
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
  function openPanel(next, origin) { dialogOrigin.current = origin || null; setPanel(next); dialog.current?.showModal(); }
  const readerHref = id => {
    const href = reference ? bookReferenceHref(bookHref(book.edition, id)) : bookHref(book.edition, id);
    const linked = returnTo ? libraryReaderHref(href, returnTo) : href;
    return preview ? previewBookHref(linked) : linked;
  };
  const next = lesson && book.lessons.find(item => item.number === lesson.number + 1);
  // 다음 과 미리 받기(BOOKS-FLOW-002) — 과 끝 줄(「NN과로 →」)이 화면 가까이 오면 다음 과 본문을 받아 기억해 둔다. 「다음 과」를 누르면
  // 기억에서 바로 그린다 — 받는 요청은 누를 때 받던 그 한 번이 앞당겨질 뿐이다(loadUnit이 같은 과를 두 번 받지 않는다). 발행 판본만.
  const finishRef = useRef(null), nextUnit = next?.id;
  useEffect(() => {
    const node = finishRef.current;
    if (preview || !nextUnit || !node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      prefetchUnit(`${bookId}:${book.edition}:${nextUnit}`, `/api/books/${bookId}/${book.edition}/reading?unit=${nextUnit}`);
    }, { rootMargin: '0px 0px 600px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [bookId, book.edition, nextUnit, preview, sections]); // sections: 과 끝 줄은 본문을 다 받은 뒤에 붙는다
  const title = lesson ? lesson.title : ({ guide: level === 'N3' ? '상황과 생각을 전할 준비' : level === 'N4' ? '문장을 이어 갈 준비' : '첫 문장 전에, 가볍게 준비', reference: level !== 'N5' ? '단어·문형 찾아보기' : '단어·문형·한자 찾기', materials: '일본어로 넓히는 일상' }[unit] || '교재 위치를 찾지 못했어요');
  return <div ref={root} data-book-id={bookId} className={`book-reader${focus ? ' is-focused' : ''}`} onClick={interact}>
    <BookEditionFonts book={book} />
    {reference && <div className="manabi-preview-note" role="note"><strong>복습 원문 참고</strong><p>읽던 위치는 바뀌지 않아요. 확인 후 복습하던 탭으로 돌아가세요.</p><a data-reading-resume className="manabi-link" href={bookHref(book.edition, active || pageId)}>여기부터 이어읽기 →</a></div>}
    {preview && <p className="manabi-preview-note">관리자 미리보기 · 발행 전 원고예요.</p>}
    {unit === 'cover' && !entryDecided && <><script dangerouslySetInnerHTML={{ __html: HASH_GATE }} /><BookReaderSkeleton gated /></>}
    {/* 과를 받는 동안은 본문 첫 그림 골격(BOOK-ENTRY-SKELETON-001 부품 그대로) — 빈 본문 · 상태 줄 대신 같은 자리 모양을 둔다(BOOKS-FLOW-002). */}
    {unit === 'cover' ? <BookHome book={book} preview={preview} progress={progress} hasProgress={hasProgress} ready={ready} showAll={tocAll} onShowAll={setTocAll} openParts={tocOpen} sessionHint={sessionHint} returnTo={returnTo} /> : loading ? <BookReaderSkeleton announce lesson={lessonPage(pageId)} level={level} /> : <div className="manabi-reader-page">
      <div ref={toolbar} className="manabi-reader-toolbar"><LibraryReturnLinkTo returnTo={returnTo} onlyWithContext/><a href={readerHref('cover')}>← 책 목차</a><span>일본어 · {level}{lesson ? ` / ${String(lesson.number).padStart(2, '0')}과` : ''}</span><div><Link prefetch={false} href={bookReviewHref(bookHref(book.edition, reference ? progress.page : active || pageId))}>담은 표현</Link><details ref={referenceMenu} className="manabi-reference-menu" onBlur={leaveReferenceMenu} onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary').focus(); } }}><summary>참고 자료</summary><nav aria-label="교재 참고 자료"><a href={readerHref('reference-start')}>어휘·문형·한자</a>{lesson && <button type="button" onClick={event => { const menu = event.currentTarget.closest('details'); menu.open = false; openPanel('materials', menu.querySelector('summary')); }}>이 과의 연결 자료</button>}<Link prefetch={false} href={`/books/${bookId}/materials?edition=${book.edition}`}>{book.cultures?.length ? '문화 읽기' : '내 자료 연결'}</Link></nav></details><button type="button" aria-pressed={focus} onClick={() => setFocus(!focus)}>{focus ? '기본 보기' : '집중 읽기'}</button></div></div>
      <div className="manabi-reader-grid"><aside className="manabi-reader-outline"><p className="manabi-eyebrow">{lesson ? `${String(lesson.number).padStart(2, '0')}과 · 목차` : '목차'}</p><nav aria-label="과 안의 목차">{unitSections.map(section => <a key={section.id} href={readerHref(section.id)} aria-current={active === section.id ? 'location' : undefined}>{section.title}</a>)}</nav></aside>
        <div className="manabi-reader-main"><details className="manabi-mobile-toc"><summary>이 과의 목차</summary><nav aria-label="모바일 과 목차">{unitSections.map(section => <a key={section.id} href={readerHref(section.id)} onClick={event => event.currentTarget.closest('details').removeAttribute('open')}>{section.title}</a>)}</nav></details>
          <header className="manabi-chapter-opening"><div><p className="manabi-eyebrow">{lesson?.part || `JAPANESE · ${level}`}</p>{lesson?.subtitle && <p className="manabi-chapter-subtitle">{lesson.subtitle}</p>}<h1>{title}</h1>{lesson && <p className="manabi-chapter-goal">{lesson.goal}</p>}</div>{lesson && <span className="manabi-chapter-number" aria-hidden="true">{String(lesson.number).padStart(2, '0')}</span>}</header>
          {unit === 'reference' && <label className="manabi-reference-search">어휘·문형·한자 검색<input type="search" disabled={loading || !sections.length} value={query} onChange={event => setQuery(event.target.value)} placeholder="일본어 또는 한국어로 찾아보세요" /></label>}
{error && <p className="manabi-status" role="alert">{error} <button type="button" onClick={() => location.reload()}>다시 시도</button></p>}
          {!unit && <p className="manabi-status"><a href={bookHref(book.edition)}>책 목차에서 다시 열기 →</a></p>}
          {/* 검색 결과 수 알림 — 영역은 늘 두고 내용만 바꾼다(첫 글자를 칠 때 생기는 영역은 첫 결과를 놓친다). 보이는 줄은 한 번만 읽히게 숨긴다. */}
          <span className="sr-only" role="status">{unit === 'reference' && query.trim() ? (searchCount ? `${searchCount}개 항목을 찾았어요.` : '일치하는 항목이 없어요. 다른 말로 찾아보세요.') : ''}</span>
          {unit === 'reference' && query.trim() && <p className="manabi-status" aria-hidden="true">{searchCount ? `${searchCount}개 항목을 찾았어요.` : '일치하는 항목이 없어요. 다른 말로 찾아보세요.'}</p>}
          <div ref={content} className={`book-reading-content${lesson ? ' is-lesson' : ''}`} dangerouslySetInnerHTML={markup} onMouseUp={chooseText} onKeyUp={chooseText} onTouchEnd={chooseText} />
          {lesson && !loading && !error && sections.length > 0 && <section ref={finishRef} className="manabi-chapter-finish" aria-label="과 읽기 기록"><div className="manabi-row">{!reference && <button className="manabi-button" type="button" disabled={progress.completed.includes(unit)} onClick={() => update({ completed: [...progress.completed, unit] })}>{progress.completed.includes(unit) ? '읽기 완료 ✓' : '읽기 완료'}</button>}<Link prefetch={false} className="manabi-link" href={bookReviewHref(bookHref(book.edition, reference ? progress.page : active || pageId), { from: lesson.number, to: lesson.number })}>이 과 표현 복습 →</Link>{next ? <a className="manabi-link" href={readerHref(`${next.id}-start`)}>{String(next.number).padStart(2, '0')}과로 →</a> : <Link prefetch={false} className="manabi-link" href={bookReviewHref(bookHref(book.edition, reference ? progress.page : active || pageId))}>이 교재 표현 복습 →</Link>}</div><small role="status">{!storageAvailable ? '현재 브라우저에서 읽기 기록을 저장할 수 없어요.' : draftStatus || '읽던 위치와 답안은 이 브라우저에 기억해요.'}</small></section>}
        </div></div>
    </div>}
    {selection && !preview && <div className="manabi-selection-bar"><p lang="ja">{selection.quote}</p><button type="button" className="manabi-button" onClick={() => openPanel('selection')}>표현 담기</button><button type="button" className="manabi-link" aria-label="선택 닫기" onClick={() => setSelection(null)}>닫기</button></div>}
    {examples.map((item, index) => createPortal(user ? <SaveContextButton word={{ word_text: item.quote, meaning: item.meaning, furigana: item.furigana, language: 'Japanese' }} source={{ kind: 'textbook', bookId, editionId: book.edition, pageId: item.pageId, quote: item.quote }} label="예문 담기" /> : <Link prefetch={false} className="manabi-example-signin" title="로그인 후 이 예문을 담을 수 있어요" href={authEntryHref(bookHref(book.edition, item.pageId))}>예문 담기</Link>, item.mount, `${item.pageId}:${index}:${user?.id || 'guest'}`))}
    <dialog ref={dialog} onClose={() => { dialogOrigin.current?.focus(); dialogOrigin.current = null; setPanel('selection'); }} className="manabi-reading-dialog" aria-labelledby="reading-dialog-title"><div className="manabi-section-heading"><h2 id="reading-dialog-title">{panel === 'selection' ? '기억할 표현' : '이 과의 연결 자료'}</h2><button type="button" className="manabi-link" onClick={() => dialog.current.close()}>닫기</button></div>
      {panel === 'selection' && selection ? <><blockquote lang="ja">{selection.quote}</blockquote><label>기억할 표현<input maxLength={160} lang="ja" value={expression} onChange={event => setExpression(event.target.value)} /></label><label>한국어 뜻<input maxLength={1000} value={meaning} onChange={event => setMeaning(event.target.value)} /></label>{!user ? <Link href={authEntryHref(bookHref(book.edition, selection.pageId))}>로그인 후 이 위치로 돌아오기 →</Link> : expression.trim() && meaning.trim() ? <SaveContextButton key={`${selection.pageId}:${expression}:${meaning}`} word={{ word_text: expression, meaning, language: 'Japanese' }} source={{ kind: 'textbook', bookId, editionId: book.edition, ...selection }} /> : <p>표현과 뜻을 채워 주세요.</p>}</> : panel === 'materials' ? <>{preview && <p className="manabi-muted">발행 전에는 개인 자료를 연결할 수 없어요.</p>}{lesson && !preview && <MaterialChapterLinks key={unit} lang="Japanese" slug={`${level.toLowerCase()}-book-${unit}`} browseFirst />}</> : null}
    </dialog>
  </div>;
}
