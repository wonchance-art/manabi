'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { langNameKo } from '@/lib/constants';
import { COMPOSER_LANGUAGES, MAX_ATTACHMENTS, MAX_BODY_CHARS, MAX_LINKS, composerError,
  composerTitle, createComposerSave, newComposerDraft, normalizeSourceUrl, prepareComposerFile,
  saveComposerOnce, validateComposer } from '@/lib/materialComposer';
import { readComposerDraft, removeComposerDraft, writeComposerDraft } from '@/lib/composerDraft';
import './material-composer.css';

export default function MaterialComposer() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-container" role="status">계정을 확인하고 있어요…</div>;
  if (!user) return <section className="composer-gate"><p className="manabi-eyebrow">YOUR LIBRARY</p><h1>내 서재에 담아 두세요.</h1><p>글과 파일, 링크를 한곳에서 읽을 수 있어요.</p><Link className="manabi-button" href="/auth?from=/materials/add">로그인하고 작성하기 ↗</Link></section>;
  return <ComposerForm key={user.id} ownerId={user.id} />;
}

function ComposerForm({ ownerId }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(null);
  const [draftStatus, setDraftStatus] = useState('초안을 확인하고 있어요…');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [stage, setStage] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [anotherTab, setAnotherTab] = useState(false);
  const fileInput = useRef(null);
  const linkField = useRef(null);
  const alive = useRef(true);
  const draftRef = useRef(null);
  const saveRef = useRef(null);
  const submitRef = useRef(false);
  const prepareRef = useRef(false);
  const writeQueue = useRef(Promise.resolve());

  useEffect(() => {
    alive.current = true;
    let release;
    let cancelled = false;
    const initialize = async () => {
      try {
        const stored = await readComposerDraft(ownerId);
        if (cancelled) return;
        const value = stored?.version === 1 ? stored : newComposerDraft(crypto.randomUUID());
        draftRef.current = value; setDraft(value);
        setDraftStatus(stored ? '이 기기의 초안을 불러왔어요.' : '나에게만 보이는 자료');
      } catch {
        if (cancelled) return;
        const value = newComposerDraft(crypto.randomUUID());
        draftRef.current = value; setDraft(value);
        setDraftStatus('이 브라우저는 초안을 보관할 수 없어요. 창을 닫기 전에 저장해 주세요.');
      }
    };
    // One active writer per account/browser. A second tab must never overwrite a draft.
    if (navigator.locks) {
      navigator.locks.request(`manabi-composer:${ownerId}`, { ifAvailable: true }, async lock => {
        if (cancelled) return;
        if (!lock) { setAnotherTab(true); return; }
        const hold = new Promise(resolve => { release = resolve; });
        await initialize();
        await hold;
      }).catch(() => { if (!cancelled) setAnotherTab(true); });
    } else initialize();
    return () => { cancelled = true; alive.current = false; release?.(); };
  }, [ownerId]);

  const persistDraft = useCallback((value) => {
    const operation = writeQueue.current.catch(() => {}).then(() => writeComposerDraft(ownerId, value));
    writeQueue.current = operation;
    return operation;
  }, [ownerId]);

  const change = useCallback((patch) => {
    const current = draftRef.current;
    if (!current || current.frozen || submitRef.current) return;
    const next = { ...current, ...patch };
    draftRef.current = next; setDraft(next); setError(''); setDraftStatus('초안 보관 중…');
    persistDraft(next).then(() => {
      if (alive.current && draftRef.current === next) setDraftStatus('이 기기에 초안 보관됨');
    }).catch(() => {
      if (alive.current) setDraftStatus('초안을 보관하지 못했어요. 창을 닫기 전에 저장해 주세요.');
    });
  }, [persistDraft]);

  useEffect(() => {
    const protect = event => {
      const value = draftRef.current;
      if (value && !value.savedId && (value.body || value.title || value.files.length || value.links.length)) {
        event.preventDefault(); event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, []);

  useEffect(() => { if (linkOpen) linkField.current?.focus(); }, [linkOpen]);

  function addLink(value = linkInput) {
    try {
      const url = normalizeSourceUrl(value);
      if (draftRef.current.links.includes(url)) { setNotice('이미 추가한 링크예요.'); setLinkInput(''); return; }
      if (draftRef.current.links.length >= MAX_LINKS) throw new Error('링크는 10개까지 추가할 수 있어요.');
      change({ links: [...draftRef.current.links, url] }); setLinkInput(''); setLinkOpen(false);
      setNotice('링크를 추가했어요. 원문은 저장 후 열 수 있어요.');
    } catch (err) { setError(err.message); }
  }

  async function addFiles(files) {
    if (prepareRef.current || submitRef.current || draftRef.current?.frozen) return;
    prepareRef.current = true; setPreparing(true); setError('');
    try {
      if (files.length + draftRef.current.files.length > MAX_ATTACHMENTS) throw new Error('파일은 한 자료에 5개까지 추가할 수 있어요.');
      const additions = [];
      for (const file of files) {
        const prepared = await prepareComposerFile(file);
        if (!alive.current) return;
        if (!draftRef.current.files.concat(additions).some(item => item.hash === prepared.hash)) additions.push(prepared);
      }
      if (draftRef.current.files.length + additions.length > MAX_ATTACHMENTS) throw new Error('파일은 한 자료에 5개까지 추가할 수 있어요.');
      change({ files: [...draftRef.current.files, ...additions] });
      setNotice(additions.length ? '원본을 추가했어요. 작성한 글은 그대로 유지됩니다.' : '이미 추가한 파일이에요.');
    } catch (err) { if (alive.current) setError(err.message); }
    finally { prepareRef.current = false; if (alive.current) setPreparing(false); }
  }

  async function submit(event) {
    event.preventDefault();
    if (submitRef.current || prepareRef.current || draftRef.current?.savedId) return;
    let current = draftRef.current;
    try {
      if (linkInput.trim() && !current.frozen) {
        const url = normalizeSourceUrl(linkInput);
        current = { ...current, links: [...new Set([...current.links, url])] };
      }
      validateComposer(current);
    } catch (err) { setError(err.message); return; }
    submitRef.current = true; setBusy(true); setError('');
    current = { ...current, frozen: true };
    draftRef.current = current; setDraft(current); setLinkInput('');
    try {
      // Finish the durable checkpoint before any network write. If IDB is unavailable,
      // keep the frozen in-memory attempt and clearly report the recovery limitation.
      await persistDraft(current).catch(() => setDraftStatus('창을 닫으면 이 저장 요청을 복구할 수 없어요. 완료될 때까지 기다려 주세요.'));
      if (!saveRef.current) saveRef.current = createComposerSave(ownerId, current);
      const record = await saveComposerOnce(supabase, saveRef.current, value => { if (alive.current) setStage(value); });
      const saved = { ...current, savedId: record.id };
      await persistDraft(saved).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['library-reading-v2'] });
      if (!alive.current) return;
      draftRef.current = saved; setDraft(saved); setDraftStatus('서재에 저장됨'); setStage('저장했어요. 자료를 엽니다…');
      router.push(`/viewer/${record.id}?returnTo=${encodeURIComponent('/materials?view=owned')}`);
    } catch (err) { if (alive.current) setError(composerError(err)); }
    finally { submitRef.current = false; if (alive.current) setBusy(false); }
  }

  async function startNew() {
    await writeQueue.current.catch(() => {});
    await removeComposerDraft(ownerId).catch(() => {});
    const value = newComposerDraft(crypto.randomUUID());
    draftRef.current = value; saveRef.current = null; setDraft(value); setError(''); setStage(''); setNotice('');
    setDraftStatus('나에게만 보이는 자료');
  }

  if (anotherTab) return <section className="composer-gate"><h1>다른 탭에서 작성 중이에요.</h1><p>초안이 서로 덮어써지지 않도록 한 탭에서 작성해 주세요.</p><button className="manabi-button" onClick={() => window.location.reload()}>다른 편집기를 닫고 다시 열기</button><Link className="manabi-link" href="/materials?view=owned">내 서재로</Link></section>;
  if (!draft) return <div className="composer-gate" role="status">{draftStatus}</div>;
  if (draft.savedId) return <section className="composer-gate"><p className="manabi-eyebrow">SAVED TO YOUR LIBRARY</p><h1>{composerTitle(draft)}</h1><p>서재에 저장된 자료예요.</p><Link className="manabi-button" href={`/viewer/${draft.savedId}`}>자료 열기 ↗</Link><button className="manabi-link" onClick={startNew}>새 자료 작성</button></section>;
  const locked = busy || draft.frozen;
  return <section className="material-composer" aria-labelledby="composer-heading">
    <div className="composer-top"><Link href="/materials?view=owned">← 내 서재</Link><span>PRIVATE / 나만 보기</span></div>
    <header className="composer-heading"><p className="manabi-eyebrow">A PAGE OF YOUR OWN</p><h1 id="composer-heading">새 자료</h1><p>글과 원본을 함께 담아 두세요.</p></header>
    <form onSubmit={submit} className="composer-paper" onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }} onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); addFiles([...e.dataTransfer.files]); } }}>
      <label className="sr-only" htmlFor="composer-title">제목</label>
      <input id="composer-title" className="composer-title" placeholder="제목" value={draft.title} maxLength={240} disabled={locked} onChange={e => change({ title: e.target.value })} autoComplete="off" />
      <label className="sr-only" htmlFor="composer-body">본문</label>
      <textarea id="composer-body" className="composer-body" placeholder="여기에 글을 쓰거나 붙여넣으세요.\n파일이나 링크만 담아도 괜찮아요." value={draft.body} maxLength={MAX_BODY_CHARS} disabled={locked} onChange={e => change({ body: e.target.value })} onPaste={e => {
        const value = e.clipboardData.getData('text/plain').trim();
        if (!draft.body && /^https?:\/\/\S+$/.test(value)) { e.preventDefault(); addLink(value); }
      }} />
      <div className="composer-attachments" aria-label="첨부 원본">
        {draft.files.map(file => <div className="composer-attachment" key={file.hash}><span className="composer-file-mark" aria-hidden="true">↗</span><div><strong>{file.name}</strong><small>{file.kind.toUpperCase()} · {(file.size / 1024 / 1024).toFixed(1)} MB · 원본 보관</small></div><button type="button" disabled={locked} aria-label={`${file.name} 첨부 취소`} onClick={() => change({ files: draft.files.filter(item => item.hash !== file.hash) })}>×</button></div>)}
        {draft.links.map(url => <div className="composer-attachment" key={url}><span className="composer-file-mark" aria-hidden="true">↗</span><div><strong>{new URL(url).hostname}</strong><small>{url}</small></div><button type="button" disabled={locked} aria-label={`${new URL(url).hostname} 링크 취소`} onClick={() => change({ links: draft.links.filter(item => item !== url) })}>×</button></div>)}
      </div>
      {linkOpen && <div className="composer-link-input"><label htmlFor="composer-link">담아 둘 링크</label><div><input ref={linkField} id="composer-link" type="url" placeholder="https://" value={linkInput} disabled={locked} onChange={e => setLinkInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } if (e.key === 'Escape') { setLinkOpen(false); setLinkInput(''); } }} /><button type="button" disabled={locked} onClick={() => addLink()}>추가</button></div></div>}
      <div className="composer-tools"><input ref={fileInput} className="sr-only" type="file" tabIndex={-1} accept=".pdf,.epub,application/pdf,application/epub+zip" multiple disabled={locked || preparing} onChange={e => { addFiles([...e.target.files]); e.target.value = ''; }} aria-label="첨부 파일 선택" />
        <button type="button" disabled={locked || preparing} onClick={() => fileInput.current?.click()}>＋ 파일</button><button type="button" disabled={locked} aria-expanded={linkOpen} onClick={() => setLinkOpen(value => !value)}>↗ 링크</button><small>{preparing ? '파일 확인 중…' : '끌어 놓아도 좋아요 · 파일당 50MB'}</small></div>
      <details className="composer-options"><summary>학습 정보 <span>선택</span></summary><label htmlFor="composer-language">이 자료로 공부할 언어</label><select id="composer-language" value={draft.language} disabled={locked} onChange={e => change({ language: e.target.value })}><option value="">나중에 정하기</option>{COMPOSER_LANGUAGES.map(language => <option key={language} value={language}>{langNameKo(language)}</option>)}</select><p>지금 지정하지 않아도 저장하고 읽을 수 있어요.</p></details>
      {notice && !error && <p className="composer-notice" role="status">{notice}</p>}
      {error && <div className="composer-error" role="alert">{error}{draft.frozen && <p>저장 결과가 확정될 때까지 내용을 유지합니다. 아래에서 다시 저장해 주세요.</p>}</div>}
      <footer className="composer-save"><span role="status">{busy ? stage : draftStatus}</span><button type="submit" className="manabi-button" disabled={busy || preparing}>{busy ? '저장 중…' : draft.frozen ? '다시 저장' : '저장'}</button></footer>
    </form>
    <div className="composer-after"><span>저장한 뒤 바로 읽을 수 있어요. 표현 학습은 읽는 화면에서 시작해요.</span><Link href="/materials/add?advanced=1">기존 책에 이어 붙이기·문장 목록 ↗</Link></div>
  </section>;
}
