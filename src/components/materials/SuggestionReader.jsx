'use client';

import { useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { langNameKo } from '@/lib/constants';
import { canReadSuggestion, createSuggestionSave, suggestionSource, suggestionSections } from '@/lib/suggestionReading';
import { saveComposerOnce } from '@/lib/materialComposer';
import { authEntryHref } from '@/lib/authRedirect';
import { attributionParts, licenseForSource } from '@/lib/videoAttribution';
import './suggestion-reader.css';

async function fetchSuggestion(id, signal) {
  const response = await fetch(`/api/suggestions/${encodeURIComponent(id)}`, { signal });
  if (!response.ok) throw Object.assign(new Error(response.status === 404 ? '추천 자료를 찾을 수 없어요.' : '자료를 불러오지 못했어요.'), { status: response.status });
  return response.json();
}

export default function SuggestionReader({ id }) {
  const params = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['suggestion-reading', id], queryFn: ({ signal }) => fetchSuggestion(id, signal), retry: false });
  const [fontSize, setFontSize] = useState(20);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [saveError, setSaveError] = useState('');
  const pending = useRef(false);
  const account = useRef(user?.id); account.current = user?.id;
  const s = query.data;
  const source = s ? suggestionSource(s) : null;
  const license = source?.kind === 'video' ? attributionParts({ kind: 'youtube', channel: s.channel_name, url: source.url, license: licenseForSource(s.source) })?.license : '';
  const readable = canReadSuggestion(s);
  const back = params.get('from') === 'home' ? '/home' : '/materials';
  const backLabel = back === '/home' ? '← 오늘로' : '← 내 서재로';
  const savedId = saved?.ownerId === user?.id ? saved?.id : null;
  const studyId = savedId || s?.material_id;
  async function keep() {
    if (!user || pending.current) return;
    const ownerId = user.id;
    pending.current = true; setSaving(true); setSaveError('');
    try {
      const save = await createSuggestionSave(ownerId, s);
      if (account.current !== ownerId) return;
      const record = await saveComposerOnce(supabase, save);
      if (account.current !== ownerId) return;
      setSaved({ ownerId, id: record.id });
      queryClient.invalidateQueries({ queryKey: ['personal-library', ownerId] });
    } catch {
      if (account.current === ownerId) setSaveError('서재에 담지 못했어요. 다시 누르면 저장 여부를 확인하므로 중복으로 담기지 않아요.');
    } finally { pending.current = false; setSaving(false); }
  }

  return <section className="suggestion-reader" aria-labelledby="suggestion-title" data-language={s?.language}>
    <nav className="suggestion-reader__toolbar" aria-label="읽기 도구"><Link href={back}>{backLabel}</Link>
      {readable && <div className="suggestion-reader__type" role="group" aria-label="글자 크기">
        <button type="button" aria-label="글자 작게" disabled={fontSize <= 18} onClick={() => setFontSize(n => Math.max(18, n - 2))}>A−</button>
        <button type="button" aria-label="글자 크게" disabled={fontSize >= 28} onClick={() => setFontSize(n => Math.min(28, n + 2))}>A+</button>
      </div>}
    </nav>
    {query.isPending ? <p role="status">읽을거리를 펼치고 있어요…</p> : query.isError ? <div className="suggestion-reader__state" role="alert"><h1 id="suggestion-title">{query.error.message}</h1><p>저장된 주소를 다시 확인하거나 추천 목록으로 돌아가 주세요.</p>{query.error.status !== 404 && <button className="btn" onClick={() => query.refetch()}>다시 불러오기</button>}</div> : <>
      <header className="suggestion-reader__heading"><p className="manabi-eyebrow">MANABI / READINGS</p>
        <div className="suggestion-reader__meta"><span>{langNameKo(s.language)}</span>{s.level && <span>{s.level}</span>}<span>{source.kind === 'digest' ? '뉴스 브리핑' : source.kind === 'video' ? (readable ? '영상 자막' : '추천 영상') : '기사 발췌'}</span></div>
        <h1 id="suggestion-title">{s.title}</h1>
        <p className="suggestion-reader__byline">{s.channel_name}{license && <span>{license}</span>}{s.date && <span>자료 수집 {s.date.replaceAll('-', '.')}</span>}</p>
        <div className="suggestion-reader__actions">
          {readable && s.transcript?.trim() && (authLoading ? <span role="status">서재 확인 중…</span> : !user ? <Link className="manabi-link" href={authEntryHref(`/suggestions/${id}?from=${back === '/home' ? 'home' : 'materials'}`)}>로그인하고 서재에 담기</Link> : <button className="btn btn--sm" onClick={keep} disabled={saving || !!savedId}>{savedId ? '✓ 서재에 담았어요' : saving ? '담는 중…' : '내 서재에 담기'}</button>)}
          {studyId && <Link className="manabi-link" href={`/viewer/${studyId}?study=1`}>단어 학습 ↗</Link>}
          {source.url && <a className="manabi-link" href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a>}
        </div>
        {savedId && <p className="suggestion-reader__notice" role="status">나만 볼 수 있게 보관했어요. 단어 학습에서 뜻을 확인하고 표현을 담을 수 있어요.</p>}
        {saveError && <p role="alert" className="suggestion-reader__notice">{saveError}</p>}
      </header>
      {s.transcript?.trim() && readable ? <article className="suggestion-reader__body" style={{ fontSize }} lang={{ Japanese: 'ja', Chinese: 'zh', English: 'en', French: 'fr' }[s.language]}>
        {suggestionSections(s).map((part, index) => <section key={index}>{part.heading && <h2>{part.heading}</h2>}{part.text && <p>{part.text}</p>}</section>)}
      </article> : <p className="suggestion-reader__state">{studyId ? '준비된 본문은 단어 학습 뷰어에서 바로 읽을 수 있어요.' : source.kind === 'video' ? '이 영상은 원본에서 바로 시청할 수 있어요.' : '현재 읽을 수 있는 본문이 없어요. 다른 추천 글을 열어 주세요.'}</p>}
      <footer className="suggestion-reader__footer"><p>{source.kind === 'digest' ? 'NHK가 제공한 뉴스 제목과 소개를 묶은 브리핑입니다.' : source.kind === 'video' ? '영상의 제목·채널·원본 출처를 함께 보존합니다.' : '수집된 기사 발췌를 읽고 있어요. 전체 기사와 최신 내용은 원문에서 확인하세요.'}</p>
        {source.url && <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a>}
        <Link href={back}>{backLabel}</Link>
      </footer>
    </>}
  </section>;
}
