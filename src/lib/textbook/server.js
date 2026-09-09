// Server routes only: file-backed, verified publication artifacts.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {BOOK_ID,EDITION_ID,canonical,manuscriptContent} from './contract';
const root=path.join(process.cwd(),'src/content/textbookEditions');
export const contentHash=book=>createHash('sha256').update(JSON.stringify(canonical(manuscriptContent(book)))).digest('hex');
export const textbookError=(status,message)=>Object.assign(new Error(message),{status});
export async function candidate(edition) {
  if(!EDITION_ID.test(edition||''))throw textbookError(404,'판본을 찾을 수 없어요.');
  try {
    const bundle=JSON.parse(await readFile(path.join(root,edition,'bundle.json'),'utf8'));
    if(bundle.editionId!==edition||bundle.contentHash!==contentHash(bundle.manuscript)||!bundle.qa?.passed)throw textbookError(503,'검수 자료를 확인하지 못했어요.');
    return bundle;
  } catch(error){if(error.status)throw error;throw textbookError(404,'출력본이 아직 준비되지 않았어요.');}
}
export async function currentCandidate(){const index=JSON.parse(await readFile(path.join(root,'index.json'),'utf8'));return candidate(index.current)}
export async function readRelease(supabase) {
 const {data,error}=await supabase.from('textbook_book_releases').select('book_id,edition_id,version').eq('book_id',BOOK_ID).maybeSingle();
 if(error)throw textbookError(503,'발행 정보를 불러오지 못했어요.');return data;
}
export async function readEdition(supabase,edition) {
 if(!EDITION_ID.test(edition||''))throw textbookError(404,'판본을 찾을 수 없어요.');
 const {data,error}=await supabase.from('textbook_book_editions').select('book_id,edition_id,content_hash,manuscript,artifact_manifest,published_at').eq('book_id',BOOK_ID).eq('edition_id',edition).maybeSingle();
 if(error)throw textbookError(503,'교재 판본을 불러오지 못했어요.');return data;
}
export async function verifiedAsset(bundle,file) {
 const artifact=bundle.assets?.[file];if(!artifact||!/^[-a-zA-Z0-9_./]+$/.test(file)||file.includes('..'))throw textbookError(404,'파일을 찾을 수 없어요.');
 const bytes=await readFile(path.join(root,bundle.editionId,file));
 if(createHash('sha256').update(bytes).digest('hex')!==artifact.sha256)throw textbookError(503,'출력 파일을 검증하지 못했어요.');
 return {bytes,type:artifact.type};
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
