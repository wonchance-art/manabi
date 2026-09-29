'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {emptyBoard} from './teachingBoard';
import {readTeachingBoard,readTeachingBoardRecoveries,saveTeachingBoard,preserveTeachingBoardRecovery} from './teachingBoardStore';
import {cloudBoardScope,cloudDocument,sameBoardContent,restoreBoardCamera,boardCloudLabel} from './teachingBoardCloud';
import {readCloudBoard,writeCloudBoard} from './teachingBoardCloudClient';

const outgoing=new Map();
const recoveriesFor=async(scope,legacy)=>{const sets=await Promise.all([readTeachingBoardRecoveries(scope),readTeachingBoardRecoveries(legacy)]);return sets.flat().sort((a,b)=>b.updatedAt-a.updatedAt);};
export default function useTeachingBoardCloud(owner,root,day,legacyScope){
 const scope=cloudBoardScope(owner,root,day),session=useRef(null),timer=useRef(null);
 const [state,setState]=useState({ready:false,document:null,saving:false,error:'',epoch:0});
 const publish=useCallback((run,patch)=>{if(run.alive)setState(old=>({...old,...patch}));},[]);
 const persist=useCallback((run)=>{
  const value={...run.document,accountBoard:{version:1,revision:run.revision,dirty:run.dirty}};
  run.localQueue=run.localQueue.catch(()=>{}).then(async()=>{
   const saved=await saveTeachingBoard(run.scope,run.localRevision,value,run.writer);run.localRevision=saved.revision;run.localSaved=true;
  });
  const pending=run.localQueue;outgoing.set(run.scope,pending);pending.finally(()=>{if(outgoing.get(run.scope)===pending)outgoing.delete(run.scope);}).catch(()=>{});
  return run.localQueue;
 },[]);
 const sync=useCallback(async()=>{
  const run=session.current;if(!run?.alive||run.scope!==scope||!run.document||run.blocked)return;
  clearTimeout(timer.current);if(run.syncing){await run.syncing;if(run.dirty)return sync();return;}
  if(!run.dirty)return;
  publish(run,{saving:true,error:''});
  const snapshot=cloudDocument(run.document),generation=run.generation,operation=crypto.randomUUID();
  run.syncing=(async()=>{
   if(!run.remoteKnown){const latest=await readCloudBoard(root,day);run.remoteKnown=true;
    if(latest.document&&!sameBoardContent(latest.document,snapshot)&&latest.row.revision!==run.revision)throw Object.assign(new Error('다른 기기의 설명판이 있어요. 두 필기를 보존한 뒤 최신 판을 열어 주세요.'),{status:409});
    run.revision=latest.row?.revision||null;
   }
   let result;
   try{result=await writeCloudBoard(root,day,run.revision,snapshot,operation);}catch(error){
    try{const remote=await readCloudBoard(root,day);if(remote.document&&sameBoardContent(remote.document,snapshot))result={board:remote.row};
     else if(remote.row?.revision&&remote.row.revision!==run.revision)throw Object.assign(new Error('다른 기기의 수정과 내 필기가 겹쳤어요. 두 내용은 보존됩니다.'),{status:409});
    }catch(check){if(check.status===409)error=check;}
    if(!result)throw error;
   }
   run.revision=result.board.revision;run.cloudSaved=true;if(run.generation===generation)run.dirty=false;
   await persist(run);publish(run,{saving:run.dirty,cloudSaved:!run.dirty,localSaved:run.localSaved,error:'',updatedAt:result.board.updated_at});
  })().catch(async error=>{
   run.blocked=error.status===409||error.code==='board_conflict';
   if(run.blocked)try{await preserveTeachingBoardRecovery(run.scope,run.document,run.writer);}catch(recovery){error=new Error(`${error.message} ${recovery.message}`);}
   publish(run,{saving:false,cloudSaved:false,localSaved:run.localSaved,error:error.message||'계정에 저장하지 못했어요. 연결 후 다시 시도해 주세요.',conflict:run.blocked});
   throw error;
  }).finally(()=>{run.syncing=null;});
  await run.syncing;if(run.dirty)return sync();
 },[root,day,scope,persist,publish]);
 useEffect(()=>{
  const run={alive:true,scope,document:null,writer:crypto.randomUUID(),revision:null,localRevision:null,localQueue:Promise.resolve(),dirty:false,generation:0,blocked:false,remoteKnown:false,localSaved:false};session.current=run;
  setState({ready:false,document:null,saving:false,error:'',epoch:0});
  (async()=>{
   let row=null,local=null,localError='';
   try{await outgoing.get(scope);row=await readTeachingBoard(scope);if(!row)row=await readTeachingBoard(legacyScope);local=row?.document||null;run.localRevision=row?.id===scope?row.revision:null;run.localSaved=!!local;
   }catch{localError='기기 초안 보관을 사용할 수 없어요. 계정 저장 상태를 확인하세요.';}
   if(!run.alive)return;
   const meta=local?.accountBoard;run.revision=meta?.revision||null;
   run.document=local?{...local}:emptyBoard(crypto.randomUUID());run.dirty=!!local&&(meta?!!meta.dirty:true);
   try{const remote=await readCloudBoard(root,day);if(!run.alive)return;run.remoteKnown=true;
    const same=remote.document&&sameBoardContent(remote.document,run.document);
    if(remote.document&&run.dirty&&!same&&run.revision!==remote.row.revision){run.blocked=true;await preserveTeachingBoardRecovery(scope,run.document,run.writer);localError='다른 기기의 수정과 이 기기의 필기가 겹쳤어요. 내 초안을 보관하고 최신 판을 열 수 있습니다.';}
    else if(remote.document&&(!run.dirty||same)){run.document=restoreBoardCamera(remote.document,local);run.revision=remote.row.revision;run.dirty=false;run.cloudSaved=true;}
    else if(!remote.document&&meta?.revision){run.blocked=true;localError='계정의 설명판을 찾지 못했어요. 내 필기를 백업한 뒤 저장 상태를 확인하세요.';}
   }catch(error){if([401,403,404].includes(error.status)){publish(run,{error:error.message,denied:true});return;}localError=error.message||'연결되지 않아 기기의 설명판을 열었어요.';}
   if(!run.alive)return;
   try{await persist(run);}catch(error){localError=error.message;run.localSaved=false;if(error.code==='board_conflict')run.blocked=true;}
   const recoveries=await recoveriesFor(scope,legacyScope).catch(()=>[]);
   publish(run,{ready:true,document:run.document,error:localError,conflict:run.blocked,localSaved:run.localSaved,cloudSaved:run.cloudSaved&&!run.dirty,recoveries});
   if(run.alive&&run.dirty&&!run.blocked&&run.remoteKnown)sync().catch(()=>{});
  })().catch(error=>publish(run,{error:error.message}));
  return()=>{run.alive=false;clearTimeout(timer.current);};
 },[owner,root,day,scope,legacyScope,persist,publish,sync]);
 const save=useCallback(async document=>{
  const run=session.current;if(!run?.alive||run.scope!==scope||!run.document)return;
  const changed=!sameBoardContent(document,run.document);run.document=document;
  if(changed){run.dirty=true;run.generation++;}publish(run,{document,saving:changed&&!run.blocked,cloudSaved:run.cloudSaved&&!run.dirty});
  try{await persist(run);publish(run,{localSaved:true});}catch(error){if(error.code==='board_conflict')run.blocked=true;run.localSaved=false;publish(run,{error:error.message,saving:false,conflict:run.blocked,localSaved:false});return;}
  clearTimeout(timer.current);if(run.dirty&&!run.blocked)timer.current=setTimeout(()=>sync().catch(()=>{}),1800);
 },[scope,persist,publish,sync]);
 const reload=useCallback(async()=>{
  const run=session.current;if(!run?.alive||run.scope!==scope||!run.document)return;
  clearTimeout(timer.current);await run.syncing?.catch(()=>{});await run.localQueue.catch(()=>{});
  const generation=run.generation,oldRevision=run.revision;
  if(run.dirty||run.blocked)await preserveTeachingBoardRecovery(scope,run.document,run.writer);
  const remote=await readCloudBoard(root,day);if(!run.alive||run.scope!==scope)return;
  if(!remote.document)throw new Error('계정의 설명판을 찾지 못했어요. 내 필기는 그대로 두었어요.');
  if(run.generation!==generation||run.revision!==oldRevision)throw new Error('확인하는 동안 필기가 변경됐어요. 내 필기를 보관한 뒤 다시 눌러 주세요.');
  const latest=await readTeachingBoard(scope);
  if(latest&&latest.revision!==run.localRevision&&latest.document.accountBoard?.dirty)await preserveTeachingBoardRecovery(scope,latest.document,crypto.randomUUID());
  const recoveries=await recoveriesFor(scope,legacyScope);
  if(run.generation!==generation||run.revision!==oldRevision)throw new Error('새로 쓴 필기를 보존했어요. 다시 최신 판을 확인해 주세요.');
  const document=restoreBoardCamera(remote.document,run.document);
  const saved=await saveTeachingBoard(scope,latest?.revision||null,{...document,accountBoard:{version:1,revision:remote.row.revision,dirty:false}},run.writer);
  run.localRevision=saved.revision;
  // A new stroke while IndexedDB was committing must not be replaced on screen
  // or silently rebased onto a different remote version.
  if(run.generation!==generation){run.blocked=true;run.revision=oldRevision;await preserveTeachingBoardRecovery(scope,run.document,run.writer);publish(run,{conflict:true,error:'새 필기를 복구본에 보관했어요. 다시 최신 판을 확인해 주세요.'});return;}
  run.document=document;run.revision=remote.row.revision;run.dirty=false;run.blocked=false;run.remoteKnown=true;run.cloudSaved=true;run.localSaved=true;
  if(run.alive)setState(old=>({...old,document:run.document,error:'',conflict:false,cloudSaved:true,localSaved:true,saving:false,recoveries,epoch:(old.epoch||0)+1}));
 },[scope,root,day,legacyScope,publish]);
 useEffect(()=>{
  const retry=()=>sync().catch(()=>{});
  const foreground=async()=>{const run=session.current;if(!run?.alive||run.scope!==scope||!run.document)return;if(run.dirty){retry();return;}try{const remote=await readCloudBoard(root,day);if(!run.alive)return;if(remote.row?.revision!==run.revision)publish(run,{error:'다른 기기에 저장한 판이 있어요. 저장 상태에서 최신 판을 확인하세요.',cloudSaved:false});}catch(error){if(run.alive)publish(run,{error:error.message,cloudSaved:false});}};
  const protect=e=>{if(session.current?.dirty&&!session.current?.allowLeave){e.preventDefault();e.returnValue='';}};
  window.addEventListener('online',retry);window.addEventListener('focus',foreground);window.addEventListener('beforeunload',protect);
  return()=>{window.removeEventListener('online',retry);window.removeEventListener('focus',foreground);window.removeEventListener('beforeunload',protect);};
 },[sync,root,day,scope,publish]);
 const prepareLeave=async()=>{const run=session.current;await run?.localQueue;if(!run?.localSaved)throw new Error('먼저 필기를 백업해 주세요.');run.allowLeave=true;};
 return {...state,save,sync,reload,prepareLeave,label:boardCloudLabel(state),snapshot:()=>session.current?.document,flush:()=>session.current?.localQueue,scope};
}
