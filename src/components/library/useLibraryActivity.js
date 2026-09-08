'use client';
import {useEffect,useRef} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/lib/AuthContext';
import {supabase} from '@/lib/supabase';
import {recordLibraryOpen} from '@/lib/libraryActivity';
// Only mounted, successful reading surfaces call this hook. List prefetch never writes.
export default function useLibraryActivity(activity,ready,elementRef=null){
 const {user}=useAuth();
 const cache=useQueryClient();
 const signature=activity?JSON.stringify(activity):'';
 const last=useRef('');
 useEffect(()=>{
  if(!ready||!user||!signature)return;
  const key=`${user.id}:${signature}`;
  if(last.current===key)return;
  let stopped=false;
  const record=()=>{
   if(document.visibilityState!=='visible'||stopped||last.current===key)return;
   if(elementRef?.current){const rect=elementRef.current.getBoundingClientRect();if(rect.bottom<=0||rect.top>=window.innerHeight)return;}
   last.current=key;
   recordLibraryOpen(supabase,user.id,JSON.parse(signature)).then(()=>{
    // A slow write may finish after the reader has already returned to the shelf.
    cache.invalidateQueries({queryKey:['library-recent',user.id]});
    cache.invalidateQueries({queryKey:['personal-library',user.id]});
   }).catch(()=>{if(last.current===key)last.current='';});
  };
  // Wait for a visible frame; background preloads cannot become recent reads.
  const frame=requestAnimationFrame(record);
  const observer=elementRef?.current&&typeof IntersectionObserver!=='undefined'?new IntersectionObserver(record):null;
  if(observer)observer.observe(elementRef.current);
  document.addEventListener('visibilitychange',record);
  return()=>{stopped=true;observer?.disconnect();cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',record);};
 },[ready,user,signature,elementRef,cache]);
}
