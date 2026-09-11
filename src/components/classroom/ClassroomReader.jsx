'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '../../lib/supabase';
import {fetchTeamRoot,fetchBookChapters,chapterLabel} from '../../lib/classTeamQueries';
import {getTeam,dayLabel} from '../../lib/classBoard';
import {classroomEntries,classroomError} from '../../lib/classroomModel';
import {useClassroomSession} from '../../lib/useClassroomSession';
import {classStudyHref,studySelectionKey,findStudyEntry,buildStudySeed} from '../../lib/classStudy';
import './classroom-reader.css';
import TeachingPresentation from './TeachingPresentation';

export default function ClassroomReader({annotationContent,context,user,material,selection,wordContent,sentenceContent,fallback,onActive,suppressed,onPresenting}) {
  const root=useQuery({queryKey:['class-root',user?.id,context?.team],queryFn:()=>fetchTeamRoot(user.id,context.team),enabled:!!user?.id&&!!context});
  const team=getTeam(root.data?.processed_json?.metadata);
  const allowed=!!user&&root.data?.owner_id===user.id&&material?.owner_id===user.id&&!!team&&
    ((team.bookKey&&material.processed_json?.metadata?.book?.key===team.bookKey)||material.processed_json?.metadata?.team?.key===team.key);
  useEffect(()=>{onActive(allowed);return()=>onActive(false);},[allowed,onActive]);
  if(!allowed)return fallback;
  return <ClassReaderSession key={`${user.id}:${team.key}:${context.day}`} root={root.data} team={team} day={context.day} material={material} selection={selection} annotationContent={annotationContent} wordContent={wordContent} sentenceContent={sentenceContent} suppressed={suppressed} onPresenting={onPresenting}/>;
}

function ClassReaderSession({root,team,day,material,selection,annotationContent,wordContent,sentenceContent,suppressed,onPresenting}) {
  const router=useRouter();
  const [presentation,setPresentation]=useState(null),[coverageBusy,setCoverageBusy]=useState(false),[coverageMessage,setCoverageMessage]=useState('');
  const coverage=useQuery({queryKey:['class-coverage-day',root.id,day],queryFn:async()=>{const {data,error}=await supabase.from('class_teaching_coverage').select('material_ids').eq('root_id',root.id).eq('day',day).maybeSingle();if(error)throw error;return data?.material_ids||[];},retry:false});
  const isConfirmed=coverage.data?.includes(String(material.id));
  const closePresentation=useCallback(()=>setPresentation(null),[]);
  useEffect(()=>{onPresenting?.(!!presentation);return()=>onPresenting?.(false);},[presentation,onPresenting]);
  async function confirmChapter(){setCoverageBusy(true);setCoverageMessage('');try{const {error}=await supabase.rpc('confirm_class_chapter',{p_root:root.id,p_day:day,p_material:material.id,p_include:!isConfirmed});if(error)throw error;setCoverageMessage(isConfirmed?'오늘 수업 범위에서 뺐어요.':'오늘 함께 읽은 교재로 확인했어요.');await coverage.refetch();}catch{setCoverageMessage('확인하지 못했어요. 다시 시도해 주세요.');}finally{setCoverageBusy(false);}}
  const session=useClassroomSession({ownerId:root.owner_id,rootId:root.id,team:team.key,day});
  const {data:chapters=[]}=useQuery({queryKey:['class-book-chapters',root.owner_id,team.bookKey],queryFn:()=>fetchBookChapters(team.bookKey),enabled:!!team.bookKey});
  const [manual,setManual]=useState(false),[input,setInput]=useState(''),[draft,setDraft]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[lookupBusy,setLookupBusy]=useState(false),[toolsOpen,setToolsOpen]=useState(false),[collapsed,setCollapsed]=useState(false),[expanded,setExpanded]=useState(false);
  const dockRef=useRef(null),bodyRef=useRef(null),presentationOriginRef=useRef(null),showButtonRef=useRef(null);
  const [edits,setEdits]=useState({});const lookupAttempt=useRef(0),composition=useRef(false);
  const current=manual?draft:selection;
  const key=studySelectionKey(current),override=edits[key];
  // A new expression starts at its headword; showing/closing its presentation
  // or refreshing a meaning must not move the learner's place in this panel.
  useEffect(()=>{bodyRef.current?.scrollTo({top:0,behavior:'instant'});},[key]);
  const meaning=override?.meaning??current?.meaning??'',reading=override?.reading??current?.reading??'';
  const entries=useMemo(()=>classroomEntries(session.note),[session.note]);
  const existing=findStudyEntry(session.note,current);
  const queued=session.queue.find(row=>row.text===current?.text&&studySelectionKey({text:row.text,source:row.seed?.source})===key);
  const selectionKey=studySelectionKey(selection),previous=useRef(selectionKey);
  useEffect(()=>{if(previous.current!==selectionKey){previous.current=selectionKey;lookupAttempt.current++;setLookupBusy(false);setManual(false);setToolsOpen(false);setCollapsed(false);setMessage('');}},[selectionKey]);
  useEffect(()=>()=>{lookupAttempt.current++;},[]);
  useEffect(()=>{
    const reveal=()=>{
      if(!selection?.source?.tokenId||collapsed||!dockRef.current||getComputedStyle(dockRef.current).position!=='fixed')return;
      const element=document.querySelector(`[data-tid="${CSS.escape(selection.source.tokenId)}"]`);
      if(!element)return;
      const rect=element.getBoundingClientRect(),bottom=dockRef.current.getBoundingClientRect().top-20;
      const top=(document.querySelector('.viewer-topbar')?.getBoundingClientRect().bottom||80)+16;
      if(rect.bottom>bottom)window.scrollBy({top:rect.bottom-bottom,behavior:'instant'});
      else if(rect.top<top)window.scrollBy({top:rect.top-top,behavior:'instant'});
    };
    const frame=requestAnimationFrame(reveal);window.addEventListener('resize',reveal);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',reveal);};
  },[selectionKey,selection?.source?.tokenId,collapsed]);
  function edit(field,value){setEdits(prev=>({...prev,[key]:{meaning,reading,...prev[key],[field]:value}}));}
  async function lookup(event){
    event.preventDefault();if(composition.current||!input.trim())return;
    const attempt=++lookupAttempt.current,text=input.trim();setManual(true);setToolsOpen(false);setDraft({text,source:{kind:'manual'}});setLookupBusy(true);setMessage('');
    try{
      const {data,error}=await supabase.from('morpheme_dictionary').select('meanings,reading,pos').eq('language',team.lang).eq('base_form',text).maybeSingle();
      if(attempt!==lookupAttempt.current)return;
      if(error)throw error;
      const gloss=(data?.meanings||[]).map(m=>typeof m==='string'?m:m.meaning||m.definition||'').filter(Boolean).join(' · ');
      setDraft({text,meaning:gloss,reading:data?.reading||'',source:{kind:'manual'}});
      if(!gloss)setMessage('사전에 없는 표현이에요. 뜻을 직접 적어 추가할 수 있어요.');
    }catch{if(attempt===lookupAttempt.current)setMessage('사전을 불러오지 못했어요. 뜻을 직접 적어 추가할 수 있어요.');}
    finally{if(attempt===lookupAttempt.current)setLookupBusy(false);}
  }
  async function add(repeat=false){
    if(!current||busy||(existing&&!repeat)||queued)return;
    setBusy(true);setMessage('');
    try{await session.add(current.text,{...buildStudySeed(current,meaning,reading),...(repeat?{repeat:true}:{})});}
    catch(error){setMessage(classroomError(error));}finally{setBusy(false);}
  }
  const show=event=>{if(current){presentationOriginRef.current=event.currentTarget;setPresentation({text:current.text,reading,meaning});}};
  const classAction=(current?<section className="class-reader-add" aria-label="선택한 표현을 수업에 추가">
        {!manual&&<p className="class-reader-source">{chapters.find(ch=>String(ch.id)===String(material.id))?.order ? `${chapters.find(ch=>String(ch.id)===String(material.id)).order}과 · ` : ''}교재에서 선택한 표현</p>}
        {!current.source?.tokenId&&<div className="class-reader-picked"><strong lang={team.lang==='Chinese'?'zh':team.lang==='Japanese'?'ja':undefined}>{current.text}</strong><span>{manual?'직접 입력':'교재에서 선택'}</span></div>}
        {manual?<><label>읽기<input value={reading} onChange={e=>edit('reading',e.target.value)} maxLength={500}/></label><label>핵심 뜻<input value={meaning} onChange={e=>edit('meaning',e.target.value)} maxLength={500} placeholder="수업에서 사용할 뜻"/></label></>:<details><summary>수업용 뜻 확인·수정</summary><label>핵심 뜻<input value={meaning} onChange={e=>edit('meaning',e.target.value)} maxLength={500} placeholder="문장·표현의 뜻을 직접 적을 수 있어요"/></label></details>}
        <div className="class-reader-presentation-actions"><button ref={showButtonRef} onClick={show}>크게 보여주기</button>{manual&&<button disabled={busy||!!queued||!!existing} onClick={event=>{show(event);add();}}>보여주고 기록</button>}</div>
        <button className="class-reader-add__button" onClick={()=>add()} disabled={busy||!!existing||!!queued}>{queued?queued.status==='error'?'저장 확인 필요':'서버 저장 대기…':existing?'수업에 추가됨 ✓':busy?'기기에 보관 중…':'수업 노트에 추가 +'}</button>
        {existing&&!queued&&<button disabled={busy} onClick={()=>add(true)}>한 번 더 추가</button>}
        {queued?.status==='error'&&<button onClick={()=>session.retry(queued.id).catch(e=>setMessage(classroomError(e)))}>저장 재시도</button>}
      </section>:<p className="class-reader-hint">교재의 단어를 누르거나 표현을 드래그하세요. 이 자리에서 뜻을 보고 수업에 추가합니다.</p>);
  return <><aside ref={dockRef} className={`class-reader-dock${collapsed?' is-collapsed':''}${expanded?' is-expanded':''}`} hidden={suppressed} aria-label="교재 안 수업 도구" onMouseUp={e=>e.stopPropagation()}>
    <header className="class-reader-dock__header"><div><Link href={`/class/${team.key}/live?day=${day}`}>{team.name}</Link><small>{dayLabel(day)} · 수업</small></div><button className="class-reader-tools-toggle" aria-expanded={toolsOpen||!current} onClick={()=>{setCollapsed(false);setToolsOpen(v=>!v);}}>찾기</button><button aria-label={collapsed?'수업 도구 펼치기':'수업 도구 접기'} onClick={()=>setCollapsed(v=>!v)}>{collapsed?'펼치기':'접기'}</button><button className="class-reader-expand" aria-label={expanded?'패널 줄이기':'패널 펼치기'} onClick={()=>setExpanded(v=>!v)}>{expanded?'↙':'↗'}</button></header>
    <div ref={bodyRef} className="class-reader-dock__body" hidden={collapsed}>
      <div className="class-reader-tools" data-open={toolsOpen||!current}>
      {chapters.length>0&&<label className="class-reader-chapter">교재 <select aria-label="수업 교재 과 선택" value={chapters.some(ch=>String(ch.id)===String(material.id))?String(material.id):''} onChange={e=>{if(e.target.value)router.push(classStudyHref(e.target.value,team.key,day));}}><option value="" disabled>교재 선택</option>{chapters.map(ch=><option key={ch.id} value={String(ch.id)}>{ch.order}. {chapterLabel(ch.title)}</option>)}</select></label>}
      <form className="class-reader-search" onSubmit={lookup}><input aria-label="단어·표현 찾기" placeholder="단어·표현 찾기" value={input} maxLength={300} onChange={e=>{lookupAttempt.current++;setLookupBusy(false);setInput(e.target.value);}} onCompositionStart={()=>{composition.current=true;}} onCompositionEnd={()=>{composition.current=false;}}/><button disabled={lookupBusy||!input.trim()}>{lookupBusy?'조회 중':'찾기'}</button></form>
      {chapters.some(ch=>String(ch.id)===String(material.id))&&<div className="class-reader-coverage"><button disabled={coverageBusy||coverage.isLoading||!!coverage.error} onClick={confirmChapter}>{isConfirmed?'오늘 수업 범위 ✓ · 취소':'오늘 이 과를 함께 읽었어요 ✓'}</button>{coverage.error&&<button onClick={()=>coverage.refetch()}>수업 범위 다시 확인</button>}<p role="status">{coverageMessage}</p></div>}
      </div>
      {!manual&&wordContent&&<div className="class-reader-word">{wordContent(current?.source?.tokenId?classAction:null)}</div>}
      {(manual||!current?.source?.tokenId)&&classAction}
      {annotationContent}
      {(message||session.storeError||session.error)&&<p role="status" className="class-reader-message">{message||session.storeError||'수업 노트를 불러오지 못했어요.'}{session.error&&<button onClick={()=>session.refetch()}>다시 불러오기</button>}</p>}
      {!manual&&sentenceContent&&<details className="class-reader-sentence"><summary>문장 해설</summary>{sentenceContent}</details>}
      <section className="class-reader-notes" aria-label="오늘 수업 노트"><div><b>오늘 수업 노트</b><span>{entries.length}</span></div>
        <p role="status">{!session.online?'오프라인 · 입력은 이 기기에 보관됩니다':session.queue.length?`${session.queue.length}개 서버 저장 대기`:session.isLoading?'불러오는 중…':'서버 저장 확인됨'}{session.analysis.running?' · 뜻 준비 중':''}</p>
        {session.queue.map(row=><div key={row.id} className="class-reader-pending"><b>{row.text}</b><small>{row.status==='error'?row.error:'서버 저장 대기'}</small>{row.status==='error'&&<button onClick={()=>session.retry(row.id).catch(e=>setMessage(classroomError(e)))}>재시도</button>}</div>)}
        <ol>{entries.slice(-3).reverse().map(e=><li key={e.id}><b>{e.text}</b><span>{e.primary||'대표 뜻 없음'}</span></li>)}</ol>
        {entries.length>3&&<details><summary>전체 {entries.length}개 펼치기</summary><ol>{entries.slice(0,-3).reverse().map(e=><li key={e.id}><b>{e.text}</b><span>{e.primary||'대표 뜻 없음'}</span></li>)}</ol></details>}
        {session.analysis.error&&<p role="status">뜻을 준비하지 못했어요. <button onClick={session.reanalyze}>다시 찾기</button></p>}
      </section>
    </div>
  </aside>{presentation&&<TeachingPresentation entry={presentation} lang={team.lang} onClose={closePresentation} onRecord={()=>add()} originRef={presentationOriginRef} fallbackRef={showButtonRef} recordState={existing?'수업에 기록됨 ✓':queued?'서버 저장 대기':busy?'보관 중…':null}/>}</>;
}
