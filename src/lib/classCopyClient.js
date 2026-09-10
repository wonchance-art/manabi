import {supabase} from './supabase';
import {readUnlock} from './classClient';

export async function requestClassCopy(team,sourceId,action='open',options={}){
  const {data,error}=await supabase.auth.getSession();
  if(error||!data?.session)throw new Error('로그인 후 다시 열어 주세요.');
  const unlock=readUnlock(team);if(!unlock)throw Object.assign(new Error('수업 암호를 다시 입력해 주세요.'),{status:401});
  const response=await fetch(`/api/class/${encodeURIComponent(team)}/copy`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`,'x-class-token':unlock.token},body:JSON.stringify({sourceId,action,...options})});
  const result=await response.json();
  if(!response.ok)throw Object.assign(new Error(result?.error||'자료를 불러오지 못했어요.'),{status:response.status});
  return result;
}
export function studentReaderHref(copyId,team,day){
  const back=`/class/${team}${day?`?day=${day}`:''}`;
  return `/viewer/${copyId}?${new URLSearchParams({returnTo:back})}`;
}
