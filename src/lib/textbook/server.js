// Server routes only: file-backed, verified publication artifacts.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {BOOK_ID,EDITION_ID,canonical,manuscriptContent} from './contract';
// 경로는 호출마다 끝까지 글자로 쓴다 — 디렉터리 상수를 두면 파일 추적기가 교재 폴더 전체(mp3 포함)를 모든 함수에 싣는다.
export const contentHash=book=>createHash('sha256').update(JSON.stringify(canonical(manuscriptContent(book)))).digest('hex');
export const textbookError=(status,message)=>Object.assign(new Error(message),{status});
export async function candidate(edition) {
  if(!EDITION_ID.test(edition||''))throw textbookError(404,'판본을 찾을 수 없어요.');
  try {
    const bundle=JSON.parse(await readFile(path.join(process.cwd(),'src/content/textbookEditions',edition,'bundle.json'),'utf8'));
    if(bundle.editionId!==edition||bundle.contentHash!==contentHash(bundle.manuscript)||!bundle.qa?.passed)throw textbookError(503,'검수 자료를 확인하지 못했어요.');
    return bundle;
  } catch(error){if(error.status)throw error;throw textbookError(404,'출력본이 아직 준비되지 않았어요.');}
}
export async function currentCandidate(){const index=JSON.parse(await readFile(path.join(process.cwd(),'src/content/textbookEditions/index.json'),'utf8'));return candidate(index.current)}
// Curated editor choices are separate from the DB publication pointer and legacy fallback.
export async function editorCandidates() {
 const index=JSON.parse(await readFile(path.join(process.cwd(),'src/content/textbookEditions/index.json'),'utf8'));
 return Promise.all([...new Set(index.reviewCandidates||[index.current])].map(id=>candidate(id)));
}
export async function readRelease(supabase) {
 const {data,error}=await supabase.from('textbook_book_releases').select('book_id,edition_id,version').eq('book_id',BOOK_ID).maybeSingle();
 if(error)throw textbookError(503,'발행 정보를 불러오지 못했어요.');return data;
}
export async function readEdition(supabase,edition) {
 if(!EDITION_ID.test(edition||''))throw textbookError(404,'판본을 찾을 수 없어요.');
 const {data,error}=await supabase.from('textbook_book_editions').select('book_id,edition_id,content_hash,manuscript,artifact_manifest,published_at').eq('book_id',BOOK_ID).eq('edition_id',edition).maybeSingle();
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
export async function publishedBookCatalog(db) {
 const {data:release,error}=await db.from('textbook_book_releases').select('edition_id').eq('book_id',BOOK_ID).maybeSingle();
 // The existing materials feature remains usable while the additive migration awaits deployment.
 if(error&&['42P01','PGRST205'].includes(error.code))return [];
 if(error)throw textbookError(503,'교재 목록을 확인하지 못했어요.');if(!release)return [];
 const edition=await readEdition(db,release.edition_id);if(!edition)return [];
 return edition.manuscript.lessons.map(l=>({slug:`n5-book-${l.id}`,title:`${String(l.number).padStart(2,'0')}과 · ${l.title}`,href:`/books/${BOOK_ID}?edition=${release.edition_id}#${l.id}`}));
}
