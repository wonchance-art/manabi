import {createClient} from '@supabase/supabase-js';
import {requireUser} from '@/lib/server/auth';
import {serviceClient,materialBelongsToTeam} from '@/lib/server/classIndex';
import {authorizeTeamRequest} from '@/app/api/class/[team]/route';
import {validTextbookAnchor} from '@/lib/textbookAnnotations';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
const respond=(data,status=200)=>Response.json(data,{status,headers});
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
async function access(request,id,write=false) {
 if(!/^\d+$/.test(id))return {error:respond({error:'자료를 찾을 수 없어요.'},404)};
 const auth=request.headers.get('authorization')?await requireUser(request):{};
 if(auth.error)return {error:respond({error:auth.error},auth.status)};
 const scoped=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false},global:{headers:auth.user?{Authorization:request.headers.get('authorization')}:{}}});
 const result=await scoped.from('reading_materials').select('id,owner_id,processed_json').eq('id',id).maybeSingle();
 if(result.error)throw result.error;
 let material=result.data;
 const admin=serviceClient();
 // Only the canonical mapping verified on class receipt can identify a source. Never trust source_ref.
 const mapping=auth.user?await admin.from('class_material_copies').select('source_material_id').eq('owner_id',auth.user.id).eq('copy_material_id',id).maybeSingle():{data:null};
 if(mapping.error)throw mapping.error;
 let sourceReadable=false;
 if(mapping.data){const sourceRead=await scoped.from('reading_materials').select('id,owner_id,processed_json').eq('id',mapping.data.source_material_id).maybeSingle();if(sourceRead.error)throw sourceRead.error;
  if(sourceRead.data&&String(sourceRead.data.id)===String(mapping.data.source_material_id)){material=sourceRead.data;sourceReadable=true;}
 }
 if(!material||(mapping.data&&!sourceReadable)){
  const team=new URL(request.url).searchParams.get('team');
  if(!team||write)return {error:respond({error:'수업 페이지에서 교재를 다시 열어 주세요.'},403)};
  const capability=await authorizeTeamRequest(request,team);
  if(capability.error)return {error:capability.error};
  const source=await admin.from('reading_materials').select('id,owner_id,processed_json').eq('id',mapping.data?.source_material_id||id).maybeSingle();
  if(source.error)throw source.error;
  if(!materialBelongsToTeam(source.data,capability.team,capability.root))return {error:respond({error:'교재 접근 권한이 없어요.'},403)};
  material=source.data;
 }
 const canEdit=!!auth.user&&material.owner_id===auth.user.id&&!mapping.data;
 if(write&&!canEdit)return {error:respond({error:'교재 소유자만 주의점을 편집할 수 있어요.'},403)};
 return {admin,material,user:auth.user,canEdit};
}
export async function GET(request,{params}) {
 try {
  const {id}=await params,a=await access(request,id);if(a.error)return a.error;
  const rows=await a.admin.from('textbook_annotations').select('*').eq('material_id',a.material.id).order('created_at');
  if(rows.error)throw rows.error;
  let history=[];
  if(a.canEdit&&rows.data.length){const h=await a.admin.from('textbook_annotation_revisions').select('annotation_id,snapshot,created_at').in('annotation_id',rows.data.map(r=>r.id)).order('created_at',{ascending:false}).limit(200);if(h.error)throw h.error;history=h.data;}
  return respond({materialId:String(a.material.id),canEdit:a.canEdit,annotations:rows.data,history});
 }catch{return respond({error:'교재 주의점을 불러오지 못했어요. 다시 시도해 주세요.'},503);}
}
export async function POST(request,{params}) {
 try {
  const {id}=await params,a=await access(request,id,true);if(a.error)return a.error;
  const raw=await request.text();if(raw.length>12000)return respond({error:'입력이 너무 길어요.'},413);
  let body;try{body=JSON.parse(raw);}catch{return respond({error:'입력을 확인해 주세요.'},400);}
  const {operation,annotation}=body||{};
  if(!uuid(operation)||!uuid(annotation?.id)||!Number.isInteger(annotation.revision)||annotation.revision<0||typeof annotation.body!=='string'||annotation.body.trim().length<1||annotation.body.length>2000||typeof annotation.archived!=='boolean')return respond({error:'주의점 입력을 확인해 주세요.'},400);
  // A replay can succeed after later text changes; the RPC still verifies its exact request and actor.
  const replay=await a.admin.from('textbook_annotation_revisions').select('operation_id').eq('operation_id',operation).maybeSingle();if(replay.error)throw replay.error;
  if(!replay.data&&!validTextbookAnchor(a.material.processed_json,annotation.anchor))return respond({error:'교재의 해당 위치가 바뀌었어요. 다시 지정해 주세요.'},409);
  const {data,error}=await a.admin.rpc('save_textbook_annotation',{p_actor:a.user.id,p_material:a.material.id,p_operation:operation,p_request:annotation,p_expected_text:{sequence:a.material.processed_json.sequence,dictionary:a.material.processed_json.dictionary}});
  if(error)return respond({error:error.code==='40001'?'다른 수정이 있어요. 최신 내용을 확인한 후 새 수정으로 저장해 주세요.':'저장하지 못했어요. 같은 요청으로 다시 확인해 주세요.',conflict:error.code==='40001'},error.code==='40001'?409:503);
  return respond({annotation:data});
 }catch{return respond({error:'저장 응답을 확인하지 못했어요. 재시도로 확인해 주세요.'},503);}
}
