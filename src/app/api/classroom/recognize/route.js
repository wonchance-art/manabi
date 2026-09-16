import {requireUser} from '@/lib/supabaseServer';
import {canTeachClass} from '@/lib/classWorkspace';
import {getTeam,TEAM_KEY_RE} from '@/lib/classBoard';
import {BOARD_LANGUAGES} from '@/lib/teachingBoard';
import {materialIdValid} from '@/lib/learningSources';
import {fail,checkDb,reply,errorReply} from '@/lib/server/learningContext';
import {selectedInkBody,selectedInkImage,recognizeSelectedInk} from '@/lib/server/selectedInkRecognition';
import {rateLimit} from '@/lib/server/rateLimit';

export const maxDuration=60;

async function teacherTeam(db,user,body) {
  if(!materialIdValid('reading',body.rootId)||!TEAM_KEY_RE.test(body.teamKey||''))fail(400,'수업 정보를 확인해 주세요.');
  const {data:root,error}=await db.from('reading_materials').select('id,owner_id,processed_json')
    .eq('id',body.rootId).eq('owner_id',user.id).maybeSingle();
  checkDb(error);
  const team=getTeam(root?.processed_json?.metadata);
  if(!canTeachClass(user,root)||team?.key!==body.teamKey)fail(403,'이 수업의 선생님만 필기를 인식할 수 있어요.');
  if(!BOARD_LANGUAGES.includes(team.lang))fail(400,'수업 언어를 확인해 주세요.');
  return team;
}

export async function POST(request) {
  try {
    const auth=await requireUser();if(auth.error)fail(auth.status,auth.error);
    const body=await selectedInkBody(request);
    if(!body||body.consent!=='selected-ink-to-gemini')fail(400,'선택한 필기를 Gemini로 보내는 인식을 눌러 주세요.');
    const team=await teacherTeam(auth.supabase,auth.user,body);
    // This board lives on the device. The hash is an opaque response binding,
    // not proof of a server document. The client checks selected ink again.
    if(!/^[a-f0-9]{64}$/.test(body.fingerprint||''))fail(400,'선택한 필기를 다시 확인해 주세요.');
    const image=selectedInkImage(body.image);
    if(!rateLimit(`class-ink:${auth.user.id}`,{limit:6,windowMs:60_000}).ok)fail(429,'잠시 뒤 다시 인식해 주세요.');
    const expressions=await recognizeSelectedInk(image,team.lang,request.signal,'class-ink-recognize');
    const latest=await teacherTeam(auth.supabase,auth.user,body);
    if(latest.lang!==team.lang)fail(409,'수업 언어가 바뀌었어요. 최신 수업에서 다시 선택해 주세요.');
    return reply({expressions,source:'gemini',fingerprint:body.fingerprint});
  }catch(error){return errorReply(error);}
}
