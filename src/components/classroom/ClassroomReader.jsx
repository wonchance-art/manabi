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
import {useClassReaderDrafts} from '../../lib/useClassReaderDrafts';
import {readerDraftScope,readerDraftContext,classroomSaveLabel,isClassComposing} from '../../lib/classReaderDraft';
import {resolveClassSource} from '../../lib/classSource';
import {useClassSelectionVisibility} from '../../lib/useReaderLayout';

export default function ClassroomReader({annotationContent,context,user,material,selection,selectionSignal,wordContent,sentenceContent,fallback,onActive,suppressed,onPresenting}) {
  const root=useQuery({queryKey:['class-root',user?.id,context?.team],queryFn:()=>fetchTeamRoot(user.id,context.team),enabled:!!user?.id&&!!context});
  const team=getTeam(root.data?.processed_json?.metadata);
  const allowed=!!user&&root.data?.owner_id===user.id&&material?.owner_id===user.id&&!!team&&
    ((team.bookKey&&material.processed_json?.metadata?.book?.key===team.bookKey)||material.processed_json?.metadata?.team?.key===team.key);
  useEffect(()=>{onActive(allowed);return()=>onActive(false);},[allowed,onActive]);
  if(!allowed)return fallback;
  return <ClassReaderSession key={`${user.id}:${team.key}:${context.day}:${material.id}`} root={root.data} team={team} day={context.day} material={material} selection={selection} selectionSignal={selectionSignal} annotationContent={annotationContent} wordContent={wordContent} sentenceContent={sentenceContent} suppressed={suppressed} onPresenting={onPresenting}/>;
}

function ClassReaderSession({root,team,day,material,selection,selectionSignal,annotationContent,wordContent,sentenceContent,suppressed,onPresenting}) {
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
  const drafts=useClassReaderDrafts(readerDraftScope(root.owner_id,team.key,day,material.id));
  const [edits,setEdits]=useState({});const lookupAttempt=useRef(0),composition=useRef(false),blockedEnter=useRef(false);
  const editVersion=useRef(0),draftVersion=useRef(0),searchRef=useRef(null);
  const current=manual?draft:selection;
  const key=studySelectionKey(current),savedDraft=drafts.rows.find(row=>row.context===readerDraftContext(current));
  const override=edits[key]||(!manual&&savedDraft?.value.selection?savedDraft.value:null);
  const isManual=current?.source?.kind==='manual';
  const sourceValid=useMemo(()=>!current||isManual||!!resolveClassSource(material.processed_json,current.source),[current,isManual,material.processed_json]);
  const target=useMemo(()=>selection?.source&&resolveClassSource(material.processed_json,selection.source),[selection,material.processed_json]);
  useClassSelectionVisibility(dockRef,bodyRef,manual?null:target?.first,manual?null:target?.last,selectionKeyFor(selection),!collapsed&&!suppressed);
  // A new expression starts at its headword; showing/closing its presentation
  // or refreshing a meaning must not move the learner's place in this panel.
  useEffect(()=>{bodyRef.current?.scrollTo({top:0,behavior:'instant'});},[key]);
  const meaning=override?.meaning??current?.meaning??'',reading=override?.reading??current?.reading??'';
  const entries=useMemo(()=>classroomEntries(session.note),[session.note]);
  const existing=findStudyEntry(session.note,current);
  const queued=session.queue.find(row=>row.text===current?.text&&studySelectionKey({text:row.text,source:row.seed?.source})===key);
  // The viewer's explicit open signal also covers tapping the same word again.
  // Dictionary refreshes may change selection objects without a new learner action.
  const selectionKey=studySelectionKey(selection),previous=useRef({key:selectionKey,signal:selectionSignal});
  useEffect(()=>{if(previous.current.key!==selectionKey||previous.current.signal!==selectionSignal){previous.current={key:selectionKey,signal:selectionSignal};lookupAttempt.current++;draftVersion.current++;setLookupBusy(false);setManual(false);setToolsOpen(false);setCollapsed(false);setMessage('');}},[selectionKey,selectionSignal]);
  useEffect(()=>()=>{lookupAttempt.current++;},[]);
  function persist(next, nextMeaning=meaning, nextReading=reading, nextInput=input){
    return drafts.save({input:nextInput,selection:next,meaning:nextMeaning,reading:nextReading});
  }
  function edit(field,value){
    editVersion.current++;draftVersion.current++;
    const next={meaning,reading,...edits[key],[field]:value};
    setEdits(prev=>({...prev,[key]:next}));persist(current,next.meaning,next.reading);
  }
  function changeInput(value){
    lookupAttempt.current++;draftVersion.current++;setLookupBusy(false);setInput(value);setManual(true);setDraft(null);setMessage('');
    if(value)persist(null,'','',value);else drafts.consume(drafts.snapshot('manual')).catch(()=>setMessage('초안을 비우지 못했어요. 다시 시도해 주세요.'));
  }
  function restoreDraft(row){
    lookupAttempt.current++;draftVersion.current++;setLookupBusy(false);setToolsOpen(true);setManual(true);setInput(row.value.input);setDraft(row.value.selection);
    if(row.value.selection)setEdits(prev=>({...prev,[studySelectionKey(row.value.selection)]:{meaning:row.value.meaning,reading:row.value.reading}}));
    setCollapsed(false);setMessage('이 기기에 보관한 초안을 열었어요. 기록 버튼을 눌러야 수업에 추가됩니다.');
  }
  async function clearDraft(row){
    const version=draftVersion.current;
    try{await drafts.consume(row);if(version===draftVersion.current&&row.context===readerDraftContext(current)){setInput('');setDraft(null);setManual(false);setEdits(prev=>{const next={...prev};delete next[key];return next;});}}catch{setMessage('초안을 비우지 못했어요. 다시 시도해 주세요.');}
  }
  async function lookup(event){
    event.preventDefault();if(isClassComposing(event,composition.current)||blockedEnter.current||!input.trim()||!drafts.ready)return;
    const attempt=++lookupAttempt.current,text=input.trim(),editAtStart=editVersion.current;setManual(true);setToolsOpen(false);setDraft({text,source:{kind:'manual'}});setLookupBusy(true);setMessage('');persist({text,source:{kind:'manual'}},'','',text);
    try{
      const {data,error}=await supabase.from('morpheme_dictionary').select('meanings,reading,pos').eq('language',team.lang).eq('base_form',text).maybeSingle();
      if(attempt!==lookupAttempt.current)return;
      if(error)throw error;
      const gloss=(data?.meanings||[]).map(m=>typeof m==='string'?m:m.meaning||m.definition||'').filter(Boolean).join(' · ');
      if(editVersion.current!==editAtStart)return;
      const next={text,meaning:gloss,reading:data?.reading||'',source:{kind:'manual'}};setDraft(next);
      setEdits(prev=>{const updated={...prev};delete updated[studySelectionKey(next)];return updated;});persist(next,gloss,next.reading,text);
      if(!gloss)setMessage('사전에 없는 표현이에요. 뜻을 직접 적어 추가할 수 있어요.');
    }catch{if(attempt===lookupAttempt.current)setMessage('사전을 불러오지 못했어요. 뜻을 직접 적어 추가할 수 있어요.');}
    finally{if(attempt===lookupAttempt.current)setLookupBusy(false);}
  }
  async function add(repeat=false,snapshot=null){
    const selected=snapshot?.selection||current,selectedMeaning=snapshot?.meaning??meaning,selectedReading=snapshot?.reading??reading;
    if(!selected||busy||(!repeat&&findStudyEntry(session.note,selected))||session.queue.some(row=>row.text===selected.text&&studySelectionKey({text:row.text,source:row.seed?.source})===studySelectionKey(selected)))return;
    if(selected.source?.kind!=='manual'&&!resolveClassSource(material.processed_json,selected.source)){setMessage('교재 위치를 확인하지 못했어요. 표현을 다시 선택하거나 직접 입력으로 사용해 주세요.');return;}
    const saved=drafts.snapshot(readerDraftContext(selected)),version=draftVersion.current;
    setBusy(true);setMessage('');
    try{await session.add(selected.text,{...buildStudySeed(selected,selectedMeaning,selectedReading),...(repeat?{repeat:true}:{})});await drafts.consume(saved);if(isManual&&version===draftVersion.current)setInput('');}
    catch(error){setMessage(classroomError(error));}finally{setBusy(false);}
  }
  const show=event=>{if(current){presentationOriginRef.current=event.currentTarget;setPresentation({text:current.text,selection:current,reading,meaning});}};
  const saveLabel=classroomSaveLabel({error:session.error||session.storeError,online:session.online,queue:session.queue,loading:session.isLoading});
  const recordState=existing?'수업에 추가됨 ✓':queued?queued.status==='error'?'저장 확인 필요':'서버 저장 대기…':busy?'기기에 보관 중…':null;
  const draftState=drafts.error||(drafts.pending?'초안 보관 중…':savedDraft?'이 기기에 초안 보관':'');
  const currentChapter=chapters.find(ch=>String(ch.id)===String(material.id));
  const recordDisabled=busy||!!existing||!!queued||!sourceValid;
  const presentationQueued=presentation&&session.queue.find(row=>studySelectionKey({text:row.text,source:row.seed?.source})===studySelectionKey(presentation.selection));
  const classDetails=current?<div className="class-reader-add">
    <p className="class-reader-source">{isManual?'직접 입력한 표현':`${currentChapter?.order?`${currentChapter.order}과 · `:''}교재에서 선택한 표현`}</p>
    {(manual||!current.source?.tokenId)&&<div className="class-reader-picked"><strong lang={team.lang==='Chinese'?'zh':team.lang==='Japanese'?'ja':undefined}>{current.text}</strong></div>}
    {manual?<><label>읽기<input value={reading} onChange={e=>edit('reading',e.target.value)} maxLength={500}/></label><label>핵심 뜻<input value={meaning} onChange={e=>edit('meaning',e.target.value)} maxLength={500} placeholder="수업에서 사용할 뜻"/></label></>:<details><summary>수업용 뜻 확인·수정</summary><label>핵심 뜻<input value={meaning} onChange={e=>edit('meaning',e.target.value)} maxLength={500} placeholder="문장·표현의 뜻을 직접 적을 수 있어요"/></label></details>}
    {!sourceValid&&<p role="status">이 초안의 교재 위치를 확인하지 못했어요. <button onClick={()=>{const next={...current,source:{kind:'manual'}};setDraft(next);setManual(true);persist(next);}}>직접 입력으로 사용</button></p>}
    <details className="class-reader-extra"><summary>추가 동작</summary>
      {isManual&&<button disabled={recordDisabled} onClick={()=>add()}>기록만 하기</button>}
      {existing&&!queued&&<button disabled={busy||!sourceValid} onClick={()=>add(true)}>한 번 더 추가</button>}
      {savedDraft&&<button onClick={()=>clearDraft(savedDraft)}>초안 비우기</button>}
    </details>
  </div>:<p className="class-reader-hint">교재의 단어를 누르거나 표현을 드래그하세요. 이 자리에서 뜻을 보고 수업에 추가합니다.</p>;
  return <><aside ref={dockRef} className={`class-reader-dock${collapsed?' is-collapsed':''}${expanded?' is-expanded':''}`} hidden={suppressed} aria-label="교재 안 수업 도구" onMouseUp={e=>e.stopPropagation()}>
    <header className="class-reader-dock__header"><div><Link href={`/class/${team.key}/live?day=${day}`}>{team.name}</Link><small>{dayLabel(day)}{currentChapter?` · ${currentChapter.order}과`:''}</small><strong className="class-reader-keyboard-context" title={current?.text||input}>{current?.text||input||'표현 입력'}</strong></div><button className="class-reader-tools-toggle" aria-expanded={toolsOpen||!current} onClick={()=>{setCollapsed(false);setToolsOpen(v=>!v);}}>찾기</button><button aria-label={collapsed?'수업 도구 펼치기':'수업 도구 접기'} onClick={()=>setCollapsed(v=>!v)}>{collapsed?'펼치기':'접기'}</button><button className="class-reader-expand" aria-label={expanded?'패널 줄이기':'패널 펼치기'} onClick={()=>setExpanded(v=>!v)}>{expanded?'↙':'↗'}</button></header>
    <section className="class-reader-workspace" aria-label="선택한 표현을 수업에 추가" hidden={collapsed}>
    <div ref={bodyRef} className="class-reader-dock__body">
      <div className="class-reader-tools" data-open={toolsOpen||!current}>
      {chapters.length>0&&<label className="class-reader-chapter">교재 <select aria-label="수업 교재 과 선택" value={currentChapter?String(material.id):''} onChange={e=>{if(e.target.value)router.push(classStudyHref(e.target.value,team.key,day));}}><option value="" disabled>교재 선택</option>{chapters.map(ch=><option key={ch.id} value={String(ch.id)}>{ch.order}. {chapterLabel(ch.title)}</option>)}</select></label>}
      <form className="class-reader-search" onSubmit={lookup}><input ref={searchRef} aria-label="단어·표현 찾기" placeholder="단어·표현 찾기" value={input} disabled={!drafts.ready} maxLength={300} onChange={e=>changeInput(e.target.value)} onCompositionStart={()=>{composition.current=true;}} onCompositionEnd={()=>{composition.current=false;}} onKeyDown={e=>{if(e.key==='Enter'){blockedEnter.current=isClassComposing(e,composition.current);if(blockedEnter.current)e.preventDefault();}}} onKeyUp={()=>{blockedEnter.current=false;}}/><button disabled={!drafts.ready||lookupBusy||!input.trim()} onPointerDown={()=>{blockedEnter.current=false;}}>{lookupBusy?'조회 중':'찾기'}</button></form>
      {currentChapter&&<div className="class-reader-coverage"><button disabled={coverageBusy||coverage.isLoading||!!coverage.error} onClick={confirmChapter}>{isConfirmed?'오늘 수업 범위 ✓ · 취소':'오늘 이 과를 함께 읽었어요 ✓'}</button>{coverage.error&&<button onClick={()=>coverage.refetch()}>수업 범위 다시 확인</button>}<p role="status">{coverageMessage}</p></div>}
      </div>
      {drafts.rows.length>0&&<details className="class-reader-drafts"><summary>보관된 초안 {drafts.rows.length}개</summary>{drafts.rows.map(row=><div key={row.id}><button onClick={()=>restoreDraft(row)}>{row.value.selection?.text||row.value.input||'빈 초안'} · 계속 작성</button><button aria-label={`${row.value.selection?.text||row.value.input||'빈 초안'} 초안 비우기`} onClick={()=>clearDraft(row)}>비우기</button></div>)}</details>}
      {!manual&&wordContent&&<div className="class-reader-word">{wordContent(current?.source?.tokenId?classDetails:null)}</div>}
      {(manual||!current?.source?.tokenId)&&classDetails}
      {!manual&&annotationContent}
      {(message||session.storeError||session.error)&&<p role="status" className="class-reader-message">{message||session.storeError||'수업 노트를 불러오지 못했어요.'}{session.error&&<button onClick={()=>session.refetch()}>다시 불러오기</button>}</p>}
      {!manual&&sentenceContent&&<details className="class-reader-sentence"><summary>문장 해설</summary>{sentenceContent}</details>}
      <details className="class-reader-notes" aria-label="오늘 수업 노트"><summary>오늘 수업 표현 {entries.length}개</summary>
        <ol>{entries.slice().reverse().map(e=><li key={e.id}><b>{e.text}</b><span>{e.primary||'대표 뜻 없음'}</span></li>)}</ol>
        {session.analysis.running&&<p role="status">뜻 준비 중…</p>}
        {session.analysis.error&&<p role="status">뜻을 준비하지 못했어요. <button onClick={session.reanalyze}>다시 찾기</button></p>}
      </details>
    </div>
    <footer className="class-reader-footer">
      {(draftState||!session.queue.length||session.error||session.storeError)&&<p className="class-reader-status" role="status">{session.error||session.storeError?saveLabel:draftState||saveLabel}{drafts.error&&<button onClick={()=>persist(current)}>초안 다시 보관</button>}</p>}
      {current&&<div className="class-reader-presentation-actions"><button ref={showButtonRef} onClick={show}>크게 보여주기</button>{isManual?<button className="class-reader-add__button" disabled={recordDisabled} onClick={event=>{show(event);add();}}>{recordState||'보여주고 기록'}</button>:<button className="class-reader-add__button" onClick={()=>add()} disabled={recordDisabled}>{recordState||'수업 노트에 추가 +'}</button>}</div>}
      {session.queue.length>0&&<details className="class-reader-queue" open={session.queue.some(row=>row.status==='error')}><summary>{saveLabel}</summary>{session.queue.map(row=><div key={row.id} className="class-reader-pending"><b>{row.text}</b><small>{row.status==='error'?row.error:'서버 저장 대기'}</small>{row.status==='error'&&<button onClick={()=>session.retry(row.id).catch(e=>setMessage(classroomError(e)))}>저장 재시도</button>}</div>)}</details>}
    </footer>
    </section>
  </aside>{presentation&&<TeachingPresentation entry={presentation} lang={team.lang} onClose={closePresentation} onRecord={()=>add(false,presentation)} originRef={presentationOriginRef} fallbackRef={showButtonRef} recordState={findStudyEntry(session.note,presentation.selection)?'수업에 기록됨 ✓':presentationQueued?presentationQueued.status==='error'?'저장 확인 필요':'서버 저장 대기':busy?'보관 중…':null}/>}</>;
}

const selectionKeyFor=selection=>studySelectionKey(selection);
