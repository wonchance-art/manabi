import {authorizeTeamRequest} from '../route';
import {requireUser} from '@/lib/server/auth';
import {materialBelongsToTeam,revisionOf} from '@/lib/server/classIndex';
import {preserveClassEntryValues} from '@/lib/reanalysisPreservation';
import {resolveReadingSelection,fail,reply,errorReply,checkDb} from '@/lib/server/learningContext';
import {UUID,materialIdValid} from '@/lib/learningSources';
import {gradeToInitialStats} from '@/lib/fsrs';

export const runtime='nodejs';
async function access(request,params){
  const auth=await requireUser(request);if(auth.error)fail(auth.status,auth.error);
  const {team}=await params,scope=await authorizeTeamRequest(request,team);
  return {...scope,user:auth.user,key:team};
}
async function original(scope,id){
  if(!materialIdValid('reading',id)||String(id).length>16)fail(400,'자료를 다시 선택해 주세요.');
  const {data,error}=await scope.admin.from('reading_materials').select('*').eq('id',id).eq('owner_id',scope.root.owner_id).maybeSingle();
  checkDb(error);
  if(!materialBelongsToTeam(data,scope.team,scope.root))fail(404,'이 수업에서 열 수 없는 자료예요.');
  return data;
}
export async function POST(request,{params}){
  try{
    const scope=await access(request,params);if(scope.error)return scope.error;
    const raw=await request.text();if(raw.length>16000)fail(413,'선택한 표현이 너무 길어요.');
    const body=JSON.parse(raw),source=body?.source;
    if(!source||source.kind!=='class'||source.team!==scope.key)fail(400,'수업 자료에서 표현을 다시 선택해 주세요.');
    if(body.grade!=null&&(!Number.isInteger(body.grade)||body.grade<1||body.grade>4))fail(400,'저장 등급을 확인해 주세요.');
    if(body.confirmId&&!UUID.test(body.confirmId))fail(400,'기존 단어를 다시 확인해 주세요.');
    const row=await original(scope,source.materialId);
    if(source.revision!==revisionOf(row))fail(409,'선생님이 자료를 수정했어요. 새로고침 후 뜻을 확인하고 다시 담아 주세요.');
    const material={...row,processed_json:preserveClassEntryValues(row.raw_text,row.processed_json||{})};
    const saved=resolveReadingSelection(material,source,body.word||{});
    const resolved={kind:'class',quote:saved.source.quote,translation:saved.word.meaning,
      locator:{...saved.source.locator,team:scope.key,materialId:String(row.id)}};
    const {data,error}=await scope.admin.rpc('classroom_save_vocabulary',{
      p_owner:scope.user.id,p_root:scope.root.id,p_generation:scope.team.pwGen,p_material:row.id,
      p_expected_raw:row.raw_text,p_expected_json:row.processed_json,p_word:saved.word,p_source:resolved,
      p_initial:body.grade?gradeToInitialStats(body.grade):null,p_confirm_id:body.confirmId||null,p_confirm_meaning:body.confirmMeaning??null,
    });
    if(error?.message?.includes('vocabulary_meaning_conflict')){
      if(!UUID.test(error.details||''))throw error;
      const found=await scope.admin.from('user_vocabulary').select('id,meaning').eq('user_id',scope.user.id).eq('id',error.details).maybeSingle();checkDb(found.error);
      return reply({error:'기존 뜻을 확인해 주세요.',code:'meaning_conflict',existing:found.data,incomingMeaning:saved.word.meaning},409);
    }
    if(error?.message?.includes('vocabulary_language_conflict'))return reply({error:'같은 표기의 다른 언어 카드가 있어요. 기존 카드를 합치지 않았습니다.',code:'language_conflict'},409);
    if(error?.message?.includes('vocabulary_ambiguous_match'))return reply({error:'기존 카드가 여러 개예요. 단어장에서 중복을 확인해 주세요.',code:'ambiguous_match'},409);
    if(error?.code==='40001')fail(409,'저장하는 동안 원문이 바뀌었어요. 새로고침 후 다시 담아 주세요.');
    if(error?.code==='42501')fail(403,'수업 접근 권한을 다시 확인해 주세요.');
    checkDb(error);return reply(data);
  }catch(error){return errorReply(error);}
}
export async function GET(request,{params}){
  try{
    const scope=await access(request,params);if(scope.error)return scope.error;
    const query=new URL(request.url).searchParams,id=query.get('contextId');
    if(!UUID.test(id||''))fail(400,'저장한 문맥을 다시 선택해 주세요.');
    const {data:context,error}=await scope.admin.from('vocabulary_contexts').select('id,kind,locator,quote').eq('id',id).eq('user_id',scope.user.id).maybeSingle();checkDb(error);
    if(context?.kind!=='class'||context.locator?.team!==scope.key||String(context.locator.materialId)!==query.get('materialId'))fail(404,'접근할 수 없는 문맥입니다.');
    await original(scope,context.locator.materialId);
    return reply({context});
  }catch(error){return errorReply(error);}
}
