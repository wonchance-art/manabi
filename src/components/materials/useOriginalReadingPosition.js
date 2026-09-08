'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@/lib/AuthContext';
import {supabase} from '@/lib/supabase';
import {createOriginalPositionSession} from '@/lib/originalReadingPosition';

export default function useOriginalReadingPosition(material,sources,enabled=true){
 const {user}=useAuth();
 const session=useRef(null),current=useRef(null);
 const signature=JSON.stringify(sources);
 const [state,setState]=useState({ready:false,phase:'loading',records:[],local:{}});
 useEffect(()=>{
  if(!enabled||user?.id!==material.owner_id){setState({ready:!enabled,phase:'loading',records:[],local:{}});return;}
  let storage=null;try{storage=window.localStorage;}catch{/* Cloud sync still works without local storage. */}
  const manager=createOriginalPositionSession({client:supabase,ownerId:user.id,materialId:material.id,sources:JSON.parse(signature),storage,onChange:setState});
  session.current=manager;current.current=null;setState(manager.snapshot());void manager.refresh();
  const refresh=()=>{if(document.visibilityState==='visible')void manager.refresh();};
  const flush=()=>{if(document.visibilityState==='hidden')void manager.flush();else refresh();};
  window.addEventListener('online',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',flush);
  window.addEventListener('pagehide',manager.flush);
  return()=>{window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',flush);window.removeEventListener('pagehide',manager.flush);manager.dispose();if(session.current===manager)session.current=null;};
 },[enabled,user?.id,material.owner_id,material.id,signature]);
 const note=useCallback((source,locator,save=true)=>{current.current={source,locator};if(save&&document.visibilityState==='visible')session.current?.record(source,locator);},[]);
 const selected=useCallback(key=>session.current?.selected(key),[]);
 const accept=useCallback(()=>session.current?.acceptRemote(),[]);
 const keep=useCallback(()=>{const point=current.current;if(point)session.current?.keepCurrent(point.source,point.locator);},[]);
 const retry=useCallback(()=>session.current?.refresh(),[]);
 return {state,note,selected,accept,keep,retry};
}
