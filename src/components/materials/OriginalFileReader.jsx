'use client';
import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import {supabase} from '@/lib/supabase';
import {SOURCE_BUCKET,safeAssetPath} from '@/lib/materialComposer';
import {materialActivity,originalPositionKey} from '@/lib/libraryActivity';
import useLibraryActivity from '@/components/library/useLibraryActivity';
import useOriginalTextPosition from './useOriginalTextPosition';

const PdfJsViewer=dynamic(()=>import('@/components/PdfJsViewer'),{ssr:false,loading:()=> <p role="status">PDF를 여는 중…</p>});

export default function OriginalFileReader({ material, asset, onSource, returnSource, sourceMaterial, initialLocator, restoreId, onPosition, canRecord }) {
  const key = originalPositionKey(material.owner_id,material.id,asset.hash);
  const readingSource={kind:asset.kind,assetHash:asset.hash};
  const initial=useRef(initialLocator);
  const sourcePosition=useRef(null),pageTransitionUntil=useRef(0);
  const [rendered,setRendered]=useState(false);
  const originalElement=useRef(null);
  const epubElement=useRef(null);
  const [jumpApplied,setJumpApplied]=useState(false);
  const pageSources=useRef(new Map()),currentPage=useRef(returnSource?.page||1);
  const sourceRef=useRef(null);
  sourceRef.current=(page,element)=>{
    pageSources.current.set(page,{key:`${asset.hash}:${page}`,element,title:asset.name,source:{version:1,kind:'pdf',assetHash:asset.hash,page,textVersion:'pdf-layer-v1'}});
    for(const [key,item] of pageSources.current)if(!item.element.isConnected)pageSources.current.delete(key);
    const active=pageSources.current.get(currentPage.current);
    if(active)onSource({...active,siblings:[...pageSources.current.values()]});
  };
  const onPageSource=useRef((page,element)=>sourceRef.current(page,element)).current;
  useEffect(()=>()=>onSource(null),[onSource]);
  const readyRef=useRef(()=>setRendered(true));
  const [initialPosition, setInitialPosition] = useState(null);
  const [chapter, setChapter] = useState(0);
  const [positionWarning, setPositionWarning] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let position = 1;
    try { position = Math.max(1, Number(localStorage.getItem(key)) || 1); } catch { setPositionWarning(true); }
    if(initial.current)position=initial.current.page||initial.current.chapter||position;
    if (returnSource?.kind === 'pdf') position=returnSource.page;
    setInitialPosition(position); setChapter(position - 1);
  }, [key,returnSource]);
  const positionRef = useRef(null);
  positionRef.current = position => {
    if(asset.kind==='pdf'){currentPage.current=position;pageTransitionUntil.current=performance.now()+600;onSource(null);}
    try { localStorage.setItem(key, String(position)); } catch { setPositionWarning(true); }
    if(asset.kind==='pdf'){
      const bounds=originalElement.current?.getBoundingClientRect();
      if(bounds&&bounds.top<innerHeight&&bounds.bottom>104)onPosition(readingSource,{page:position},canRecord());
    }
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
  const target=returnSource?.kind==='epub'?returnSource:initial.current;
  const targetChapter=target?.spinePath?chapters.findIndex(item=>item.spinePath===target.spinePath&&item.spineIndex===target.spineIndex):-1;
  const active = !jumpApplied&&targetChapter>=0?targetChapter:Math.min(chapter, Math.max(0, chapters.length - 1));
  const currentChapter=chapters[active];
  sourcePosition.current=currentChapter?{chapter:active+1,spinePath:currentChapter.spinePath,spineIndex:currentChapter.spineIndex}:null;
  const textRestore=useRef(initial.current&&asset.kind==='epub'&&!returnSource?{id:restoreId,offset:initial.current.offset||0}:null);
  useOriginalTextPosition({element:epubElement,source:readingSource,base:sourcePosition.current,enabled:!!currentChapter,onPosition,canRecord,restore:textRestore.current});
  function navigateChapter(value){
    const item=chapters[value];if(!item)return;
    setJumpApplied(true);setChapter(value);onPageChange(value+1);
    onPosition(readingSource,{chapter:value+1,spinePath:item.spinePath,spineIndex:item.spineIndex,offset:0});
  }
  function visiblePdfPage(event){
    const container=event.target;if(asset.kind!=='pdf'||!container.classList.contains('pdfjs-pages')||!canRecord()||performance.now()<pageTransitionUntil.current)return;
    const bounds=container.getBoundingClientRect();let best=null;
    for(const page of container.querySelectorAll('[data-page-number]')){const box=page.getBoundingClientRect();if(box.bottom>bounds.top+16&&box.top<bounds.bottom){best=Number(page.dataset.pageNumber);break;}}
    if(best){try{localStorage.setItem(key,String(best));}catch{setPositionWarning(true);}onPosition(readingSource,{page:best});}
  }
  useEffect(()=>{
    if(currentChapter&&epubElement.current){
      positionRef.current?.(active+1);
      const bounds=originalElement.current?.getBoundingClientRect();
      if(canRecord()&&bounds&&bounds.top<innerHeight&&bounds.bottom>104)onPosition({kind:asset.kind,assetHash:asset.hash},{chapter:active+1,spinePath:currentChapter.spinePath,spineIndex:currentChapter.spineIndex,offset:!jumpApplied?(initial.current?.offset||0):0});
      onSource({key:`${asset.hash}:${currentChapter.spineIndex}`,element:epubElement.current,title:asset.name,
      source:{version:1,kind:'epub',assetHash:asset.hash,chapter:active+1,spinePath:currentChapter.spinePath,spineIndex:currentChapter.spineIndex,textVersion:'epub-text-v1'}});
    }
  },[active,currentChapter,asset.hash,asset.name,asset.kind,onSource,onPosition,canRecord,jumpApplied]);
  useLibraryActivity(sourceMaterial?materialActivity(sourceMaterial,'original'):materialActivity(material,'original',asset.hash),rendered||chapters.length>0,originalElement);
  return <section ref={originalElement} className="original-file" onScrollCapture={visiblePdfPage} onWheelCapture={()=>{pageTransitionUntil.current=0;}} onTouchMoveCapture={()=>{pageTransitionUntil.current=0;}} aria-label={`${asset.name} 원본`}>
    <header><div><span className="manabi-eyebrow">{asset.kind.toUpperCase()} / ORIGINAL</span><h2>{asset.name}</h2></div>{data?.url && <a href={data.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">원본 파일 열기 ↗</a>}</header>
    {original.isPending && <p className="original-state" role="status">원본을 불러오고 있어요…</p>}
    {original.isError && <div className="original-state" role="alert"><p>원본을 불러오지 못했어요. 글과 저장 기록은 그대로 남아 있습니다.</p><button onClick={() => setRetry(value => value + 1)}>다시 불러오기</button></div>}
    {data?.unreadable && <div className="original-state" role="status"><p>이 EPUB은 여기서 본문을 펼칠 수 없어요. 위의 ‘원본 파일 열기’로 내려받아 읽을 수 있습니다.</p><button onClick={() => setRetry(value => value + 1)}>다시 펼치기</button></div>}
    {data?.url && asset.kind === 'pdf' && initialPosition !== null && <div className="original-pdf"><PdfJsViewer key={retry} pdfUrl={data.url} initialPage={initialPosition} onPageChange={onPageChange} onReady={readyRef.current} onPageSource={onPageSource} /></div>}
    {!!chapters.length && <><label className="original-chapter-label" htmlFor={`chapter-${asset.hash}`}>목차</label><select id={`chapter-${asset.hash}`} value={active} onChange={e=>navigateChapter(Number(e.target.value))}>{chapters.map((item, index) => <option key={index} value={index}>{index + 1}. {item.title}</option>)}</select><article className="original-epub"><h3>{chapters[active].title}</h3><div ref={epubElement}>{chapters[active].text}</div></article><nav className="original-chapter-nav" aria-label="EPUB 장 이동"><button disabled={active === 0} onClick={()=>navigateChapter(active-1)}>← 이전 장</button><span>{active + 1} / {chapters.length}</span><button disabled={active === chapters.length - 1} onClick={()=>navigateChapter(active+1)}>다음 장 →</button></nav></>}
    <footer>{positionWarning ? '이 브라우저에서는 읽던 위치를 보관할 수 없어요.' : '읽던 쪽과 장은 계정의 위치 기록과 연결됩니다.'}<span>{asset.kind === 'epub' ? '본문은 읽기 편한 텍스트로 표시됩니다.' : '원본을 그대로 표시합니다.'}</span></footer>
  </section>;
}
