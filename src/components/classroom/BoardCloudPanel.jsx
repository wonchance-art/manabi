'use client';
import {useState} from 'react';
import BoardHistoryBrowser from './BoardHistoryBrowser';

export default function BoardCloudPanel({owner,mode,active,rootId,day,store,onBackup,onBeforeAction,onOpen,pages=[],onCopy,onPick}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const act=async fn=>{if(busy)return;setBusy(true);setError('');try{onBeforeAction();await store.flush?.();await fn();}catch(e){setError(e.message);}finally{setBusy(false);}};
 if(mode==='status')return <div className="board-cloud-panel"><p role="status"><strong>{store.label}</strong></p>{store.updatedAt&&<p>마지막 계정 저장 · {new Date(store.updatedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</p>}<p>{store.localSaved?'이 기기에도 필기를 보관하고 있어요.':'기기 저장 상태를 확인해 주세요.'}</p><div className="board-cloud-actions"><button disabled={busy||store.conflict} onClick={()=>act(()=>store.sync())}>지금 저장</button><button onClick={onBackup}>백업 내려받기</button><button disabled={busy} onClick={()=>act(()=>store.reload())}>{store.conflict?'내 초안 보관 후 최신 판 열기':'최신 판 확인'}</button></div>{error&&error!==store.error&&<p role="alert">{error}</p>}</div>;
 return <BoardHistoryBrowser owner={owner} active={active} rootId={rootId} day={day} store={store} pages={pages} onCopy={onCopy} onPick={onPick} onOpen={nextDay=>act(()=>onOpen(nextDay))} busy={busy} actionError={error}/>;
}
