import {revalidatePath} from 'next/cache';
import {requireAdmin} from '@/lib/supabaseServer';
import {BOOK_ID,isBookId,validateManuscript,withCandidateMetadata} from '@/lib/textbook/contract';
import {candidate,currentCandidate,editorCandidates,contentHash,readEdition,readRelease,respond,respondError,textbookError} from '@/lib/textbook/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const validVersion=v=>v===null||(Number.isSafeInteger(v)&&v>0);
async function readDraft(db,bookId){const {data,error}=await db.from('textbook_book_drafts').select('manuscript,content_hash,version,updated_at').eq('book_id',bookId).maybeSingle();if(error)throw textbookError(503,'초안 저장소를 불러오지 못했어요.');return data}
export async function GET(request,{bookId=BOOK_ID}={}){const auth=await requireAdmin();if(auth.error)return respond({error:auth.error},auth.status);try{
 if(!isBookId(bookId))throw textbookError(404,'교재를 찾을 수 없어요.');
 const [choices,draft,release,history]=await Promise.all([editorCandidates(bookId),readDraft(auth.supabase,bookId),readRelease(auth.supabase,bookId),auth.supabase.from('textbook_book_editions').select('edition_id,content_hash,published_at').eq('book_id',bookId).order('published_at',{ascending:false})]);
 if(history.error)throw textbookError(503,'판본 기록을 불러오지 못했어요.');
 const selected=request?new URL(request.url).searchParams.get('edition'):null;
 const ready=selected?choices.find(item=>item.editionId===selected):choices[0];
 if(!ready)throw textbookError(404,'검수할 후보를 다시 선택해 주세요.');
 return respond({base:ready.manuscript,draft,release,history:history.data||[],candidates:choices.map(item=>({editionId:item.editionId,pages:item.pages.length,pdfEnabled:item.artifactManifest.media?.pdf!==false})),candidate:{editionId:ready.editionId,contentHash:ready.contentHash,pages:ready.pages.length,pdfEnabled:ready.artifactManifest.media?.pdf!==false}});
 }catch(e){return respondError(e)}}
export async function POST(request,{bookId=BOOK_ID}={}){const auth=await requireAdmin();if(auth.error)return respond({error:auth.error},auth.status);try{if(!isBookId(bookId))throw textbookError(404,'교재를 찾을 수 없어요.');const text=await request.text();if(Buffer.byteLength(text)>8*1024*1024)throw textbookError(413,'원고 용량이 너무 커요.');let body;try{body=JSON.parse(text)}catch{throw textbookError(400,'입력 형식을 확인해 주세요.')}if(!body||Array.isArray(body)||typeof body!=='object')throw textbookError(400,'입력을 확인해 주세요.');
 if(body.action==='save'){
  if(!Object.hasOwn(body,'expectedDraftVersion')||!validVersion(body.expectedDraftVersion))throw textbookError(428,'최신 초안을 불러온 뒤 저장해 주세요.');
  const base=body.editionId?await candidate(body.editionId,bookId):await currentCandidate(bookId);const invalid=validateManuscript(body.manuscript,base.manuscript);if(invalid)throw textbookError(400,invalid);
  const manuscript=withCandidateMetadata(body.manuscript,base.manuscript);
  const stored=await readDraft(auth.supabase,bookId);
  const replacing=stored?.manuscript&&(validateManuscript(stored.manuscript,base.manuscript)||
   (contentHash(manuscript)===base.contentHash&&stored.content_hash!==base.contentHash));
  if(replacing&&body.replaceDraftHash!==stored.content_hash)throw textbookError(409,'저장된 초안을 먼저 내려받고, 검수 원고로 편집 시작을 선택해 주세요.');
  const {data,error}=await auth.supabase.rpc('save_textbook_book_draft',{p_book_id:bookId,p_manuscript:manuscript,p_content_hash:contentHash(manuscript),p_expected_version:body.expectedDraftVersion});
  if(error){if(error.code==='40001')throw textbookError(409,'다른 편집에서 초안이 바뀌었어요. 입력은 유지되니 최신 내용을 확인해 주세요.');throw textbookError(503,'초안을 저장하지 못했어요.');}return respond({ok:true,draft:Array.isArray(data)?data[0]:data});
 }
 if(!['publish','restore'].includes(body.action))throw textbookError(400,'작업을 선택해 주세요.');
 if(!Object.hasOwn(body,'expectedReleaseVersion')||!validVersion(body.expectedReleaseVersion))throw textbookError(428,'발행 정보를 다시 불러와 주세요.');
 if(body.action==='publish'&&(!Object.hasOwn(body,'expectedDraftVersion')||!validVersion(body.expectedDraftVersion)))throw textbookError(428,'초안 정보를 다시 불러와 주세요.');
 const ready=await candidate(body.editionId,bookId);let draftVersion=null;
 if(body.action==='publish'){const draft=await readDraft(auth.supabase,bookId);if((draft?.version??null)!==body.expectedDraftVersion||(draft&&draft.content_hash!==ready.contentHash))throw textbookError(409,'현재 초안과 출력본이 달라요. 저장한 원고의 출력본 검수를 먼저 마쳐 주세요.');draftVersion=body.expectedDraftVersion;}
 else if(!await readEdition(auth.supabase,body.editionId,bookId))throw textbookError(404,'발행한 판본만 복원할 수 있어요.');
 const {data,error}=await auth.supabase.rpc('publish_textbook_book',{p_book_id:bookId,p_edition_id:ready.editionId,p_content_hash:ready.contentHash,p_manuscript:ready.manuscript,p_artifact_manifest:ready.artifactManifest,p_expected_draft_version:draftVersion,p_expected_release_version:body.expectedReleaseVersion,p_restore:body.action==='restore'});
 if(error){if(error.code==='40001')throw textbookError(409,'초안 또는 발행 정보가 바뀌었어요. 최신 상태를 확인해 주세요.');throw textbookError(503,'판본을 발행하지 못했어요.');}
 // 책장(/lessons · 언어 판)은 ISR 1시간이다(GUEST-STATIC-001 3단계) — 발행 · 복원이 그 수명을 기다리지 않게 바로 버린다(N3 · N4도 이 POST를 쓴다).
 revalidatePath('/lessons');revalidatePath('/lessons/lang/[lang]', 'page');
 // 교재 첫 화면 판(쿼리 없음 — /books/<책>/cover/*) · 배움 판(/home 아래 넷, 이어 읽기 칸이 N5 카탈로그를 싣는다)도 ISR 1시간이다(4단계).
 revalidatePath(`/books/${bookId}/cover/[hint]`,'page');if(bookId===BOOK_ID)revalidatePath('/home','layout');
 return respond({ok:true,release:Array.isArray(data)?data[0]:data});
 }catch(e){return respondError(e)}}
