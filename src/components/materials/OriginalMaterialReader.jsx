'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { langNameKo } from '@/lib/constants';
import { COMPOSER_LANGUAGES, SOURCE_BUCKET, composerOf, normalizeSourceUrl, safeAssetPath } from '@/lib/materialComposer';
import { LibraryReturnLink } from '@/components/web/LibraryReaderLink';
import { safeLibraryReturn } from '@/lib/libraryReturn';
import './material-composer.css';
import './original-reader.css';

const PdfJsViewer = dynamic(() => import('@/components/PdfJsViewer'), { ssr: false, loading: () => <p role="status">PDF를 여는 중…</p> });

function OriginalFile({ material, asset }) {
  const key = `manabi-original-position:${material.owner_id}:${material.id}:${asset.hash}`;
  const [initialPosition, setInitialPosition] = useState(null);
  const [chapter, setChapter] = useState(0);
  const [positionWarning, setPositionWarning] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let position = 1;
    try { position = Math.max(1, Number(localStorage.getItem(key)) || 1); } catch { setPositionWarning(true); }
    setInitialPosition(position); setChapter(position - 1);
  }, [key]);
  const positionRef = useRef(null);
  positionRef.current = position => {
    try { localStorage.setItem(key, String(position)); } catch { setPositionWarning(true); }
  };
  const onPageChange = useRef(position => positionRef.current?.(position)).current;
  const original = useQuery({
    queryKey: ['composer-original', material.owner_id, material.id, asset.hash, retry],
    staleTime: 15 * 60 * 1000, gcTime: 20 * 60 * 1000, retry: 1, refetchOnWindowFocus: false,
    queryFn: async () => {
      const path = safeAssetPath(material, asset);
      if (!path) throw new Error('INVALID_ORIGINAL');
      const { data, error } = await supabase.storage.from(SOURCE_BUCKET).createSignedUrl(path, 1800);
      if (error || !data?.signedUrl) throw error || new Error('NO_ORIGINAL_URL');
      if (asset.kind === 'pdf') return { url: data.signedUrl };
      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error('ORIGINAL_UNAVAILABLE');
      const buffer = await response.arrayBuffer();
      try {
        const { parseEpub } = await import('@/lib/epub');
        return { url: data.signedUrl, book: await parseEpub(buffer) };
      } catch {
        return { url: data.signedUrl, unreadable: true };
      }
    },
  });
  const data = original.data;
  const chapters = data?.book?.chapters || [];
  const active = Math.min(chapter, Math.max(0, chapters.length - 1));
  return <section className="original-file" aria-label={`${asset.name} 원본`}>
    <header><div><span className="manabi-eyebrow">{asset.kind.toUpperCase()} / ORIGINAL</span><h2>{asset.name}</h2></div>{data?.url && <a href={data.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">원본 파일 열기 ↗</a>}</header>
    {original.isPending && <p className="original-state" role="status">원본을 불러오고 있어요…</p>}
    {original.isError && <div className="original-state" role="alert"><p>원본을 불러오지 못했어요. 글과 저장 기록은 그대로 남아 있습니다.</p><button onClick={() => setRetry(value => value + 1)}>다시 불러오기</button></div>}
    {data?.unreadable && <div className="original-state" role="status"><p>이 EPUB은 여기서 본문을 펼칠 수 없어요. 위의 ‘원본 파일 열기’로 내려받아 읽을 수 있습니다.</p><button onClick={() => setRetry(value => value + 1)}>다시 펼치기</button></div>}
    {data?.url && asset.kind === 'pdf' && initialPosition !== null && <div className="original-pdf"><PdfJsViewer key={retry} pdfUrl={data.url} initialPage={initialPosition} onPageChange={onPageChange} /></div>}
    {!!chapters.length && <><label className="original-chapter-label" htmlFor={`chapter-${asset.hash}`}>목차</label><select id={`chapter-${asset.hash}`} value={active} onChange={e => { const value = Number(e.target.value); setChapter(value); onPageChange(value + 1); }}>{chapters.map((item, index) => <option key={index} value={index}>{index + 1}. {item.title}</option>)}</select><article className="original-epub"><h3>{chapters[active].title}</h3><div>{chapters[active].text}</div></article><nav className="original-chapter-nav" aria-label="EPUB 장 이동"><button disabled={active === 0} onClick={() => { setChapter(active - 1); onPageChange(active); }}>← 이전 장</button><span>{active + 1} / {chapters.length}</span><button disabled={active === chapters.length - 1} onClick={() => { setChapter(active + 1); onPageChange(active + 2); }}>다음 장 →</button></nav></>}
    <footer>{positionWarning ? '이 브라우저에서는 읽던 위치를 보관할 수 없어요.' : '원본의 읽던 위치는 이 기기에 보관합니다.'}<span>{asset.kind === 'epub' ? '본문은 읽기 편한 텍스트로 표시됩니다.' : '원본을 그대로 표시합니다.'}</span></footer>
  </section>;
}

export default function OriginalMaterialReader({ material }) {
  const params = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const composer = composerOf(material);
  const [language, setLanguage] = useState(material.processed_json?.metadata?.language || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [assetIndex, setAssetIndex] = useState(0);
  const hasAnalysis = material.processed_json?.sequence?.length > 0 || ['completed', 'partial', 'analyzing'].includes(material.processed_json?.status);
  const assets = composer.assets || [];
  const links = (composer.links || []).flatMap(value => { try { return [normalizeSourceUrl(value)]; } catch { return []; } });
  const asset = assets[Math.min(assetIndex, Math.max(0, assets.length - 1))];
  async function studyBody() {
    if (busy || !COMPOSER_LANGUAGES.includes(language)) return;
    setBusy(true); setError('');
    try {
      // Compare the exact JSON version before changing learning metadata. A concurrent
      // analysis or source edit must not be overwritten by a stale reader screen.
      const json = material.processed_json;
      const next = { ...json, status: json.status === 'saved' ? 'pending' : json.status,
        metadata: { ...json.metadata, language: hasAnalysis ? json.metadata.language : language } };
      const { data, error: writeError } = await supabase.from('reading_materials').update({ processed_json: next })
        .eq('id', material.id).eq('owner_id', material.owner_id).eq('processed_json', JSON.stringify(json)).select('id');
      if (writeError || !data?.length) throw writeError || new Error('STALE_MATERIAL');
      await queryClient.invalidateQueries({ queryKey: ['material', String(material.id)] });
      const search = new URLSearchParams({ study: '1', returnTo: safeLibraryReturn(params.get('returnTo')) });
      router.push(`/viewer/${material.id}?${search}`);
    } catch { setError('학습 화면을 열지 못했어요. 자료를 새로 불러온 후 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }
  return <section className="original-reader" aria-labelledby="original-title"><div className="composer-top"><LibraryReturnLink /><span>MY LIBRARY / 나만 보기</span></div>
    <header className="original-heading"><p className="manabi-eyebrow">KEPT FOR ANOTHER DAY</p><h1 id="original-title">{material.title}</h1><p>{new Date(material.created_at).toLocaleDateString('ko-KR')}<span>내가 담아 둔 자료</span></p></header>
    {material.raw_text?.trim() && <article className="original-writing" aria-label="작성한 본문">{material.raw_text}</article>}
    {!!links.length && <section className="original-links" aria-label="담아 둔 링크">{links.map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><div><small>ORIGINAL LINK</small><strong>{new URL(url).hostname}</strong><span>{url}</span></div><b aria-hidden="true">↗</b></a>)}<p>링크의 원문은 해당 사이트에서 열립니다.</p></section>}
    {assets.length > 1 && <div className="original-file-picker"><label htmlFor="original-file-select">첨부 원본 {assets.length}개</label><select id="original-file-select" value={assetIndex} onChange={e => setAssetIndex(Number(e.target.value))}>{assets.map((item, index) => <option key={item.hash} value={index}>{item.name}</option>)}</select></div>}
    {asset && <OriginalFile key={asset.hash} material={material} asset={asset} />}
    {material.raw_text?.trim() && <details className="original-study"><summary>본문의 표현을 공부하고 싶다면</summary><p>학습할 언어를 고르면 기존 읽기·표현 저장 화면으로 이어집니다. 첨부 원본은 그대로 보관됩니다.</p><label htmlFor="original-language">학습 언어</label><select id="original-language" value={language} onChange={e => setLanguage(e.target.value)} disabled={busy || hasAnalysis}><option value="">언어 선택</option>{COMPOSER_LANGUAGES.map(value => <option key={value} value={value}>{langNameKo(value)}</option>)}</select><button className="manabi-button" disabled={busy || !language} onClick={studyBody}>{busy ? '여는 중…' : '본문 학습하기 ↗'}</button>{error && <p role="alert">{error}</p>}</details>}
    <footer className="original-bottom"><LibraryReturnLink /><Link href="/materials/add">새 자료 작성 ↗</Link></footer>
  </section>;
}
