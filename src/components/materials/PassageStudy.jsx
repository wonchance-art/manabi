'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { COMPOSER_LANGUAGES } from '@/lib/materialComposer';
import { documentOf } from '@/lib/materialDocument';
import { langNameKo } from '@/lib/constants';
import { safeLibraryReturn } from '@/lib/libraryReturn';
import { requestPassageAnalysis } from '@/lib/passageAnalysis';
import { codePointLength, domSourceText, selectedSourceRange, quoteRange, passageBlocks, passageLocation,
  PASSAGE_MAX_CHARS, openSourcePassage, passageError } from '@/lib/sourcePassage';
import './source-passage.css';

export default function PassageStudy({ material, sources, preferredKey }) {
  const router = useRouter(), params = useSearchParams(), cache = useQueryClient();
  const dialog = useRef(null), opener = useRef(null), frozen = useRef(null);
  const [selection, setSelection] = useState(null);
  const [selectionNotice, setSelectionNotice] = useState('');
  const [draft, setDraft] = useState(null);
  const [language, setLanguage] = useState(documentOf(material)?.language || '');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [shownBlocks, setShownBlocks] = useState(40);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setSelection(null); frozen.current = null; }, [preferredKey]);
  useEffect(() => {
    const selected = () => {
      if (dialog.current?.open) return;
      const current = window.getSelection();
      if (current?.isCollapsed) return; // Moving focus to the action must keep the just-selected range.
      const match = sources.map(item => ({ item, quote: selectedSourceRange(item.element, current) })).find(value => value.quote?.exact.trim());
      setSelection(match || null);
      const range = current?.rangeCount ? current.getRangeAt(0) : null;
      const touchesSource = range && sources.some(item => item.element?.contains(range.startContainer) || item.element?.contains(range.endContainer));
      setSelectionNotice(!match && touchesSource ? '한 쪽이나 한 장 안에서 구간을 골라 주세요.' : '');
    };
    const clear = event => {
      if (dialog.current?.open || opener.current?.contains(event.target)) return;
      setSelection(null); setSelectionNotice(''); frozen.current = null;
    };
    document.addEventListener('selectionchange', selected);
    document.addEventListener('pointerdown', clear);
    return () => { document.removeEventListener('selectionchange', selected); document.removeEventListener('pointerdown', clear); };
  }, [sources]);

  function open() {
    const chosen = frozen.current || selection;
    const item = chosen?.item || sources.find(value => value.key === preferredKey) || sources[0];
    if (!item?.element?.isConnected) return;
    const text = domSourceText(item.element), quote = chosen?.quote || null;
    setDraft({ item, sourceText: text, quote, text: quote?.exact || '', first: null, last: null,
      editing: !text.trim(), manual: !text.trim() });
    setError(''); setShownBlocks(40); dialog.current.showModal();
  }
  function chooseSource(key) {
    const item = sources.find(value => value.key === key);
    if (!item?.element?.isConnected) return;
    const text = domSourceText(item.element);
    setDraft({ item, sourceText: text, quote: null, text: '', first: null, last: null, editing: !text.trim(), manual: !text.trim() });
    setError(''); setShownBlocks(40);
  }
  function close() { if (busy) return; dialog.current?.close(); setDraft(null); opener.current?.focus(); }
  function pick(index) {
    const blocks = passageBlocks(draft.sourceText);
    const first = draft.first === null ? index : Math.min(draft.first, index);
    const last = draft.first === null ? index : Math.max(draft.last, index);
    const quote = quoteRange(draft.sourceText, blocks[first].start, blocks[last].end);
    setDraft({ ...draft, first, last, quote, text: quote.exact, editing: false, manual: false });
  }
  async function start() {
    if (busy || !draft) return;
    setBusy(true); setError('');
    try {
      const source = { ...draft.item.source, quote: draft.quote, manual: draft.manual };
      const record = await openSourcePassage(supabase, material, source, draft.text, language);
      if (!alive.current) return;
      cache.setQueryData(['material', String(record.id)], record);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['passage-list', material.owner_id, String(material.id)] }),
        cache.invalidateQueries({ queryKey: ['personal-library', material.owner_id] }),
      ]);
      requestPassageAnalysis(material.owner_id, record.id);
      const search = new URLSearchParams({ study: '1', returnTo: safeLibraryReturn(params.get('returnTo')) });
      dialog.current?.close(); router.push(`/viewer/${record.id}?${search}`);
    } catch (err) { if (alive.current) setError(passageError(err)); }
    finally { if (alive.current) setBusy(false); }
  }
  const count = codePointLength(draft?.text);
  const sourceText = draft?.sourceText;
  const blocks = useMemo(() => sourceText ? passageBlocks(sourceText) : [], [sourceText]);
  const originalTooLong = codePointLength(draft?.quote?.exact) > 4000;
  const sourceChoices = sources.filter(item => item.source.kind === 'body' || item.key === preferredKey || item.key === draft?.item.key);
  const preferred = sources.find(value => value.key === preferredKey) || sources[0];
  return <>
    <div className={`passage-toolbar${selection ? ' passage-toolbar--selected' : ''}`}>
      <div><span className="manabi-eyebrow">READ INTO LEARNING</span><p>{selectionNotice || (selection ? '고른 문장을 학습으로 이어가세요.' : preferred ? `${passageLocation(preferred.source)}에서 필요한 부분만 골라 보세요.` : '원본이 열리면 학습할 부분을 고를 수 있어요.')}</p></div>
      <button ref={opener} className="manabi-button" disabled={!sources.length} onPointerDown={() => { frozen.current = selection; }} onClick={open}>{selection ? '선택한 부분 공부하기' : '학습할 부분 고르기'}</button>
    </div>
    <dialog ref={dialog} className="passage-dialog" aria-labelledby="passage-heading" onCancel={event => { event.preventDefault(); close(); }}>
      {draft && <div className="passage-panel" data-language={language}>
        <header><div><span className="manabi-eyebrow">A PASSAGE TO KEEP</span><h2 id="passage-heading">이 부분 공부하기</h2></div><button type="button" aria-label="구간 선택 닫기" disabled={busy} onClick={close}>닫기</button></header>
        <p className="passage-origin">{material.title}<span>{draft.item.title ? `${draft.item.title} · ` : ''}{passageLocation(draft.item.source)}</span></p>
        {!draft.quote && sourceChoices.length > 1 && <div className="passage-source-choice"><label htmlFor="passage-source">구간을 고를 위치</label><select id="passage-source" value={draft.item.key} disabled={busy} onChange={event => chooseSource(event.target.value)}>{sourceChoices.map(item => <option key={item.key} value={item.key}>{item.title ? `${item.title} · ` : ''}{passageLocation(item.source)}</option>)}</select></div>}
        {!draft.quote && !draft.manual && <div className="passage-picker">
          <p>공부할 글을 눌러 고르세요. 다음 블록은 선택한 뒤 이어 붙일 수 있어요.</p>
          <div className="passage-blocks">{blocks.slice(0, shownBlocks).map((block, index) => <button key={block.start} type="button" aria-label={`${index + 1}번째 글 선택`} onClick={() => pick(index)}>{block.text}</button>)}{shownBlocks < blocks.length && <button onClick={() => setShownBlocks(value => value + 40)}>다음 글 펼치기</button>}</div>
        </div>}
        {draft.quote && <>
          <blockquote className="passage-quote">{draft.quote.exact}</blockquote>
          <div className="passage-adjust"><button disabled={busy} onClick={() => setDraft({ ...draft, quote: null, first: null, last: null, text: '', editing: false })}>다시 고르기</button>
            {draft.last !== null && draft.last + 1 < blocks.length && <button disabled={busy} onClick={() => pick(draft.last + 1)}>다음 블록 포함</button>}
            <button disabled={busy} onClick={() => setDraft({ ...draft, editing: !draft.editing })}>{draft.editing ? '다듬기 접기' : '내용 다듬기'}</button></div>
        </>}
        {!draft.sourceText.trim() && <p className="passage-warning" role="status">이 부분의 글자를 가져올 수 없어요. 공부할 문장을 직접 입력하면 이 위치와 함께 보관합니다.</p>}
        {(draft.editing || draft.manual) && <div className="passage-input"><label htmlFor="passage-study-text">학습할 내용</label><textarea id="passage-study-text" aria-describedby="passage-text-note" value={draft.text} disabled={busy} onChange={event => setDraft({ ...draft, text: event.target.value })} rows={6} /><small id="passage-text-note">{draft.manual ? '직접 입력한 내용 · 출처는 쪽·장까지 연결됩니다.' : '학습할 내용만 다듬습니다. 선택했던 원문도 함께 보관됩니다.'}</small></div>}
        {!draft.quote && !draft.manual && <button className="passage-manual" onClick={() => setDraft({ ...draft, manual: true, editing: true, text: '' })}>추출된 글이 어색한가요? 직접 입력</button>}
        <div className="passage-settings"><div><label htmlFor="passage-language">학습 언어</label><select id="passage-language" value={language} disabled={busy} onChange={event => setLanguage(event.target.value)}><option value="">언어 선택</option>{COMPOSER_LANGUAGES.map(value => <option key={value} value={value}>{langNameKo(value)}</option>)}</select></div><span className={count > PASSAGE_MAX_CHARS ? 'passage-warning' : ''}>{count.toLocaleString()} / {PASSAGE_MAX_CHARS.toLocaleString()}자</span></div>
        {count > PASSAGE_MAX_CHARS && <p role="alert" className="passage-warning">조금 더 짧게 골라 주세요. 선택한 내용을 임의로 잘라내지 않습니다.</p>}
        {originalTooLong && <p role="alert" className="passage-warning">원문 선택 범위가 너무 길어요. 원본에서 짧은 구간을 다시 선택하거나 직접 입력해 주세요.</p>}
        {error && <p role="alert" className="passage-warning">{error}</p>}
        <footer><p>선택한 구간의 뜻과 표현을 준비합니다.</p><button className="manabi-button" disabled={busy || !language || !draft.text.trim() || count > PASSAGE_MAX_CHARS || originalTooLong} onClick={start}>{busy ? '구간을 여는 중…' : '이 부분 공부하기'}</button></footer>
      </div>}
    </dialog>
  </>;
}
