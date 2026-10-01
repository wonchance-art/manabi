'use client';
import {useSearchParams} from 'next/navigation';
import {useState} from 'react';
import {libraryKey} from '@/lib/personalLibrary';
import {libraryOutline,libraryOutlineHref} from '@/lib/libraryOutline';

export default function useLibraryOutline(row) {
 const params=useSearchParams(),key=libraryKey(row);
 const savedCount=libraryOutline(params.get('outline'))[key];
 const [loadedCount,setLoadedCount]=useState(20),count=Math.max(savedCount||20,loadedCount);
 const update=(expanded,size=count)=>{
  const href=libraryOutlineHref(window.location.pathname+window.location.search,key,expanded,size);
  // Next synchronizes useSearchParams for an external history call with null state.
  window.history.replaceState(null,'',href);
 };
 return [!!savedCount,expanded=>update(expanded),count,size=>{setLoadedCount(size);update(true,size);}];
}
