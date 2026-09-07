import {createSupabaseServerClient,requireAdmin} from '@/lib/supabaseServer';
import {candidate,readEdition,verifiedAsset,respond,respondError,textbookError} from '@/lib/textbook/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request,{params}){try{const {edition}=await params;const db=await createSupabaseServerClient();let published=null;try{published=await readEdition(db,edition)}catch(e){if(e.status!==503)throw e;}
 if(!published){const auth=await requireAdmin();if(auth.error)return respond({error:'아직 공개되지 않은 판본이에요.'},auth.status===401?401:404)}
 const bundle=await candidate(edition);if(published&&(published.content_hash!==bundle.contentHash||JSON.stringify(published.artifact_manifest)!==JSON.stringify(bundle.artifactManifest))){
  // JSONB key ordering may differ; content hash remains authoritative, compare the artifact digest explicitly.
  if(published.content_hash!==bundle.contentHash||published.artifact_manifest?.bundleHash!==bundle.artifactManifest.bundleHash)throw textbookError(503,'판본과 출력본이 일치하지 않아요.');
 }
 const file=new URL(request.url).searchParams.get('file')||'index.html';
 if(file.endsWith('.pdf')&&bundle.artifactManifest.media?.pdf===false)throw textbookError(404,'PDF는 다듬고 있어요. 웹 교재를 이용해 주세요.');
 const {bytes,type}=await verifiedAsset(bundle,file);
 return new Response(bytes,{headers:{'Content-Type':type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...(file.endsWith('.pdf')?{'Content-Disposition':'inline; filename="manabi-japanese-n5.pdf"'}:{})}});
 }catch(e){return respondError(e)}}
