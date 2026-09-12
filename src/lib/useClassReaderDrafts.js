'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {listClassReaderDrafts,putClassOperation,consumeClassReaderDraft} from './classroomOutbox';
import {hydrateReaderDrafts,readerDraftContext,readerDraftValue} from './classReaderDraft';

export function useClassReaderDrafts(scope) {
  const writer=useRef(null);if(!writer.current)writer.current=crypto.randomUUID();
  const [state,setState]=useState({scope,ready:false,rows:[],error:'',pending:0});
  const records=useRef(new Map()),chain=useRef(Promise.resolve()),active=useRef(null);
  useEffect(()=>{
    const generation={scope,pending:0,failed:new Set()};active.current=generation;records.current=new Map();
    setState({scope,ready:false,rows:[],error:'',pending:0});
    listClassReaderDrafts(scope).then(rows=>{
      if(active.current!==generation)return;
      const newest=hydrateReaderDrafts(rows,scope,records.current.values());records.current=new Map(newest.map(row=>[row.context,row]));
      setState({scope,ready:true,rows:newest,error:'',pending:generation.pending});
    }).catch(()=>{if(active.current===generation)setState({scope,ready:true,rows:[...records.current.values()],error:'이 기기의 초안을 불러오지 못했어요. 입력은 유지되지만 보관 상태를 확인해 주세요.',pending:generation.pending});});
    return()=>{if(active.current===generation)active.current=null;};
  },[scope]);
  const refresh=useCallback(patch=>setState(prev=>prev.scope===scope?{...prev,rows:[...records.current.values()].sort((a,b)=>b.updatedAt-a.updatedAt),...patch}:prev),[scope]);
  const save=useCallback(value=>{
    if(active.current?.scope!==scope)return;
    const clean=readerDraftValue(value);if(!clean){refresh({error:'초안을 보관하지 못했어요. 표현과 수업용 뜻의 길이·출처를 확인해 주세요.'});return;}
    const context=readerDraftContext(clean.selection),previous=records.current.get(context);
    const record={id:previous?.writer===writer.current?previous.id:crypto.randomUUID(),revision:crypto.randomUUID(),
      scope,kind:'draft',category:'reader',writer:writer.current,context,value:clean,updatedAt:Date.now(),
      ...(previous&&previous.writer!==writer.current?{origin:{id:previous.id,revision:previous.revision}}:previous?.origin?{origin:previous.origin}:{})};
    const generation=active.current;
    records.current.set(context,record);generation.pending++;refresh({pending:generation.pending});
    chain.current=chain.current.catch(()=>{}).then(()=>putClassOperation(record)).then(()=>{
      if(active.current===generation)generation.failed.delete(context);
    }).catch(()=>{generation.failed.add(context);}).finally(()=>{
      generation.pending--;if(active.current===generation)refresh({pending:generation.pending,error:generation.failed.size?'기기에 초안을 보관하지 못했어요. 입력을 복사하거나 다시 시도해 주세요.':''});
    });
    return record;
  },[scope,refresh]);
  const consume=useCallback(async record=>{
    if(!record)return;
    await chain.current;
    await consumeClassReaderDraft(record.id,record.revision);
    if(record.origin)await consumeClassReaderDraft(record.origin.id,record.origin.revision);
    if(active.current?.scope===scope&&records.current.get(record.context)?.revision===record.revision){records.current.delete(record.context);refresh({});}
  },[scope,refresh]);
  return {...(state.scope===scope?state:{ready:false,rows:[],error:'',pending:0}),save,consume,
    snapshot:context=>records.current.get(context),flush:()=>chain.current};
}
