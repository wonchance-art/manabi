import {noteAuth,readOwnNote,reply,errorReply} from '@/lib/server/studyNotes';
import {fail} from '@/lib/server/learningContext';
import {noteFromMaterial} from '@/lib/studyNotes';
import {recognitionFingerprint} from '@/lib/noteRecognition';
import {rateLimit} from '@/lib/server/rateLimit';
import {selectedInkBody,selectedInkImage,recognizeSelectedInk} from '@/lib/server/selectedInkRecognition';

export const maxDuration=60;

export async function POST(request,{params}) {
  try {
    const {supabase,user}=await noteAuth(),id=(await params).id;
    const body=await selectedInkBody(request);
    if(!body||body.consent!=='selected-ink-to-gemini')fail(400,'선택한 필기를 Gemini로 보내는 인식을 눌러 주세요.');
    const row=await readOwnNote(supabase,user.id,id),note=noteFromMaterial(row);
    if(body.revision!==row.processed_json.metadata.studyNote.revision)fail(409,'노트가 바뀌었어요. 최신 필기를 다시 선택해 주세요.');
    let fingerprint;
    try{fingerprint=await recognitionFingerprint(note.board.pages.find(page=>page.id===body.pageId),body.elementIds);}catch(error){fail(400,error.message);}
    if(fingerprint!==body.fingerprint)fail(409,'선택한 필기가 바뀌었어요. 다시 선택해 주세요.');
    const image=selectedInkImage(body.image);
    if(!rateLimit(`note-recognize:${user.id}`,{limit:6,windowMs:60_000}).ok)fail(429,'잠시 뒤 다시 인식해 주세요. 한 번에 몇 단어씩 선택하면 좋아요.');
    const expressions=await recognizeSelectedInk(image,note.language,request.signal);
    const latest=await readOwnNote(supabase,user.id,id);
    if(latest.processed_json.metadata.studyNote.revision!==body.revision)fail(409,'인식하는 동안 노트가 바뀌었어요. 최신 필기를 다시 선택해 주세요.');
    return reply({expressions,source:'gemini',revision:body.revision,fingerprint});
  }catch(error){return errorReply(error);}
}
