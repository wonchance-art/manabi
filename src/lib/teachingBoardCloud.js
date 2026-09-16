import {BOARD_LIMIT, BOARD_PAGE_LIMIT, validateBoard, boardCamera} from './teachingBoard';
import {stableJson} from './classCopyModel';
import {boardReuseSource} from './teachingBoardReuse';

export const BOARD_BUCKET='teaching-board-pages';
export const BOARD_TABLE='class_teaching_boards';
export const BOARD_HASH=/^[a-f0-9]{64}$/;
export const BOARD_UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export const cloudBoardScope=(owner,root,day)=>JSON.stringify(['teaching-board-account',owner,String(root),day]);
export const boardPagePath=(owner,id,hash)=>`${owner}/${id}/${hash}.json`;
export function validBoardDay(day){return /^\d{4}-\d{2}-\d{2}$/.test(day||'')&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;}
// Viewport is device-specific. Store semantic elements, including deletion markers
// needed by the editor, without transient personal-note/account bookkeeping.
export function cloudDocument(input){const b=validateBoard(input);return {version:1,activePage:b.activePage,pages:b.pages.map(p=>({id:p.id,elements:p.elements,camera:boardCamera(null),...(boardReuseSource(p.reusedFrom)?{reusedFrom:boardReuseSource(p.reusedFrom)}:{})}))};}
export const sameBoardContent=(a,b)=>stableJson(cloudDocument(a))===stableJson(cloudDocument(b));
export function validateBoardManifest(value){
  if(!value||value.version!==1||!Array.isArray(value.pages)||!value.pages.length||value.pages.length>BOARD_PAGE_LIMIT)throw new Error('설명판 저장 목록을 확인하지 못했어요.');
  const ids=new Set();let total=0;
  const pages=value.pages.map(p=>{
    if(typeof p?.id!=='string'||!p.id||p.id.length>200||ids.has(p.id)||!BOARD_HASH.test(p.hash||'')||!Number.isSafeInteger(p.bytes)||p.bytes<1||p.bytes>BOARD_LIMIT)throw new Error('설명판 페이지 정보를 확인하지 못했어요.');
    ids.add(p.id);total+=p.bytes;return {id:p.id,hash:p.hash,bytes:p.bytes};
  });
  if(!ids.has(value.activePage)||total>BOARD_LIMIT)throw new Error('설명판 저장 크기를 확인해 주세요.');
  return {version:1,activePage:value.activePage,pages};
}
export async function boardDigest(text){const bytes=typeof text==='string'?new TextEncoder().encode(text):text;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
export async function packBoard(document){
  const b=cloudDocument(document),files=[];
  for(const page of b.pages){const text=stableJson(page);files.push({id:page.id,hash:await boardDigest(text),bytes:new TextEncoder().encode(text).length,text});}
  return {manifest:validateBoardManifest({...b,pages:files}),files};
}
export async function unpackBoard(manifest,read,{signal}={}){
  const clean=validateBoardManifest(manifest),pages=new Array(clean.pages.length);let index=0,failure;
  const worker=async()=>{
    while(!failure){
      signal?.throwIfAborted();const at=index++;if(at>=clean.pages.length)return;
      try {
        const entry=clean.pages[at],text=await read(entry);signal?.throwIfAborted();
        if(new TextEncoder().encode(text).length!==entry.bytes||await boardDigest(text)!==entry.hash)throw new Error('저장된 필기를 확인하지 못했어요. 기기 초안은 그대로 보존합니다.');
        const page=JSON.parse(text);if(page.id!==entry.id)throw new Error('설명판 페이지가 일치하지 않아요.');pages[at]=page;
      }catch(error){failure=error;throw error;}
    }
  };
  // Bound I/O and preserve manifest order. No partial document can reach callers.
  const results=await Promise.allSettled(Array.from({length:Math.min(2,clean.pages.length)},worker));
  const rejected=results.find(r=>r.status==='rejected');if(rejected)throw rejected.reason;
  signal?.throwIfAborted();return cloudDocument({...clean,pages});
}
export function restoreBoardCamera(remote,local){return {...remote,pages:remote.pages.map(p=>({...p,camera:boardCamera(local?.pages.find(x=>x.id===p.id)?.camera)}))};}
export function boardCloudLabel(state){if(state.conflict)return '다른 기기와 저장 확인 필요';if(state.error)return state.localSaved?'이 기기에 보관됨 · 계정 저장 확인 필요':'저장 확인 필요';if(state.saving)return '계정에 저장 중…';return state.cloudSaved?'계정에 저장됨':state.localSaved?'이 기기에 보관됨':'저장 준비 중';}
