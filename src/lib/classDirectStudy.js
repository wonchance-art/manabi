'use client';
import {supabase} from './supabase';
import {readUnlock,fetchTeamMaterial} from './classClient';
import {getSharedCopy,putSharedCopy} from './sharedStore';
import {TEAM_KEY_RE,parseLocalId} from './classBoard';

export async function readClassMaterial(id,team){
  if(!TEAM_KEY_RE.test(team||'')||!readUnlock(team))throw Object.assign(new Error('수업 암호를 다시 확인해 주세요.'),{code:'CLASS_ACCESS'});
  const sourceId=parseLocalId(id);
  if(!sourceId)throw new Error('자료 주소를 확인해 주세요.');
  let material;
  if(typeof navigator!=='undefined'&&navigator.onLine===false){
    const cached=await getSharedCopy(sourceId);
    if(cached?.team!==team)throw new Error('온라인에서 수업 자료를 먼저 열어 주세요.');
    material=cached.material;
  }else{
    // Online always revalidates membership and password generation. Never fall
    // back to a cached source after a revoked capability or missing material.
    material=await fetchTeamMaterial(team,readUnlock(team).token,sourceId);
    await putSharedCopy({id:material.id,team,material,contentRevision:material.contentRevision,updatedAt:material.updatedAt});
  }
  return {...material,__local:true,__team:team,__classSource:true};
}
export async function classVocabularyRequest(team,{method='POST',payload,query,signal}={}){
  const unlock=readUnlock(team);if(!unlock)throw new Error('수업 암호를 다시 입력해 주세요.');
  const {data,error}=await supabase.auth.getSession();
  if(error||!data?.session)throw new Error('로그인 후 다시 담아 주세요.');
  const response=await fetch(`/api/class/${encodeURIComponent(team)}/vocabulary${query?'?'+new URLSearchParams(query):''}`,{
    method,cache:'no-store',signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`,'x-class-token':unlock.token},
    ...(payload?{body:JSON.stringify(payload)}:{}),
  });
  const result=await response.json();
  if(!response.ok)throw Object.assign(new Error(result.error||'단어를 저장하지 못했어요.'),result,{status:response.status});
  return result;
}
export const classPositionKey=(owner,team,id)=>`manabi-class-position:${owner||'guest'}:${team}:${id}`;
export function readClassPosition(owner,team,id){try{return JSON.parse(localStorage.getItem(classPositionKey(owner,team,id))||'null');}catch{return null;}}
