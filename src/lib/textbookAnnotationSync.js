// 교재 설명 저장·대기·재시도의 순수 규칙. 수업 화면(TextbookAnnotations)과 팀 페이지
// (ClassTextbookNotes)가 같은 규칙을 쓴다 — scope·operation id 형식이 바뀌면 기기에 남은
// 저장 대기분을 다른 화면에서 복구하지 못한다.
import {resolveTextbookAnchor} from './textbookAnnotations';

export const textbookAnnotationScope=(userId,materialId)=>JSON.stringify(['textbook-annotation',userId,String(materialId||'')]);
export const textbookOperationId=operation=>`textbook:${operation}`;

export function textbookSaveRequest(annotation,patch={},makeId=()=>crypto.randomUUID()) {
 const next={...annotation,...patch};
 return {operation:makeId(),annotation:{id:next.id||makeId(),revision:next.revision||0,anchor:next.anchor,body:next.body,archived:!!next.archived}};
}

// 저장 대기 재전송은 충돌 표시가 없고, 진행 중인 저장이 없을 때만 한다.
export const shouldRetryTextbookSave=(pending,locked)=>!!pending&&!pending.conflict&&!locked;

// 충돌 후 다시 편집: 입력은 그대로, revision만 서버 최신값으로 맞춘다(덮어쓰기 아님 — 서버가 다시 비교한다).
export function textbookConflictDraft(latest,pending) {
 if(!latest||!pending?.annotation)return null;
 const row=(latest.annotations||[]).find(r=>r.id===pending.annotation.id);
 return {...pending.annotation,revision:row?.revision||0};
}

/**
 * 저장 1건: 기기 보관(put) → 서버 저장(send) → 보관 삭제(remove) → 남은 대기 조회(list).
 * 실행 중이면 새 저장을 받지 않는다(같은 operation 이중 전송 방지). bump() 뒤의 늦은 응답은
 * 화면 상태를 바꾸지 않는다(과 전환·언마운트).
 */
export function createTextbookSaveRunner(deps) {
 let locked=false,epoch=0;
 const now=deps.now||Date.now;
 return {
  get locked(){return locked;},
  bump(){epoch++;},
  async run(request,{scope,materialId,team},cb={}) {
   if(locked)return 'locked';
   locked=true;cb.start?.();const version=epoch;
   try{
    const id=textbookOperationId(request.operation);
    await deps.put({id,kind:'textbook-annotation',scope,pending:request,createdAt:now(),updatedAt:now()});
    if(version!==epoch)return 'stale';
    cb.pending?.(request);
    await deps.send(materialId,team,request);
    await deps.remove(id);
    if(version!==epoch)return 'stale';
    const remaining=await deps.list(scope);
    await cb.saved?.(remaining[0]?.pending||null);
    return 'saved';
   }catch(error){
    if(version!==epoch)return 'stale';
    cb.failed?.(error);return 'failed';
   }finally{
    locked=false;if(version===epoch)cb.settled?.();
   }
  },
 };
}

/** 팀 페이지 목록: 원문 순서로 놓인 설명, 위치를 다시 확인해야 하는 설명, 보관한 설명. */
export function groupTextbookNotes(json,rows) {
 const placed=[],unplaced=[],archived=[];
 for(const row of rows||[]){
  const location=resolveTextbookAnchor(json,row.anchor);
  if(row.archived)archived.push({row,location});
  else if(location)placed.push({row,location});
  else unplaced.push({row,location:null});
 }
 placed.sort((a,b)=>a.location.start-b.location.start);
 return {placed,unplaced,archived};
}
