'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { langNameKo } from '@/lib/constants';
import { COMPOSER_LANGUAGES, normalizeSourceUrl } from '@/lib/materialComposer';
import { documentOf, documentError, openDocumentStudy } from '@/lib/materialDocument';
import { LibraryReturnLink } from '@/components/web/LibraryReaderLink';
import { safeLibraryReturn } from '@/lib/libraryReturn';
import './material-composer.css';
import './original-reader.css';
import {materialActivity} from '@/lib/libraryActivity';
import useLibraryActivity from '@/components/library/useLibraryActivity';
import PassageStudy from './PassageStudy';
import PassageSources, { PassageSourceFocus } from './PassageSources';
import { passageOf } from '@/lib/sourcePassage';
import { composerOf } from '@/lib/materialComposer';

import OriginalFileReader from './OriginalFileReader';
import useOriginalReadingPosition from './useOriginalReadingPosition';
import OriginalPositionNotice from './OriginalPositionNotice';
import useOriginalTextPosition from './useOriginalTextPosition';
import {originalPositionSources,positionSourceKey} from '@/lib/originalReadingPosition';


export default function OriginalMaterialReader({ material }) {
  const params = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const composer = useMemo(()=>documentOf(material),[material]);
  const bodyElement=useRef(null);
  const [bodySource,setBodySource]=useState(null),[fileSource,setFileSource]=useState(null);
  const onFileSource=useCallback(value=>setFileSource(value),[]);
  const passageId=/^[1-9][0-9]{0,18}$/.test(params.get('passage')||'')?params.get('passage'):null;
  const origin=useQuery({queryKey:['passage-origin',material.owner_id,passageId],enabled:!!passageId,
    queryFn:async()=>{const {data,error}=await supabase.from('reading_materials').select('*').eq('id',passageId).eq('owner_id',material.owner_id).maybeSingle();
      if(error)throw error;
      if(!passageOf(data)||composerOf(data)?.parentId!==String(material.id))throw new Error('PASSAGE_ACCESS');
      return data;}});
  const returnSource=passageOf(origin.data);

  const [language, setLanguage] = useState(composer.language || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [assetIndex, setAssetIndex] = useState(()=>Math.max(0,(composer.assets||[]).findIndex(item=>item.hash===params.get('asset'))));
  useLibraryActivity(materialActivity(material,'original',null,composer.revision),!!composer.body?.trim()||!!composer.links?.length);
  const assets = useMemo(()=>{
    const current=composer.assets||[];
    const retained=(composer.retainedAssets||[]).find(item=>item.hash===returnSource?.assetHash);
    return retained&&!current.some(item=>item.hash===retained.hash)?[...current,retained]:current;
  },[composer.assets,composer.retainedAssets,returnSource?.assetHash]);
  useEffect(()=>{if(returnSource?.assetHash){const index=assets.findIndex(item=>item.hash===returnSource.assetHash);if(index>=0)setAssetIndex(index);}},[assets,returnSource?.assetHash]);
  const positionSources=useMemo(()=>originalPositionSources(material,returnSource?.assetHash),[material,returnSource?.assetHash]);
  const sync=useOriginalReadingPosition(material,positionSources,!passageId||!origin.isPending);
  const [restore,setRestore]=useState({id:0,point:null});
  const booted=useRef(false),gesture=useRef(-Infinity),paused=useRef(0);
  const canRecord=useCallback(()=>performance.now()>paused.current&&performance.now()-gesture.current<3000,[]);
  const markGesture=()=>{gesture.current=performance.now();paused.current=0;};
  function applyPosition(point){
    if(!point)return;
    paused.current=performance.now()+700;
    if(point.source.assetHash){const index=assets.findIndex(a=>a.hash===point.source.assetHash);if(index>=0)setAssetIndex(index);}
    sync.note(point.source,point.locator,false);
    setRestore(previous=>({id:previous.id+1,point}));
  }
  useEffect(()=>{
    if(!sync.state.ready||booted.current||origin.isPending&&passageId)return;
    booted.current=true;
    if(passageId)return;
    const requested=params.get('asset');
    const point=params.get('resume')==='1'?(sync.selected()||sync.selected(requested?`asset:${requested}`:null)):sync.selected(requested?`asset:${requested}`:null);
    if(point)applyPosition(point);
    else if(composer.body?.trim())sync.note({kind:'body',revision:composer.revision||null},{offset:0},false);
    // Apply once at entry; later remote updates are offered by the notice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sync.state.ready,origin.isPending,passageId]);
  useEffect(()=>{setBodySource(bodyElement.current?{key:`body:${composer.revision||'original'}`,element:bodyElement.current,
    source:{version:1,kind:'body',revision:composer.revision,textVersion:'plain-v1'}}:null);},[composer.body,composer.revision,sync.state.ready]);
  const bodyPositionSource={kind:'body',revision:composer.revision||null};
  const bodyRestore=useMemo(()=>restore.point?.source.kind==='body'?{id:restore.id,offset:restore.point.locator.offset}:null,[restore]);
  useOriginalTextPosition({element:bodyElement,source:bodyPositionSource,base:{},enabled:sync.state.ready,onPosition:sync.note,canRecord,restore:bodyRestore});
  const links = (composer.links || []).flatMap(value => { try { return [normalizeSourceUrl(value)]; } catch { return []; } });
  const asset = assets[Math.min(assetIndex, Math.max(0, assets.length - 1))];
  const sources=useMemo(()=>[bodySource,...(fileSource?.source?.assetHash===asset?.hash?(fileSource?.siblings||[fileSource]):[])].filter(Boolean),[bodySource,fileSource,asset?.hash]);
  const preferredKey=fileSource?.source?.assetHash===asset?.hash?fileSource?.key:bodySource?.key;
  async function studyBody() {
    if (busy || !COMPOSER_LANGUAGES.includes(language)) return;
    setBusy(true); setError('');
    try {
      const record = await openDocumentStudy(supabase, material, language);
      await queryClient.invalidateQueries({ queryKey: ['material', String(record.id)] });
      const search = new URLSearchParams({ study: '1', returnTo: safeLibraryReturn(params.get('returnTo')) });
      router.push(`/viewer/${record.id}?${search}`);
    } catch (err) { setError(documentError(err) || '학습 화면을 열지 못했어요. 자료를 새로 불러온 후 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }
  return <section className="original-reader" onPointerDownCapture={markGesture} onWheelCapture={markGesture} onKeyDownCapture={markGesture} aria-labelledby="original-title"><div className="composer-top"><LibraryReturnLink /><Link href={`/materials/${material.id}/edit?returnTo=${encodeURIComponent(safeLibraryReturn(params.get('returnTo')))}`}>수정</Link></div>
    <header className="original-heading"><p className="manabi-eyebrow">KEPT FOR ANOTHER DAY</p><h1 id="original-title">{material.title}</h1><p>{new Date(material.created_at).toLocaleDateString('ko-KR')}<span>내가 담아 둔 자료</span></p></header>
    <OriginalPositionNotice sync={sync} sources={positionSources} onAccept={()=>applyPosition(sync.accept())}/>
    {passageId&&origin.isPending&&<p role="status">학습 구간의 출처를 확인하는 중…</p>}
    {passageId&&origin.isError&&<p role="alert">해당 구간의 출처를 열 수 없어요. 현재 자료는 그대로 읽을 수 있습니다.</p>}
    {origin.data&&<PassageSourceFocus material={origin.data} sources={sources}/>}
    <PassageStudy material={material} sources={sources} preferredKey={preferredKey}/>
    {sync.state.ready&&composer.body?.trim() && <article ref={bodyElement} className="original-writing" aria-label="작성한 본문">{composer.body}</article>}
    {!!links.length && <section className="original-links" aria-label="담아 둔 링크">{links.map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><div><small>ORIGINAL LINK</small><strong>{new URL(url).hostname}</strong><span>{url}</span></div><b aria-hidden="true">↗</b></a>)}<p>링크의 원문은 해당 사이트에서 열립니다.</p></section>}
    {assets.length > 1 && <div className="original-file-picker"><label htmlFor="original-file-select">첨부 원본 {assets.length}개</label><select id="original-file-select" value={assetIndex} onChange={e=>{const index=Number(e.target.value);setAssetIndex(index);const selected=assets[index],point=sync.selected(`asset:${selected.hash}`);if(point)sync.note(point.source,point.locator);applyPosition(point);}}>{assets.map((item, index) => <option key={item.hash} value={index}>{item.name}</option>)}</select></div>}
    {asset && sync.state.ready && (!passageId||!origin.isPending) && <OriginalFileReader key={`${asset.hash}:${passageId||''}:${restore.id}`} material={material} asset={asset} onSource={onFileSource} returnSource={returnSource?.assetHash===asset.hash?returnSource:null} sourceMaterial={returnSource?.assetHash===asset.hash?origin.data:null} initialLocator={!passageId?sync.selected(positionSourceKey({kind:asset.kind,assetHash:asset.hash}))?.locator:null} restoreId={restore.id} onPosition={sync.note} canRecord={canRecord} />}
    <PassageSources material={material}/>
    {composer.body?.trim() && <details className="original-study"><summary>자료 도구 · 본문 전체 학습</summary><p>학습할 언어를 고르면 읽기·표현 저장 화면으로 이어집니다. 수정한 본문으로 공부해도 이전 표현의 출처는 남아 있습니다.</p><label htmlFor="original-language">학습 언어</label><select id="original-language" value={language} onChange={e => setLanguage(e.target.value)} disabled={busy}><option value="">언어 선택</option>{COMPOSER_LANGUAGES.map(value => <option key={value} value={value}>{langNameKo(value)}</option>)}</select><button className="manabi-button" disabled={busy || !language} onClick={studyBody}>{busy ? '여는 중…' : '본문 학습하기 ↗'}</button>{error && <p role="alert">{error}</p>}</details>}
    <footer className="original-bottom"><LibraryReturnLink /><Link href="/materials/add">새 자료 작성 ↗</Link></footer>
  </section>;
}
