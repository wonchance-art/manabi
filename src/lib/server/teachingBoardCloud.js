import {requireUser} from '@/lib/supabaseServer';
import {canTeachClass} from '@/lib/classWorkspace';
import {materialIdValid} from '@/lib/learningSources';
import {fail,checkDb,reply,errorReply} from './learningContext';
import {BOARD_TABLE,BOARD_BUCKET,BOARD_UUID,validBoardDay,validateBoardManifest,unpackBoard,boardPagePath} from '@/lib/teachingBoardCloud';
export {reply,errorReply};
const SELECT='id,owner_id,root_id,day,revision,manifest,updated_at';
export async function teacherBoardAuth(rootId){
 const auth=await requireUser();if(auth.error)fail(auth.status,auth.error);
 if(!materialIdValid('reading',rootId))fail(400,'수업 정보를 확인해 주세요.');
 const {data:root,error}=await auth.supabase.from('reading_materials').select('id,owner_id,processed_json').eq('id',rootId).eq('owner_id',auth.user.id).maybeSingle();checkDb(error);
 if(!canTeachClass(auth.user,root))fail(403,'이 수업의 선생님만 설명판을 열 수 있어요.');return {...auth,root};
}
function cloudError(error){if(!error)return;if(error.code==='40001')fail(409,'다른 기기에서 수정한 설명판이 있어요. 내 필기는 기기에 보관되어 있습니다.');if(['42P01','42883','PGRST202','PGRST205'].includes(error.code))fail(503,'계정 저장을 준비 중이에요. 이 기기의 필기는 계속 보관합니다.');checkDb(error);}
export async function boardBody(request){const text=await request.text();if(new TextEncoder().encode(text).length>20000)fail(413,'설명판 저장 정보를 확인해 주세요.');try{const body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();return body;}catch{fail(400,'설명판 요청을 확인해 주세요.');}}
export function checkDay(day){if(!validBoardDay(day)||day<'1900-01-01'||day>'2200-12-31')fail(400,'수업 날짜를 확인해 주세요.');}
export async function getTeacherBoards(rootId,day){
 const {supabase:db,user}=await teacherBoardAuth(rootId);let q=db.from(BOARD_TABLE).select(day?SELECT:'id,day,updated_at,manifest,revision').eq('owner_id',user.id).eq('root_id',rootId);
 if(day){checkDay(day);const {data,error}=await q.eq('day',day).maybeSingle();cloudError(error);return {board:data};}
 const {data,error}=await q.not('manifest','is',null).order('day',{ascending:false}).limit(100);cloudError(error);
 return {boards:(data||[]).map(b=>({id:b.id,day:b.day,updatedAt:b.updated_at,pages:b.manifest.pages.length})),truncated:(data||[]).length===100};
}
export async function prepareTeacherBoard(body){const {supabase:db}=await teacherBoardAuth(body.rootId);checkDay(body.day);const {data,error}=await db.rpc('teaching_board_prepare',{p_root:body.rootId,p_day:body.day});cloudError(error);return {board:data};}
export async function commitTeacherBoard(body){
 const {supabase:db,user}=await teacherBoardAuth(body.rootId);checkDay(body.day);
 if((body.revision!==null&&!BOARD_UUID.test(body.revision||''))||!BOARD_UUID.test(body.operation||''))fail(400,'설명판 저장 버전을 확인해 주세요.');
 let manifest;try{manifest=validateBoardManifest(body.manifest);}catch(error){fail(400,error.message);}
 const {data:row,error}=await db.from(BOARD_TABLE).select(SELECT).eq('owner_id',user.id).eq('root_id',body.rootId).eq('day',body.day).maybeSingle();cloudError(error);if(!row)fail(404,'설명판을 먼저 준비해 주세요.');
 if(row.revision!==body.revision&&row.revision!==body.operation)fail(409,'다른 기기에서 수정한 설명판이 있어요. 내 필기는 기기에 보관되어 있습니다.');
 try{await unpackBoard(manifest,async p=>{const {data,error}=await db.storage.from(BOARD_BUCKET).download(boardPagePath(user.id,row.id,p.hash));if(error)throw Error('필기 업로드를 확인하지 못했어요. 다시 저장해 주세요.');if(data.size!==p.bytes)throw Error('필기 파일 크기를 확인해 주세요.');return data.text();});}catch(error){fail(400,error.message);}
 // Permission is checked again at the atomic SQL commit, including a revoked root.
 const result=await db.rpc('teaching_board_commit',{p_root:body.rootId,p_day:body.day,p_expected:body.revision,p_operation:body.operation,p_manifest:manifest});cloudError(result.error);return {board:result.data};
}
