import {supabase} from './supabase';
import {readUnlock} from './classClient';
export async function requestTextbookAnnotations(id,team,body){
 const {data,error}=await supabase.auth.getSession();if(error)throw error;
 const token=data?.session?.access_token,unlock=team?readUnlock(team):null;
 const response=await fetch(`/api/materials/${encodeURIComponent(id)}/annotations${team?`?team=${encodeURIComponent(team)}`:''}`,{method:body?'POST':'GET',cache:'no-store',headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(unlock?{'x-class-token':unlock.token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json();
 if(!response.ok)throw Object.assign(new Error(result.error||'주의점을 불러오지 못했어요.'),{status:response.status,conflict:!!result.conflict});
 return result;
}
