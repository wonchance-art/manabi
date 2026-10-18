'use client';
import {useEffect,useState} from 'react';

// 서재 칸의 「지난번 0개」 기기 기억(2026-10-17 KST 실측 — 골격이 섰다가 0개 모양으로 바뀌며 아래 칸이 올라가던 자리).
// 받은 결과(있음 '1' / 없음 '0')를 계정 · 칸별로 이 기기에 남기고, 지난번 0개였으면 받는 동안 그 칸의 0개 모양을 미리 그린다
// (읽던 곳 = 칸 없음, 대화 = 「새 대화」 입구 + 안내 한 줄). 새 기기 · 있었던 계정 · 저장소를 못 쓰면 지금처럼 골격.
// 서버가 그린 서재(ssr — serverUserId)는 첫 그림이 서버 HTML과 같아야 해(hydration) 기록을 읽지 않는다.
export const shelfHintKey=(name,ownerId)=>`library-${name}-seen:${ownerId}`;
function readHint(key){try{return window.localStorage.getItem(key);}catch{return null;}}

/** @returns {boolean} true = 지난번 0개 — 받는 동안 0개 모양을 그린다 */
export function useShelfEmptyHint(name,ownerId,ssr,query,count){
 const key=ownerId?shelfHintKey(name,ownerId):null;
 const [hint]=useState(()=>!key||ssr||typeof window==='undefined'?null:readHint(key));
 const seen=key&&query.isSuccess?(count>0?'1':'0'):null;
 useEffect(()=>{if(seen)try{window.localStorage.setItem(key,seen);}catch{/* 힌트일 뿐 — 없으면 골격 */}},[key,seen]);
 return hint==='0';
}
