// Server routes only: file-backed, verified publication artifacts.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {BOOK_ID,BOOKS,isBookId,bookHref,bookUnitSlug,EDITION_ID,canonical,manuscriptContent} from './contract';
// 경로는 호출마다 끝까지 글자로 쓴다 — 디렉터리 상수를 두면 파일 추적기가 교재 폴더 전체(mp3 포함)를 모든 함수에 싣는다.
export const contentHash=book=>createHash('sha256').update(JSON.stringify(canonical(book.bookId==='japanese-n4'?book:manuscriptContent(book)))).digest('hex');
export const textbookError=(status,message)=>Object.assign(new Error(message),{status});
function requireBook(bookId){if(!isBookId(bookId))throw textbookError(404,'교재를 찾을 수 없어요.');}
export async function candidate(edition,bookId=BOOK_ID) {
  requireBook(bookId);
  if(!EDITION_ID.test(edition||''))throw textbookError(404,'판본을 찾을 수 없어요.');
  try {
    const bundle=JSON.parse(await readFile(path.join(process.cwd(),'src/content/textbookEditions',edition,'bundle.json'),'utf8'));
    if(bundle.bookId!==bookId||(bundle.manuscript?.bookId&&bundle.manuscript.bookId!==bookId)||bundle.manuscript?.level!==BOOKS[bookId].level)throw textbookError(404,'판본을 찾을 수 없어요.');
    if(bundle.editionId!==edition||bundle.contentHash!==contentHash(bundle.manuscript)||!bundle.qa?.passed)throw textbookError(503,'검수 자료를 확인하지 못했어요.');
    return bundle;
  } catch(error){if(error.status)throw error;throw textbookError(404,'출력본이 아직 준비되지 않았어요.');}
}
// 공개 읽기 경로는 배포 단위로 고정된 판본을 재사용한다. 책+판본마다 분리하고, 실패는 기억하지 않는다.
const verifiedCandidates=new Map();
export function cachedCandidate(edition,bookId=BOOK_ID){
 const key=`${bookId}:${edition}`;
 if(!verifiedCandidates.has(key)){const pending=candidate(edition,bookId);verifiedCandidates.set(key,pending);pending.catch(()=>verifiedCandidates.delete(key));}
 return verifiedCandidates.get(key);
}
async function candidateIndex(bookId){
 requireBook(bookId);
 // Literal JSON paths keep the file tracer from bundling all fonts/audio in ordinary learning functions.
 return JSON.parse(await readFile(bookId===BOOK_ID?path.join(process.cwd(),'src/content/textbookEditions/index.json'):path.join(process.cwd(),'src/content/textbookEditions/japanese-n4/index.json'),'utf8'));
}
export async function currentCandidate(bookId=BOOK_ID){const index=await candidateIndex(bookId);return candidate(index.current,bookId)}
// Curated editor choices are separate from the DB publication pointer and legacy fallback.
export async function editorCandidates(bookId=BOOK_ID) {
 const index=await candidateIndex(bookId);
 return Promise.all([...new Set(index.reviewCandidates||[index.current])].map(id=>candidate(id,bookId)));
}
export async function readRelease(supabase,bookId=BOOK_ID) {
 requireBook(bookId);
 const {data,error}=await supabase.from('textbook_book_releases').select('book_id,edition_id,version').eq('book_id',bookId).maybeSingle();
 if(error)throw textbookError(503,'발행 정보를 불러오지 못했어요.');return data;
}
const EDITION_STAMP='book_id,edition_id,content_hash,artifact_manifest,published_at';
export async function readEdition(supabase,edition,bookId=BOOK_ID) {
 requireBook(bookId);
 if(!EDITION_ID.test(edition||''))throw textbookError(404,'판본을 찾을 수 없어요.');
 const {data,error}=await supabase.from('textbook_book_editions').select(`${EDITION_STAMP},manuscript`).eq('book_id',bookId).eq('edition_id',edition).maybeSingle();
 if(error)throw textbookError(503,'교재 판본을 불러오지 못했어요.');return data;
}
// 발행 확인만 하는 곳(배움 · 산책 · 교재 화면, 교재 표현 저장)은 원고를 받지 않는다 — 원고 jsonb는 약 700KB(텍스트, 2026-10-16
// 실측)라 화면마다 도쿄 DB에서 통째로 받으면 배움 · 산책 탭 전환이 2초를 넘었다. 본문은 판본 파일(candidate)이 정본이고
// 여기서는 해시 두 개(content_hash · artifact_manifest)만 대조한다.
export async function readEditionStamp(supabase,edition,bookId=BOOK_ID) {
 requireBook(bookId);
 if(!EDITION_ID.test(edition||''))throw textbookError(404,'판본을 찾을 수 없어요.');
 const {data,error}=await supabase.from('textbook_book_editions').select(EDITION_STAMP).eq('book_id',bookId).eq('edition_id',edition).maybeSingle();
 if(error)throw textbookError(503,'교재 판본을 불러오지 못했어요.');return data;
}
// 가변 파일명 읽기(verifiedAsset)는 asset 경로 전용 ./assetFile에 있다. 여기서는 이미 읽은 바이트만 검증한다.
export function checkedAsset(bundle,file,bytes) {
 const artifact=bundle.assets?.[file];if(!artifact)throw textbookError(404,'파일을 찾을 수 없어요.');
 if(createHash('sha256').update(bytes).digest('hex')!==artifact.sha256)throw textbookError(503,'출력 파일을 검증하지 못했어요.');
 return {bytes,type:artifact.type};
}
export async function verifiedReadingHtml(bundle) {
 if(!bundle.assets?.['index.html'])throw textbookError(404,'파일을 찾을 수 없어요.');
 return checkedAsset(bundle,'index.html',await readFile(path.join(process.cwd(),'src/content/textbookEditions',bundle.editionId,'index.html')));
}
export function respond(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}})}
export function respondError(error){return respond({error:error.status?error.message:'교재 요청을 처리하지 못했어요.'},error.status||500)}
export async function publishedBookCatalog(db,bookId=BOOK_ID) {
 requireBook(bookId);
 const {data:release,error}=await db.from('textbook_book_releases').select('edition_id').eq('book_id',bookId).maybeSingle();
 // The existing materials feature remains usable while the additive migration awaits deployment.
 if(error&&['42P01','PGRST205'].includes(error.code))return [];
 if(error)throw textbookError(503,'교재 목록을 확인하지 못했어요.');if(!release)return [];
 // 원고 JSONB 없이 발행 해시 두 개를 대조하고 검증한 판본 파일에서 과 목록을 만든다.
 const edition=await readEditionStamp(db,release.edition_id,bookId);if(!edition)return [];
 const book=await cachedCandidate(release.edition_id,bookId);
 if(edition.content_hash!==book.contentHash||edition.artifact_manifest?.bundleHash!==book.artifactManifest.bundleHash)throw textbookError(503,'교재 판본을 확인하지 못했어요.');
 return book.manuscript.lessons.map(l=>({slug:bookUnitSlug(bookId,l.number),title:`${String(l.number).padStart(2,'0')}과 · ${l.title}`,href:bookHref(release.edition_id,l.id,bookId)}));
}
