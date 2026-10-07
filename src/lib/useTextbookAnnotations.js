'use client';
// 교재 설명 조회·저장 대기·재시도·충돌 해소. 수업 화면과 팀 페이지가 같은 훅을 쓴다(복붙 금지).
// 규칙 자체는 textbookAnnotationSync.js(순수)에 있고, 여기서는 React 상태에 잇기만 한다.
import {useCallback,useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {requestTextbookAnnotations} from './textbookAnnotationsClient';
import {listClassOperations,putClassOperation,deleteClassOperation} from './classroomOutbox';
import {createTextbookSaveRunner,shouldRetryTextbookSave,textbookAnnotationScope,textbookConflictDraft,textbookOperationId} from './textbookAnnotationSync';

const EMPTY_NOTES=[],EMPTY_HISTORY=[];
const outbox={put:putClassOperation,send:requestTextbookAnnotations,remove:deleteClassOperation,list:listClassOperations};

/**
 * @param materialId 교재 과 id
 * @param team 수업 팀 key(서버 권한 판정에 쓰인다 — 클라이언트는 권한을 정하지 않는다)
 * @param local 받아 둔 사본이면 true(네트워크 0, 편집 0) · localAnnotations 사본에 담긴 설명
 * @param onSaved 저장 성공 직후(같은 렌더) — 편집창 닫기용
 */
export function useTextbookAnnotations({materialId,team,user,enabled=true,local=false,localAnnotations,onSaved}) {
 const id=String(materialId||'');
 const query=useQuery({queryKey:['textbook-annotations',id,user?.id,team],queryFn:()=>requestTextbookAnnotations(id,team),enabled:enabled&&!local,retry:false,staleTime:30000});
 const data=local?{annotations:localAnnotations||[],canEdit:false}:query.data;
 const rows=data?.annotations||EMPTY_NOTES,canEdit=data?.canEdit;
 const [pending,setPending]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const scope=textbookAnnotationScope(user?.id,id);
 const runner=useRef(null);if(!runner.current)runner.current=createTextbookSaveRunner(outbox);
 const savedRef=useRef(onSaved);savedRef.current=onSaved;
 const refetch=query.refetch;
 useEffect(()=>{if(!user)return;let alive=true;listClassOperations(scope).then(rows=>{if(alive&&rows[0]?.pending){setPending(rows[0].pending);setMessage('저장 확인을 기다리는 주의점이 있어요.');}}).catch(()=>{if(alive)setMessage('이 기기의 저장 대기 내용을 확인하지 못했어요.');});return()=>{alive=false;runner.current.bump();};},[scope,user]);
 const save=useCallback(request=>runner.current.run(request,{scope,materialId:id,team},{
  start:()=>{setBusy(true);setMessage('');},
  pending:setPending,
  saved:async remaining=>{setPending(remaining);savedRef.current?.();setMessage('교재에 저장했어요. 다음에 이 부분을 읽을 때 다시 나타납니다.');await refetch();},
  failed:e=>{setMessage(e.message);if(e.conflict)setPending(p=>({...p,conflict:true}));},
  settled:()=>setBusy(false),
 }),[scope,id,team,refetch]);
 const retryRef=useRef(null);retryRef.current=()=>{if(shouldRetryTextbookSave(pending,runner.current.locked))save(pending);};
 useEffect(()=>{const retry=()=>retryRef.current?.();window.addEventListener('online',retry);return()=>window.removeEventListener('online',retry);},[]);
 const retry=useCallback(()=>pending&&save(pending),[pending,save]);
 // 다른 수정과 겹친 입력: 최신을 받아 비교하고, 입력은 편집창으로 돌려준다(onDraft). 대기는 그때 지운다.
 const resolveConflict=useCallback(async onDraft=>{
  const latest=await refetch();const draft=textbookConflictDraft(latest.data,pending);if(!draft)return;
  await deleteClassOperation(textbookOperationId(pending.operation));
  onDraft?.(draft);setPending(null);setMessage('최신 주의점을 비교한 후 저장해 주세요.');
 },[refetch,pending]);
 return {query,data,rows,canEdit,history:data?.history||EMPTY_HISTORY,pending,busy,message,save,retry,resolveConflict};
}
