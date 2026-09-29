'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {exportToSvg,getCommonBounds} from '@excalidraw/excalidraw';
import {fragmentAtPoint,fragmentInArea} from '../../lib/teachingBoardFragment';

export default function BoardFragmentSurface({elements,units,selectedIds,mode,disabled,onToggle,onArea,fitVersion}) {
  const host=useRef(null),svg=useRef(null),pointers=useRef(new Map()),gesture=useRef(null),viewRef=useRef(null);
  const [url,setUrl]=useState(''),[failed,setFailed]=useState(false),[view,setView]=useState(null),[area,setArea]=useState(null);
  const bounds=useMemo(()=>elements.length?getCommonBounds(elements):[0,0,600,400],[elements]);
  const visibleIds=useMemo(()=>new Set(selectedIds),[selectedIds]);
  const show=useCallback(next=>{viewRef.current=next;setView(next);},[]);
  const fit=useCallback(()=>{
    const rect=host.current?.getBoundingClientRect();if(!rect?.width||!rect.height)return;
    const scale=Math.min(1.5,(rect.width-48)/Math.max(1,bounds[2]-bounds[0]),(rect.height-48)/Math.max(1,bounds[3]-bounds[1]));
    show({x:(bounds[0]+bounds[2])/2-rect.width/(2*scale),y:(bounds[1]+bounds[3])/2-rect.height/(2*scale),scale,width:rect.width,height:rect.height});
  },[bounds,show]);
  useEffect(()=>{const observer=new ResizeObserver(fit);observer.observe(host.current);fit();return()=>observer.disconnect();},[fit,fitVersion]);
  useEffect(()=>{
    let alive=true,objectUrl='';setUrl('');setFailed(false);
    if(elements.length)exportToSvg({elements,files:null,exportPadding:0,appState:{exportBackground:false,exportWithDarkMode:false}}).then(value=>{
      if(!alive)return;objectUrl=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(value)],{type:'image/svg+xml'}));setUrl(objectUrl);
    }).catch(()=>{if(alive)setFailed(true);});
    return()=>{alive=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[elements]);
  const point=event=>{const rect=host.current.getBoundingClientRect(),v=viewRef.current;return {x:v.x+(event.clientX-rect.left)/v.scale,y:v.y+(event.clientY-rect.top)/v.scale};};
  const pair=()=>{const [a,b]=[...pointers.current.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};};
  const down=event=>{
    if(disabled||!viewRef.current||!url||event.button>0)return;
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.current.size===2){gesture.current={type:'pinch',pair:pair(),view:{...viewRef.current}};setArea(null);return;}
    if(pointers.current.size>1)return;
    gesture.current={type:mode,start:point(event),client:{x:event.clientX,y:event.clientY},view:{...viewRef.current}};
  };
  const move=event=>{
    if(!pointers.current.has(event.pointerId)||disabled)return;
    pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});const g=gesture.current;if(!g||g.type==='cancelled')return;
    if(g.type==='pinch'){
      if(pointers.current.size<2)return;const p=pair(),rect=host.current.getBoundingClientRect(),scale=Math.max(.02,Math.min(4,g.view.scale*p.distance/g.pair.distance));
      show({...g.view,scale,x:g.view.x+(g.pair.x-rect.left)/g.view.scale-(p.x-rect.left)/scale,y:g.view.y+(g.pair.y-rect.top)/g.view.scale-(p.y-rect.top)/scale});
    }else if(g.type==='hand')show({...g.view,x:g.view.x-(event.clientX-g.client.x)/g.view.scale,y:g.view.y-(event.clientY-g.client.y)/g.view.scale});
    else{const p=point(event);setArea([Math.min(p.x,g.start.x),Math.min(p.y,g.start.y),Math.max(p.x,g.start.x),Math.max(p.y,g.start.y)]);}
  };
  const up=(event,cancel=false)=>{
    if(!pointers.current.has(event.pointerId))return;
    const g=gesture.current;pointers.current.delete(event.pointerId);
    if(!cancel&&!disabled&&g?.type==='select'){
      const p=point(event);
      if(Math.hypot(event.clientX-g.client.x,event.clientY-g.client.y)<6){const id=fragmentAtPoint(units,p,5/viewRef.current.scale);if(id)onToggle(id);}
      else onArea(fragmentInArea(units,[Math.min(g.start.x,p.x),Math.min(g.start.y,p.y),Math.max(g.start.x,p.x),Math.max(g.start.y,p.y)]));
    }
    if(!pointers.current.size)gesture.current=null;else if(cancel)gesture.current={type:'cancelled'};
    setArea(null);
  };
  useEffect(()=>{
    const el=host.current;
    const wheel=event=>{if(disabled||!viewRef.current)return;event.preventDefault();const v=viewRef.current;
      if(event.ctrlKey||event.metaKey){const rect=el.getBoundingClientRect(),scale=Math.max(.02,Math.min(4,v.scale*Math.exp(-event.deltaY*.01)));show({...v,scale,x:v.x+(event.clientX-rect.left)/v.scale-(event.clientX-rect.left)/scale,y:v.y+(event.clientY-rect.top)/v.scale-(event.clientY-rect.top)/scale});}
      else show({...v,x:v.x+event.deltaX/v.scale,y:v.y+event.deltaY/v.scale});};
    el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
  },[disabled,show]);
  return <div ref={host} className="board-fragment-surface" data-tool={mode}>
    {failed?<p role="alert">미리보기를 표시하지 못했어요. ‘목록으로 선택’에서 내용을 고를 수 있어요.</p>:!url&&<p role="status">미리보기 준비 중…</p>}
    {view&&<svg ref={svg} aria-label="지난 설명판 선택 영역" role="img" viewBox={`${view.x} ${view.y} ${view.width/view.scale} ${view.height/view.scale}`} onPointerDown={down} onPointerMove={move} onPointerUp={event=>up(event)} onPointerCancel={event=>up(event,true)}>
      {url&&<image href={url} x={bounds[0]} y={bounds[1]} width={Math.max(1,bounds[2]-bounds[0])} height={Math.max(1,bounds[3]-bounds[1])} onError={()=>setFailed(true)}/>}
      {units.filter(unit=>unit.ids.some(id=>visibleIds.has(id))).map(unit=><rect key={unit.id} className="board-fragment-selected" x={unit.bounds[0]-4/view.scale} y={unit.bounds[1]-4/view.scale} width={Math.max(1,unit.bounds[2]-unit.bounds[0])+8/view.scale} height={Math.max(1,unit.bounds[3]-unit.bounds[1])+8/view.scale} rx={4/view.scale} vectorEffect="non-scaling-stroke"/>)}
      {area&&<rect className="board-fragment-area" x={area[0]} y={area[1]} width={area[2]-area[0]} height={area[3]-area[1]} vectorEffect="non-scaling-stroke"/>}
    </svg>}
  </div>;
}
