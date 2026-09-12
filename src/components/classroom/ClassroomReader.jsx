'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {createPortal} from 'react-dom';
import {useRouter} from 'next/navigation';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '../../lib/supabase';
import {fetchTeamRoot,fetchBookChapters,chapterLabel} from '../../lib/classTeamQueries';
import {getTeam,dayLabel,patchTeamRoot,todayKey} from '../../lib/classBoard';
import {classroomEntries,classroomError,classMeaningPatch,saveClassroomMetadata,classroomPlainText,classroomScope} from '../../lib/classroomModel';
import {useClassroomSession} from '../../lib/useClassroomSession';
import {studySelectionKey,findStudyEntry,buildStudySeed} from '../../lib/classStudy';
import {canTeachClass,classWorkspaceHref} from '../../lib/classWorkspace';
import {readClassDraft,consumeLegacyClassDraft} from '../../lib/classroomOutbox';
import './classroom-reader.css';
import TeachingPresentation from './TeachingPresentation';
import {useClassReaderDrafts} from '../../lib/useClassReaderDrafts';
import {readerDraftScope,readerDraftContext,classroomSaveLabel,isClassComposing} from '../../lib/classReaderDraft';
import {resolveClassSource} from '../../lib/classSource';
import {useClassSelectionVisibility} from '../../lib/useReaderLayout';
import TeachingBoard from './TeachingBoard';

export default function ClassroomReader({annotationContent,context,user,material,selection,selectionSignal,wordContent,sentenceContent,fallback,onActive,suppressed,onPresenting,toolbarTarget,boardTarget,boardHeaderTarget,onBoardRatio,vocabularyIndex,onBoardLayout}) {
  const root=useQuery({queryKey:['class-root',user?.id,context?.team],queryFn:()=>fetchTeamRoot(user.id,context.team),enabled:!!user?.id&&!!context});
  const team=getTeam(root.data?.processed_json?.metadata);
  const allowed=canTeachClass(user,root.data,material);
  useEffect(()=>{onActive(allowed);return()=>onActive(false);},[allowed,onActive]);
  if(!allowed)return fallback;
  return <ClassReaderSession key={`${user.id}:${team.key}:${context.day}:${material.id}`} toolbarTarget={toolbarTarget} boardTarget={boardTarget} boardHeaderTarget={boardHeaderTarget} onBoardRatio={onBoardRatio} vocabularyIndex={vocabularyIndex} onBoardLayout={onBoardLayout} root={root.data} team={team} day={context.day} material={material} selection={selection} selectionSignal={selectionSignal} annotationContent={annotationContent} wordContent={wordContent} sentenceContent={sentenceContent} suppressed={suppressed} onPresenting={onPresenting}/>;
}

function ClassReaderSession({toolbarTarget,boardTarget,boardHeaderTarget,onBoardRatio,vocabularyIndex,onBoardLayout,root,team,day,material,selection,selectionSignal,annotationContent,wordContent,sentenceContent,suppressed,onPresenting}) {
  const router=useRouter(),queryClient=useQueryClient();
  const [boardOpen,setBoardOpen]=useState(false);
  useEffect(()=>{if(boardTarget&&new URLSearchParams(window.location.search).get('board')==='1')setBoardOpen(true);},[boardTarget]);
  const setBoard=useCallback(open=>{
    setBoardOpen(open);const url=new URL(window.location.href);
    if(open)url.searchParams.set('board','1');else url.searchParams.delete('board');
    window.history.replaceState(null,'',url.pathname+url.search+url.hash);
  },[]);
  const closeBoard=useCallback(()=>setBoard(false),[setBoard]);
  const positionAttempt=useRef(null);
  const [positionError,setPositionError]=useState(false),[positionBusy,setPositionBusy]=useState(false);
  const [legacy,setLegacy]=useState(null),legacySelected=useRef(null);
  useEffect(()=>{let alive=true;readClassDraft(classroomScope(root.owner_id,team.key,day)).then(row=>{if(alive&&row?.text?.trim())setLegacy(row);}).catch(()=>{});return()=>{alive=false;};},[root.owner_id,team.key,day]);
  const [meaningEditing,setMeaningEditing]=useState(false);
  const [view,setView]=useState('word'),[entryEdit,setEntryEdit]=useState(null),[entryBusy,setEntryBusy]=useState(false);
  const [presentation,setPresentation]=useState(null),[coverageBusy,setCoverageBusy]=useState(false),[coverageMessage,setCoverageMessage]=useState('');
  const coverage=useQuery({queryKey:['class-coverage-day',root.id,day],queryFn:async()=>{const {data,error}=await supabase.from('class_teaching_coverage').select('material_ids').eq('root_id',root.id).eq('day',day).maybeSingle();if(error)throw error;return data?.material_ids||[];},retry:false});
  const isConfirmed=coverage.data?.includes(String(material.id));
  const closePresentation=useCallback(()=>setPresentation(null),[]);
  useEffect(()=>{onPresenting?.(!!presentation);return()=>onPresenting?.(false);},[presentation,onPresenting]);
  async function confirmChapter(){setCoverageBusy(true);setCoverageMessage('');try{const {error}=await supabase.rpc('confirm_class_chapter',{p_root:root.id,p_day:day,p_material:material.id,p_include:!isConfirmed});if(error)throw error;setCoverageMessage(isConfirmed?'오늘 수업 범위에서 뺐어요.':'오늘 함께 읽은 교재로 확인했어요.');await coverage.refetch();}catch{setCoverageMessage('확인하지 못했어요. 다시 시도해 주세요.');}finally{setCoverageBusy(false);}}
  const rememberChapter=useCallback(async()=>{
    setPositionBusy(true);setPositionError(false);
    try{const fresh=await fetchTeamRoot(root.owner_id,team.key);const next=patchTeamRoot(fresh.processed_json,{chapterId:String(material.id)});const record=await saveClassroomMetadata(supabase,fresh,next.metadata);queryClient.setQueryData(['class-root',root.owner_id,team.key],record);}
    catch{setPositionError(true);}
    finally{setPositionBusy(false);}
  },[root.owner_id,team.key,material.id,queryClient]);
  useEffect(()=>{
    if(day!==todayKey()||!team.bookKey||material.processed_json?.metadata?.book?.key!==team.bookKey||String(team.chapterId)===String(material.id))return;
    const key=`${root.id}:${material.id}`;if(positionAttempt.current===key)return;positionAttempt.current=key;
    rememberChapter();
  },[day,root.id,team.bookKey,team.chapterId,material.id,material.processed_json,rememberChapter]);
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
  useClassSelectionVisibility(dockRef,bodyRef,manual?null:target?.first,manual?null:target?.last,`${selectionKeyFor(selection)}:${selectionSignal}`,!collapsed&&!suppressed);
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
  useEffect(()=>{if(previous.current.key!==selectionKey||previous.current.signal!==selectionSignal){previous.current={key:selectionKey,signal:selectionSignal};lookupAttempt.current++;draftVersion.current++;setLookupBusy(false);setManual(false);setMeaningEditing(false);setView('word');setToolsOpen(false);setCollapsed(false);setMessage('');}},[selectionKey,selectionSignal]);
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
    try{await session.add(selected.text,{...buildStudySeed(selected,selectedMeaning,selectedReading),...(repeat?{repeat:true}:{})});await drafts.consume(saved);if(legacySelected.current?.text===selected.text){await consumeLegacyClassDraft(classroomScope(root.owner_id,team.key,day),legacySelected.current);setLegacy(null);legacySelected.current=null;}if(isManual&&version===draftVersion.current)setInput('');}
    catch(error){setMessage(classroomError(error));}finally{setBusy(false);}
  }
  const show=event=>{if(current){presentationOriginRef.current=event.currentTarget;setPresentation({text:current.text,selection:current,reading,meaning});}};
  const saveLabel=classroomSaveLabel({error:session.error||session.storeError,online:session.online,queue:session.queue,loading:session.isLoading});
  const recordState=existing?'수업에 추가됨 ✓':queued?queued.status==='error'?'저장 확인 필요':'서버 저장 대기…':busy?'기기에 보관 중…':null;
  const draftState=drafts.error||(drafts.pending?'초안 보관 중…':savedDraft?'이 기기에 초안 보관':'');
  const currentChapter=chapters.find(ch=>String(ch.id)===String(material.id));
  const recordDisabled=busy||!!existing||!!queued||!sourceValid;
  const presentationQueued=presentation&&session.queue.find(row=>studySelectionKey({text:row.text,source:row.seed?.source})===studySelectionKey(presentation.selection));
  async function copyNote(){try{await navigator.clipboard.writeText(classroomPlainText(session.note));setMessage('수업 기록을 복사했어요.');}catch{setMessage('복사하지 못했어요. 다시 시도해 주세요.');}}
  async function saveEntry(event) {
    event.preventDefault();if(!entryEdit||entryBusy)return;
    setEntryBusy(true);setMessage('');
    try{const record=await saveClassroomMetadata(supabase,entryEdit.base,classMeaningPatch(entryEdit.base,entryEdit.entry,entryEdit.meaning));session.accept(record);setEntryEdit(null);}
    catch(error){setMessage(classroomError(error));}finally{setEntryBusy(false);}
  }
  async function changeChapter(value) {
    if(!chapters.some(ch=>String(ch.id)===value))return;
    try{if(day===todayKey()){const fresh=await fetchTeamRoot(root.owner_id,team.key);const next=patchTeamRoot(fresh.processed_json,{chapterId:value});const saved=await saveClassroomMetadata(supabase,fresh,next.metadata);queryClient.setQueryData(['class-root',root.owner_id,team.key],saved);}router.push(classWorkspaceHref(value,team.key,day)+(boardOpen?'&board=1':''));}
    catch(error){setMessage(classroomError(error));}
  }
  const openView=next=>{setBoard(false);setView(next);setCollapsed(false);if(next==='word'){setToolsOpen(true);requestAnimationFrame(()=>searchRef.current?.focus());}};
  const toolbar=<nav className="class-workspace-nav" aria-label="수업 도구"><Link href={`/class/${team.key}`} className="class-workspace-team">{team.name}</Link><span className="class-workspace-date">{dayLabel(day)}</span>{chapters.length>0&&<select aria-label="수업 교재 과 선택" value={currentChapter?String(material.id):''} onChange={e=>changeChapter(e.target.value)}><option value="" disabled>교재 선택</option>{chapters.map(ch=><option key={ch.id} value={String(ch.id)}>{ch.order}. {chapterLabel(ch.title)}</option>)}</select>}<div className="class-workspace-actions">{boardTarget&&<button onClick={()=>setBoard(true)}>설명판</button>}<button onClick={()=>openView('word')}>표현 찾기</button><button aria-pressed={view==='notes'&&!collapsed} onClick={()=>openView('notes')}>오늘 표현 <span>{entries.length}</span></button><button onClick={()=>openView('summary')}>마무리</button></div></nav>;
  const boardNavigation=<div className="board-class-navigation"><Link href={`/class/${team.key}`} title="팀 홈">{team.name}</Link><span>{dayLabel(day)}</span>{chapters.length>0&&<select aria-label="수업 교재 과 선택" value={currentChapter?String(material.id):''} onChange={e=>changeChapter(e.target.value)}><option value="" disabled>교재 선택</option>{chapters.map(ch=><option key={ch.id} value={String(ch.id)}>{ch.order}. {chapterLabel(ch.title)}</option>)}</select>}</div>;
  const noteList=<section className="class-reader-notes" aria-label="오늘 수업 노트"><div className="class-reader-section-heading"><h2>오늘 배운 표현</h2><small>{dayLabel(day)} · {entries.length}개</small></div>{!entries.length&&!session.isLoading&&<p className="class-reader-hint">학생에게 남길 표현을 추가하면 이곳에 모입니다.</p>}<ol>{entries.slice().reverse().map(e=><li key={e.id}><button className="class-reader-entry-title" onClick={event=>{presentationOriginRef.current=event.currentTarget;setPresentation({text:e.text,reading:e.reading,meaning:e.primary,recorded:true});}}><b>{e.text}</b>{e.reading&&<small>{e.reading}</small>}</button>{entryEdit?.entry.id===e.id?<form onSubmit={saveEntry}><label>수업용 뜻<input autoFocus value={entryEdit.meaning} maxLength={500} onChange={event=>setEntryEdit(v=>({...v,meaning:event.target.value}))}/></label><button disabled={entryBusy}>{entryBusy?'저장 중…':'뜻 저장'}</button><button type="button" disabled={entryBusy} onClick={()=>setEntryEdit(null)}>취소</button></form>:<div className="class-reader-entry-meaning"><p>{e.primary||'뜻을 적어 주세요'}</p><button aria-label={`${e.text} 뜻 수정`} onClick={()=>setEntryEdit({entry:e,meaning:e.primary,base:session.note})}>수정</button></div>}</li>)}</ol>{session.analysis.running&&<p role="status">뜻 준비 중…</p>}{session.analysis.error&&<p role="status">뜻을 준비하지 못했어요. <button onClick={session.reanalyze}>다시 찾기</button></p>}</section>;
  const meaningControl=<div className="class-reader-inline-meaning">{meaningEditing?<div><label>수업용 뜻<input autoFocus value={meaning} maxLength={500} onChange={e=>edit('meaning',e.target.value)}/></label><button onClick={()=>setMeaningEditing(false)}>확인</button><small>오늘 표현에 추가하면 학생에게 전달됩니다.</small></div>:<><strong>{meaning||'뜻을 적어 주세요'}</strong><button aria-label="수업용 뜻 수정" onClick={()=>setMeaningEditing(true)}>수정</button></>}</div>;
  const classDetails=current?<div className="class-reader-add">
    <p className="class-reader-source">{isManual?'직접 입력한 표현':`${currentChapter?.order?`${currentChapter.order}과 · `:''}교재에서 선택한 표현`}</p>
    {(manual||!current.source?.tokenId)&&<div className="class-reader-picked"><strong lang={team.lang==='Chinese'?'zh':team.lang==='Japanese'?'ja':undefined}>{current.text}</strong></div>}
    {manual?<>{['Japanese','Chinese'].includes(team.lang)&&<label>읽기<input value={reading} onChange={e=>edit('reading',e.target.value)} maxLength={500}/></label>}<label>핵심 뜻<input value={meaning} onChange={e=>edit('meaning',e.target.value)} maxLength={500} placeholder="수업에서 사용할 뜻"/></label></>:(!current?.source?.tokenId?meaningControl:null)}
    {!sourceValid&&<p role="status">이 초안의 교재 위치를 확인하지 못했어요. <button onClick={()=>{const next={...current,source:{kind:'manual'}};setDraft(next);setManual(true);persist(next);}}>직접 입력으로 사용</button></p>}
    <details className="class-reader-extra" hidden={!existing&&!savedDraft}><summary>추가 동작</summary>
      {existing&&!queued&&<button disabled={busy||!sourceValid} onClick={()=>add(true)}>한 번 더 추가</button>}
      {savedDraft&&<button onClick={()=>clearDraft(savedDraft)}>초안 비우기</button>}
    </details>
  </div>:<p className="class-reader-hint">교재의 단어를 누르거나 표현을 드래그하세요. 이 자리에서 뜻을 보고 수업에 추가합니다.</p>;
  return <>{toolbarTarget?.current&&createPortal(boardOpen?null:toolbar,toolbarTarget.current)}<aside ref={dockRef} className={`class-reader-dock${collapsed?' is-collapsed':''}${expanded?' is-expanded':''}`} hidden={suppressed} aria-label="교재 안 수업 도구" onMouseUp={e=>e.stopPropagation()}>
    <header className="class-reader-dock__header"><div><strong>{view==='word'?'뜻과 설명':view==='notes'?'오늘 표현':'수업 마무리'}</strong><small>{dayLabel(day)}</small><strong className="class-reader-keyboard-context">{current?.text||input||'표현 입력'}</strong></div>{view!=='word'&&<button onClick={()=>setView('word')}>뜻 보기</button>}<button className="class-reader-tools-toggle" aria-label="표현 찾기 열기" aria-expanded={toolsOpen||!current} onClick={()=>{setView('word');setCollapsed(false);setToolsOpen(v=>!v);}}>찾기</button><button aria-label={collapsed?'수업 도구 펼치기':'수업 도구 접기'} onClick={()=>setCollapsed(v=>!v)}>{collapsed?'펼치기':'접기'}</button><button className="class-reader-expand" aria-label={expanded?'패널 줄이기':'패널 펼치기'} onClick={()=>setExpanded(v=>!v)}>{expanded?'↙':'↗'}</button></header>
    <section className="class-reader-workspace" aria-label="선택한 표현을 수업에 추가" hidden={collapsed}>
    <div ref={bodyRef} className="class-reader-dock__body">
      {positionError&&<p role="status" className="class-reader-message">이어 볼 과를 저장하지 못했어요. <button disabled={positionBusy} onClick={rememberChapter}>위치 저장 재시도</button></p>}
      <div hidden={view!=='word'}>
      <div className="class-reader-tools" data-open={toolsOpen||!current}>

      <form className="class-reader-search" onSubmit={lookup}><input ref={searchRef} aria-label="단어·표현 찾기" placeholder="단어·표현 찾기" value={input} disabled={!drafts.ready} maxLength={300} onChange={e=>changeInput(e.target.value)} onCompositionStart={()=>{composition.current=true;}} onCompositionEnd={()=>{composition.current=false;}} onKeyDown={e=>{if(e.key==='Enter'){blockedEnter.current=isClassComposing(e,composition.current);if(blockedEnter.current)e.preventDefault();}}} onKeyUp={()=>{blockedEnter.current=false;}}/><button disabled={!drafts.ready||lookupBusy||!input.trim()} onPointerDown={()=>{blockedEnter.current=false;}}>{lookupBusy?'조회 중':'찾기'}</button></form>

      </div>
      {legacy&&<details className="class-reader-drafts"><summary>이전 입력 초안</summary><p>{legacy.text}</p><button onClick={()=>{legacySelected.current=legacy;const next={text:legacy.text,source:{kind:'manual'}};setManual(true);setDraft(next);setInput('');persist(next,'','','');}}>이어서 작성</button></details>}
      {drafts.rows.length>0&&<details className="class-reader-drafts"><summary>보관된 초안 {drafts.rows.length}개</summary>{drafts.rows.map(row=><div key={row.id}><button onClick={()=>restoreDraft(row)}>{row.value.selection?.text||row.value.input||'빈 초안'} · 계속 작성</button><button aria-label={`${row.value.selection?.text||row.value.input||'빈 초안'} 초안 비우기`} onClick={()=>clearDraft(row)}>비우기</button></div>)}</details>}
      {!manual&&wordContent&&<div className="class-reader-word">{wordContent(current?.source?.tokenId?<>{classDetails}{annotationContent}</>:null,current?.source?.tokenId?meaningControl:null)}</div>}
      {(manual||!current?.source?.tokenId)&&classDetails}
      {!manual&&!current?.source?.tokenId&&annotationContent}
      {(message||session.storeError||session.error)&&<p role="status" className="class-reader-message">{message||session.storeError||'수업 노트를 불러오지 못했어요.'}{session.error&&<button onClick={()=>session.refetch()}>다시 불러오기</button>}</p>}
      {!manual&&sentenceContent&&<details className="class-reader-sentence"><summary>문장 해설</summary>{sentenceContent}</details>}
      </div>
      {view!=='word'&&(message||session.error||session.storeError)&&<p role="status" className="class-reader-message">{message||session.storeError||'수업 기록을 확인하지 못했어요.'}</p>}
      {view==='notes'&&noteList}
      {view==='summary'&&<section className="class-reader-summary"><h2>오늘 수업을 확인하세요</h2><p>추가한 표현은 이미 수업 기록에 남아 있어요.</p>      {currentChapter&&<div className="class-reader-coverage"><button disabled={coverageBusy||coverage.isLoading||!!coverage.error} onClick={confirmChapter}>{isConfirmed?'오늘 수업 범위 ✓ · 취소':'오늘 이 과를 함께 읽었어요 ✓'}</button>{coverage.error&&<button onClick={()=>coverage.refetch()}>수업 범위 다시 확인</button>}<p role="status">{coverageMessage}</p></div>}<p>{entries.length}개 표현 · {saveLabel}</p><button onClick={()=>setView('notes')}>오늘 표현 확인</button>{session.note&&<button onClick={copyNote}>기록 복사</button>}<Link href={`/class/${team.key}`}>팀 홈으로</Link><details><summary>다른 화면에서 열기</summary><Link href={`/class/${team.key}/board?day=${day}`} target="_blank" rel="noopener noreferrer">저장된 표현 크게 띄우기 ↗</Link></details></section>}

    </div>
    <footer className="class-reader-footer">
      {(draftState||!session.queue.length||session.error||session.storeError)&&<p className="class-reader-status" role="status">{session.error||session.storeError?saveLabel:draftState||saveLabel}{drafts.error&&<button onClick={()=>persist(current)}>초안 다시 보관</button>}</p>}
      {current&&view==='word'&&<div className="class-reader-presentation-actions"><button ref={showButtonRef} onClick={show}>크게 보기</button><button className="class-reader-add__button" onClick={()=>add()} disabled={recordDisabled}>{recordState||'오늘 표현에 추가'}</button></div>}
      {session.queue.length>0&&<details className="class-reader-queue" open={session.queue.some(row=>row.status==='error')}><summary>{saveLabel}</summary>{session.queue.map(row=><div key={row.id} className="class-reader-pending"><b>{row.text}</b><small>{row.status==='error'?row.error:'서버 저장 대기'}</small>{row.status==='error'&&<button onClick={()=>session.retry(row.id).catch(e=>setMessage(classroomError(e)))}>저장 재시도</button>}</div>)}</details>}
    </footer>
    </section>
  </aside>{boardOpen&&boardTarget&&<TeachingBoard target={boardTarget} headerTarget={boardHeaderTarget} onRatio={onBoardRatio} navigation={boardNavigation} onSession={()=>openView('summary')} material={material} vocabularyIndex={vocabularyIndex} onLayout={onBoardLayout} onClose={closeBoard}
    owner={root.owner_id} team={team} day={day} current={current?{...current,meaning,reading}:null}
    getRecordState={picked=>findStudyEntry(session.note,picked)?'오늘 표현에 추가됨':session.queue.some(row=>studySelectionKey({text:row.text,source:row.seed?.source})===studySelectionKey(picked))?'저장 대기 중':null}
    onRecord={async picked=>{
      if(picked.source?.kind!=='manual'&&(String(picked.source?.materialId)!==String(material.id)||!resolveClassSource(material.processed_json,picked.source)))throw new Error('원래 교재 위치에서 수업 기록에 추가해 주세요.');
      if(findStudyEntry(session.note,picked))throw new Error('이미 오늘 표현에 추가된 항목이에요.');
      await session.add(picked.text,buildStudySeed(picked,picked.meaning,picked.reading));
    }}/>} {presentation&&<TeachingPresentation entry={presentation} lang={team.lang} onClose={closePresentation} onRecord={presentation.recorded?undefined:()=>add(false,presentation)} originRef={presentationOriginRef} fallbackRef={showButtonRef} recordState={findStudyEntry(session.note,presentation.selection)?'수업에 기록됨 ✓':presentationQueued?presentationQueued.status==='error'?'저장 확인 필요':'서버 저장 대기':busy?'보관 중…':null}/>}</>;
}

const selectionKeyFor=selection=>studySelectionKey(selection);
