import {createSupabaseServerClient,requireAdmin} from '@/lib/supabaseServer';
import {cachedCandidate,readEditionStamp,respond,respondError,textbookError} from '@/lib/textbook/server';
import {verifiedAsset} from '@/lib/textbook/assetFile';
export const runtime='nodejs';export const dynamic='force-dynamic';
// 공개 판본(발행 기록 있음 + 해시 일치)의 파일은 판본 id가 주소에 든 고정 출력물이라 브라우저 · CDN이 오래 보관해도 된다.
// 관리자 미리보기(미공개 판본)는 공개 전이므로 지금처럼 보관하지 않는다. 오류 응답은 respond()의 no-store 그대로.
const PUBLIC_ASSET_CACHE='public, max-age=31536000, immutable';
const PREVIEW_ASSET_CACHE='private, no-store';
export async function GET(request,{params}){try{const {edition}=await params;const db=await createSupabaseServerClient();let published=null;try{published=await readEditionStamp(db,edition)}catch(e){if(e.status!==503)throw e;}
 if(!published){const auth=await requireAdmin();if(auth.error)return respond({error:'아직 공개되지 않은 판본이에요.'},auth.status===401?401:404)}
 const bundle=await cachedCandidate(edition);if(published&&(published.content_hash!==bundle.contentHash||JSON.stringify(published.artifact_manifest)!==JSON.stringify(bundle.artifactManifest))){
  // JSONB key ordering may differ; content hash remains authoritative, compare the artifact digest explicitly.
  if(published.content_hash!==bundle.contentHash||published.artifact_manifest?.bundleHash!==bundle.artifactManifest.bundleHash)throw textbookError(503,'판본과 출력본이 일치하지 않아요.');
 }
 const file=new URL(request.url).searchParams.get('file')||'index.html';
 if(file.endsWith('.pdf')&&bundle.artifactManifest.media?.pdf===false)throw textbookError(404,'PDF는 다듬고 있어요. 웹 교재를 이용해 주세요.');
 const {bytes,type}=await verifiedAsset(bundle,file);
 return new Response(bytes,{headers:{'Content-Type':type,'Cache-Control':published?PUBLIC_ASSET_CACHE:PREVIEW_ASSET_CACHE,'X-Content-Type-Options':'nosniff',...(file.endsWith('.pdf')?{'Content-Disposition':'inline; filename="manabi-japanese-n5.pdf"'}:{})}});
 }catch(e){return respondError(e)}}
