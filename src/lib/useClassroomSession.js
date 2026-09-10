'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from './supabase';
import { fetchDayNote } from './classTeamQueries';
import { classroomScope, appendClassroomEntry, classroomError, classroomAnalysisIndices } from './classroomModel';
import { putClassOperation, listClassOperations, deleteClassOperation, claimClassOperation, discardClassOperation } from './classroomOutbox';
import { openClassChannel } from './classRealtime';
import { BOARD_POLL_MS } from './classBoard';
import { analyzeText } from './analyzeText';
import { runPreservedReanalysis } from './reanalysisPreservation';

export function useClassroomSession({ ownerId, team, rootId, day }) {
  const client = useQueryClient();
  const scope = classroomScope(ownerId,team,day);
  const queryKey = useMemo(() => ['class-note',ownerId,team,day], [ownerId,team,day]);
  const query = useQuery({ queryKey, queryFn: () => fetchDayNote(ownerId,team,day), refetchInterval: BOARD_POLL_MS });
  const [queue,setQueue] = useState([]);
  const [storeError,setStoreError] = useState('');
  const [online,setOnline] = useState(true);
  const [analysis,setAnalysis] = useState({ running: false, error: '' });
  const [retryAnalysis,setRetryAnalysis] = useState(0);
  const retryMissing = useRef(false);
  const active = useRef(true), sending = useRef(false), channel = useRef(null);
  const refreshQueue = useCallback(async () => {
    const all = await listClassOperations(scope);
    const saved=client.getQueryData(queryKey)?.processed_json?.metadata?.classOperations || {};
    const rows=[];
    for(const row of all){ if(saved[row.id]===row.text) await deleteClassOperation(row.id); else rows.push(row); }
    if (active.current) setQueue(rows);
    return rows;
  },[scope,client,queryKey]);
  const accept = useCallback(record => {
    if (!active.current) return;
    client.setQueryData(queryKey,record);
    client.invalidateQueries({queryKey});
    client.invalidateQueries({queryKey:['class-teams',ownerId]});
    channel.current?.send({noteId:record.id});
  },[client,queryKey,ownerId]);
  const pump = useCallback(async () => {
    if (sending.current || !active.current || !navigator.onLine) return;
    sending.current = true;
    try {
      while(active.current && navigator.onLine) {
        const [row] = await refreshQueue();
        if(!row) break;
        if (!active.current || !navigator.onLine) break;
        // A failed first entry holds later entries, preserving teaching order.
        if (row.status === 'error') break;
        try {
          const db = await getSupabase();
          const { data, error } = await db.auth.getSession();
          if (error || data?.session?.user?.id !== ownerId || !active.current) break;
          const claimed=await claimClassOperation(row.id);
          if(!claimed) continue;
          await refreshQueue();
          if (!active.current) break;
          const record = await appendClassroomEntry(db,row);
          accept(record);
          await deleteClassOperation(row.id);
        } catch (error) {
          await putClassOperation({...row,attempted:true,status:'error',errorCode:error?.code||'',error:classroomError(error)});
          break;
        }
      }
      await refreshQueue();
    } catch (error) { if (active.current) setStoreError(classroomError(error)); }
    finally { sending.current = false; }
  },[ownerId,refreshQueue,accept]);
  useEffect(() => {
    active.current = true;
    const wake = () => { setOnline(navigator.onLine); refreshQueue().then(pump).catch(error=>setStoreError(classroomError(error))); };
    wake();
    window.addEventListener('online',wake); window.addEventListener('offline',wake);
    window.addEventListener('focus',wake);
    channel.current = openClassChannel(team,{onEntry:()=>client.invalidateQueries({queryKey})});
    return () => {
      active.current = false; channel.current?.close();
      window.removeEventListener('online',wake); window.removeEventListener('offline',wake); window.removeEventListener('focus',wake);
    };
  },[team,client,queryKey,pump,refreshQueue]);
  // Polling also discovers entries safely queued in another tab. Failed rows require explicit retry.
  useEffect(() => { const timer=setInterval(()=>{ refreshQueue().then(pump).catch(()=>{}); },5000); return()=>clearInterval(timer); },[pump,refreshQueue]);
  async function add(text) {
    const clean=text.replace(/\r/g,'').trim();
    if (!clean || clean.length>5000) throw new Error('1~5,000자로 입력해 주세요.');
    const row={id:crypto.randomUUID(),scope,ownerId,team,rootId,day,text:clean,createdAt:Date.now(),status:'queued',attempted:false};
    await putClassOperation(row); // Never clear the composer until the transaction commits.
    setStoreError(''); await refreshQueue(); void pump();
  }
  async function retry(id) {
    const row=(await listClassOperations(scope)).find(r=>r.id===id);
    if (row) await putClassOperation({...row,status:'queued',error:''});
    await refreshQueue(); void pump();
  }
  async function discard(id) {
    const row=(await listClassOperations(scope)).find(r=>r.id===id);
    if (!row) return;
    await discardClassOperation(id); await refreshQueue();
  }
  const note=query.data;
  const revision=note?.processed_json?.metadata?.viewerRevision || JSON.stringify(note?.processed_json);
  useEffect(() => {
    const selected=classroomAnalysisIndices(note,retryMissing.current);
    if (!note || !selected?.length || !online) return undefined;
    retryMissing.current=false; // A saved revision must not loop on an empty AI meaning.
    const controller=new AbortController();
    let alive=true;
    setAnalysis({running:true,error:''});
    (async()=>{
      const db=await getSupabase();
      const {data,error}=await db.auth.getSession();
      if (error || data?.session?.user?.id!==ownerId || !alive) return;
      // The pipeline appends paragraph end breaks itself. Keep lexical IDs and manual fields intact.
      const base=structuredClone(note.processed_json);
      base.sequence=base.sequence.filter(id=>!/^br_\d+_end_/.test(id));
      base.dictionary=Object.fromEntries(base.sequence.map(id=>[id,base.dictionary[id]]));
      const record=await runPreservedReanalysis(db,note,controller.signal,analyzeText,{selectedLineIndices:selected,baseJsonOverride:base});
      if (alive) accept(record);
    })().catch(error=>{
      if (alive && error?.name!=='AbortError') setAnalysis({running:false,error:classroomError(error)});
    }).finally(()=>{if(alive) setAnalysis(prev=>({...prev,running:false}));});
    return()=>{alive=false;controller.abort();};
    // The exact revision, not a refetched object identity, owns this analysis attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[note?.id,revision,online,retryAnalysis,ownerId,accept]);
  return {...query,note,queue,online,storeError,analysis,add,retry,discard,accept,notify:()=>channel.current?.send({}),reanalyze:()=>{retryMissing.current=true;setRetryAnalysis(n=>n+1);}};
}
