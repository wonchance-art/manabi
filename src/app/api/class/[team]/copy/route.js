import {createHash} from 'node:crypto';
import {authorizeTeamRequest} from '../route';
import {requireUser} from '@/lib/server/auth';
import {classCopyUpdatePlan,stableJson} from '@/lib/classCopyModel';

export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
const reply=(data,status=200)=>Response.json(data,{status,headers});
const revision=value=>createHash('sha256').update(stableJson(value)).digest('hex');
export async function POST(request,{params}){
  try{
    const auth=await requireUser(request);if(auth.error)return reply({error:auth.error},auth.status);
    const {team}=await params,access=await authorizeTeamRequest(request,team);if(access.error)return access.error;
    const raw=await request.text();if(raw.length>4000)return reply({error:'요청이 너무 커요.'},413);
    let body;try{body=JSON.parse(raw);}catch{return reply({error:'요청을 확인해 주세요.'},400);}
    if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'요청을 확인해 주세요.'},400);
    if(!/^[1-9][0-9]{0,15}$/.test(String(body.sourceId||''))||!['open','inspect','update'].includes(body.action))return reply({error:'자료를 다시 선택해 주세요.'},400);
    if(body.preferred!=null&&!/^[1-9][0-9]{0,15}$/.test(String(body.preferred)))return reply({error:'사본을 다시 선택해 주세요.'},400);
    const args={p_owner:auth.user.id,p_root:access.root.id,p_generation:access.team.pwGen,p_source:String(body.sourceId),p_create:body.action==='open',p_preferred:body.preferred||null};
    const {data:state,error}=await access.admin.rpc('classroom_copy_state',args);if(error)throw error;
    if(!state)return reply({error:'자료를 확인하지 못했어요.'},503);
    if(state.state==='choose'||state.state==='missing')return reply(state);
    if(state.copy?.owner_id!==auth.user.id)return reply({error:'내 자료를 확인하지 못했어요.'},403);
    const corrections=[];
    for(let from=0;;from+=500){
      const {data,error:readError}=await access.admin.from('token_corrections').select('token_id,after_value').eq('material_id',state.copy.id).order('created_at',{ascending:false}).order('id').range(from,from+499);
      if(readError)throw readError;if(!Array.isArray(data))throw new Error('교정 이력을 확인하지 못했어요.');
      corrections.push(...data);if(data.length<500)break;
    }
    const plan=classCopyUpdatePlan(state.copy,state.base,state.source,corrections),copyRevision=revision(state.copy);
    if(body.action==='update'){
      if(body.copyRevision!==copyRevision||body.sourceRevision!==state.sourceRevision)return reply({error:'확인하는 동안 내용이 바뀌었어요. 다시 확인해 주세요.'},409);
      if(plan.state!=='update')return reply({error:plan.reason||'이미 최신 내용이에요.'},409);
      const {data:updated,error:updateError}=await access.admin.rpc('classroom_update_copy',{p_owner:args.p_owner,p_root:args.p_root,p_generation:args.p_generation,p_source:args.p_source,p_expected:state.copy,p_source_revision:state.sourceRevision,p_next:plan.material});
      if(updateError)throw updateError;
      return reply({state:'current',copyId:updated.id});
    }
    return reply({state:plan.state,copyId:state.copy.id,title:state.copy.title,summary:plan.summary,reason:plan.reason,
      copyRevision,sourceRevision:state.sourceRevision,preview:state.source.raw_text.slice(0,6000)});
  }catch(error){
    const missing=error?.code==='PGRST202'||error?.code==='42P01';
    return reply({error:missing?'안전한 자료 보관 기능을 준비 중이에요. 잠시 후 다시 열어 주세요.':error?.code==='40001'?'내용이 바뀌었어요. 다시 확인해 주세요.':error?.code==='42501'?'수업 접근 권한을 다시 확인해 주세요.':'자료를 처리하지 못했어요. 기존 자료는 유지됩니다.'},missing?503:error?.code==='40001'?409:error?.code==='42501'?403:500);
  }
}
