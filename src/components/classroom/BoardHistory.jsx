import {useEffect,useState} from 'react';
import {BoardIconButton} from './BoardIcon';

// Excalidraw 0.18.1 exposes history.clear(), but no public undo()/redo().
// Forward to its mounted actions so its own history and disabled states remain
// authoritative. The fixture browser test covers the pinned selector contract.
export default function BoardHistory({canvasRoot,pageId,onAction}) {
  const [available,setAvailable]=useState({undo:false,redo:false});
  useEffect(()=>{
    const surface=canvasRoot.current?.querySelector('.teaching-board-surface');
    if(!surface)return;
    const refresh=()=>{
      const next=Object.fromEntries(['undo','redo'].map(action=>[action,!!surface.querySelector(`[data-testid="button-${action}"]:not(:disabled)`)]));
      setAvailable(previous=>previous.undo===next.undo&&previous.redo===next.redo?previous:next);
    };
    const observer=new MutationObserver(refresh);
    observer.observe(surface,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
    refresh();return()=>observer.disconnect();
  },[canvasRoot,pageId]);
  const run=action=>{
    const button=canvasRoot.current?.querySelector(`.teaching-board-surface [data-testid="button-${action}"]:not(:disabled)`);
    if(button){button.click();onAction?.();}
  };
  return <div className="board-icon-grid" role="group" aria-label="필기 실행 기록">{[['undo','실행 취소'],['redo','다시 실행']].map(([action,label])=><BoardIconButton key={action} icon={action} label={label} disabled={!available[action]} onClick={()=>run(action)}/>)}</div>;
}
