'use client';
import {Noto_Serif_SC} from 'next/font/google';
import {useEffect} from 'react';
// This chunk is imported only when a Chinese reader chooses serif; no site-wide preload.
const serif=Noto_Serif_SC({weight:['400','600'],subsets:['latin'],display:'swap',preload:false});
export default function ChineseSerif({rootRef,onStatus}) {
  useEffect(()=>{
    let live=true;const root=rootRef.current?.closest('.viewer-layout');
    if(!root)return;
    onStatus('loading');
    root.style.setProperty('--font-reader-serif',serif.style.fontFamily);
    document.fonts.load(`26px ${serif.style.fontFamily.split(',')[0]}`,'读书').then(fonts=>{if(live){onStatus(fonts.length?'ready':'error');if(!fonts.length)root.style.removeProperty('--font-reader-serif');}}).catch(()=>{if(live){onStatus('error');root.style.removeProperty('--font-reader-serif');}});
    return ()=>{live=false;root.style.removeProperty('--font-reader-serif');};
  },[rootRef,onStatus]);
  return null;
}
