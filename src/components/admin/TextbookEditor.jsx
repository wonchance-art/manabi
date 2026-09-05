'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/AuthContext';
import { CHAPTER_FIELD_LABELS, editableEntries, updateChapterValue } from '../../lib/chapterEditorModel';
import { TEXTBOOK_THEMES, textbookThemeStyle } from '../../lib/textbookTheme';
import './textbook.css';

const labelFor = (key) => CHAPTER_FIELD_LABELS[key] || key;

function TextField({ label, value, onChange }) {
  return <label className="textbook-editor__field"><span>{label}</span>
    <textarea aria-label={label} value={value} rows={value.length > 140 || value.includes('\n') ? 5 : 2}
      onChange={(event) => onChange(event.target.value)} />
  </label>;
}

// 배열 순서와 객체의 비편집 필드를 그대로 보존한다. JSON 입력 없이 중첩 대화·표도 편집.
function NodeFields({ value, path, onChange, label }) {
  if (typeof value === 'string') return <TextField label={label} value={value} onChange={(next) => onChange(path, next)} />;
  if (!value || typeof value !== 'object') return null;
  const entries = Array.isArray(value) ? value.map((item, index) => [index, item]) : editableEntries(value);
  return <fieldset className="textbook-editor__node"><legend>{label}</legend>
    {entries.map(([key, item]) => <NodeFields key={key} value={item} path={[...path, key]} onChange={onChange}
      label={Array.isArray(value) ? `${label} ${Number(key) + 1}` : labelFor(key)} />)}
    {Number.isInteger(value.answer) && Array.isArray(value.choices) && <label className="textbook-editor__field">
      <span>정답 선택지</span><select aria-label="정답 선택지" value={value.answer} onChange={(event) => onChange([...path, 'answer'], Number(event.target.value))}>
        {value.choices.map((choice, index) => <option key={index} value={index}>{index + 1}. {typeof choice === 'string' ? choice : '선택지'}</option>)}
      </select>
    </label>}
  </fieldset>;
}

function PreviewNode({ value }) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') return <p>{value}</p>;
  if (Array.isArray(value)) return <div>{value.map((item, index) => <PreviewNode key={index} value={item} />)}</div>;
  return <dl>{editableEntries(value).map(([key, item]) => <div key={key}>
    <dt>{labelFor(key)}</dt><dd><PreviewNode value={item} /></dd>
  </div>)}</dl>;
}

async function readChapter(lang, slug, signal) {
  const params = new URLSearchParams({ lang, slug });
  const response = await fetch(`/api/admin/chapter?${params}`, { cache: 'no-store', signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '교재를 불러오지 못했어요.');
  return result;
}

export default function TextbookEditor({ catalog, initialLang, initialSlug }) {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  const firstBook = catalog.find((book) => book.lang === initialLang) || catalog[0];
  const firstChapter = firstBook?.chapters.find((chapter) => chapter.slug === initialSlug) || firstBook?.chapters[0];
  const [selection, setSelection] = useState({ lang: firstBook?.lang || '', slug: firstChapter?.slug || '' });
  const [snapshot, setSnapshot] = useState(null);
  const [draft, setDraft] = useState(null);
  const [pending, setPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const savingRef = useRef(false);
  const book = catalog.find((item) => item.lang === selection.lang);
  const selectedChapter = book?.chapters.find((item) => item.slug === selection.slug);
  const dirty = !!snapshot && JSON.stringify(draft) !== JSON.stringify(snapshot.merged);

  useEffect(() => {
    if (!isAdmin || !selection.slug) return;
    const controller = new AbortController();
    setPending(true); setError(''); setNotice(''); setDraft(null); setSnapshot(null); setPreview(false);
    readChapter(selection.lang, selection.slug, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setSnapshot(result); setDraft(result.merged);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause.message);
    }).finally(() => { if (!controller.signal.aborted) setPending(false); });
    return () => controller.abort();
  }, [selection.lang, selection.slug, reload, isAdmin]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function mayLeave() { return !dirty || window.confirm('저장하지 않은 변경을 버리고 이동할까요?'); }
  function choose(lang, slug) {
    if (savingRef.current || !mayLeave()) return;
    setDraft(null); setSnapshot(null); setPending(true);
    setSelection({ lang, slug });
  }
  function update(path, value) {
    setDraft((current) => updateChapterValue(current, path, value));
    setNotice('');
  }

  async function save() {
    if (savingRef.current || !dirty || !snapshot) return;
    savingRef.current = true; setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/chapter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selection, data: draft, expectedUpdatedAt: snapshot.updatedAt }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '저장하지 못했어요.');
      setSnapshot({ ...snapshot, merged: draft, override: draft, updatedAt: result.updatedAt });
      setNotice('저장했어요. 교재 페이지에 수정 내용이 반영됩니다.');
      router.refresh();
    } catch (cause) {
      setError(cause.message || '연결이 끊겼어요. 입력한 내용은 유지됩니다.');
    } finally { savingRef.current = false; setSaving(false); }
  }

  if (authLoading) return <p className="page-container">관리자 권한 확인 중…</p>;
  if (!isAdmin) return <p className="page-container">관리자 계정으로 로그인해 주세요.</p>;
  if (!book) return <p className="page-container">편집할 교재가 없습니다.</p>;
  const levels = [...new Set(book.chapters.map((chapter) => chapter.level))];

  return <div className="page-container textbook-editor textbook-theme" style={textbookThemeStyle(selection.lang)}>
    <header className="textbook-editor__header"><div><h1>교재 편집</h1>
      <p className="textbook-editor__muted">언어와 레벨을 고르고 내용을 다듬어 주세요. 저장하면 교재에 바로 반영됩니다.</p></div>
      <Link href="/admin" onClick={(event) => { if (saving || !mayLeave()) event.preventDefault(); }}>관리자 홈</Link>
    </header>
    <fieldset className="textbook-editor__pickers" disabled={saving}>
      <label className="textbook-editor__field"><span>언어</span><select aria-label="언어" value={selection.lang} onChange={(event) => {
        const next = catalog.find((item) => item.lang === event.target.value); choose(next.lang, next.chapters[0]?.slug || '');
      }}>{catalog.map((item) => <option key={item.lang} value={item.lang}>{item.name}</option>)}</select></label>
      <label className="textbook-editor__field"><span>레벨</span><select aria-label="레벨" value={selectedChapter?.level || ''} onChange={(event) => {
        choose(selection.lang, book.chapters.find((item) => item.level === event.target.value).slug);
      }}>{levels.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
      <label className="textbook-editor__field"><span>챕터</span><select aria-label="챕터" value={selection.slug} onChange={(event) => choose(selection.lang, event.target.value)}>
        {book.chapters.filter((item) => item.level === selectedChapter?.level).map((item) => <option key={item.slug} value={item.slug}>{item.order}. {item.slug === selection.slug && draft ? draft.title : item.title}</option>)}
      </select></label>
    </fieldset>
    {pending && <p role="status">교재를 불러오는 중…</p>}
    {error && <div className="textbook-editor__message" role="alert"><p>{error}</p>
      <button className="btn btn--ghost btn--sm" type="button" disabled={saving} onClick={() => { if (mayLeave()) setReload((n) => n + 1); }}>최신 내용 다시 불러오기</button>
    </div>}
    {notice && <p className="textbook-editor__message" role="status">{notice}</p>}
    {draft && <>
      <div className="textbook-editor__actions"><p className="textbook-editor__muted">
        {book.name} · {draft.level} · {TEXTBOOK_THEMES[selection.lang].name} · {dirty ? '저장 전 변경 있음' : '저장된 내용'}
      </p><div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPreview((value) => !value)} aria-pressed={preview}>
          {preview ? '편집으로 돌아가기' : '내용 미리보기'}</button>
        <button type="button" className="btn btn--primary btn--sm" onClick={save} disabled={saving || !dirty}>{saving ? '저장 중…' : '변경 저장'}</button>
      </div></div>
      {preview ? <article className="textbook-editor__preview" aria-label="저장 전 내용 미리보기">
        <p>내용 확인용 · 실제 교재의 배치는 교재 페이지에서 확인하세요.</p>
        <h2>{draft.title}</h2><PreviewNode value={Object.fromEntries(editableEntries(draft).filter(([key]) => !['title', 'sections'].includes(key)))} />
        {draft.sections?.map((section, index) => <section key={index}><hr /><h3>{index + 1}. {section.heading || '학습 내용'}</h3>
          <PreviewNode value={Object.fromEntries(editableEntries(section).filter(([key]) => key !== 'heading'))} />
        </section>)}
      </article> : <fieldset disabled={saving} style={{ border: 0, minWidth: 0 }}>
        <section className="textbook-editor__section"><h2>챕터 안내</h2>
          {['title', 'topic', 'titleFr', 'summary', 'duration'].map((key) => <TextField key={key} label={labelFor(key)}
            value={draft[key] || ''} onChange={(value) => update([key], value)} />)}
        </section>
        {draft.sections?.map((section, index) => <details key={`${selection.slug}:${index}`} className="textbook-editor__section" open={index === 0}>
          <summary>{index + 1}. {section.heading || '학습 내용'}</summary>
          <NodeFields label="섹션 내용" value={section} path={['sections', index]} onChange={update} />
        </details>)}
        {['drills', 'writing'].filter((key) => draft[key]).map((key) => <details key={key} className="textbook-editor__section">
          <summary>{labelFor(key)}</summary><NodeFields value={draft[key]} path={[key]} label={labelFor(key)} onChange={update} />
        </details>)}
      </fieldset>}
      <div className="textbook-editor__actions"><Link prefetch={false} href={`${book.base}/grammar/${selection.slug}`} onClick={(event) => {
        if (saving || !mayLeave()) event.preventDefault();
      }}>교재 페이지에서 보기 →</Link><div>
        <button type="button" className="btn btn--ghost btn--sm" disabled={saving || !dirty} onClick={() => { if (mayLeave()) { setDraft(snapshot.merged); setError(''); } }}>변경 취소</button>
        <button type="button" className="btn btn--primary btn--sm" onClick={save} disabled={saving || !dirty}>{saving ? '저장 중…' : '변경 저장'}</button>
      </div></div>
    </>}
  </div>;
}
