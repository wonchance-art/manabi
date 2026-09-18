import {supabase} from './supabase';
import {BOARD_BUCKET,boardPagePath,packBoard,unpackBoard} from './teachingBoardCloud';
import {requestNote} from './useStudyNote';

export function boardEndpoint(root,day){return `/api/classroom/boards?${new URLSearchParams({rootId:String(root),...(day?{day}:{})})}`;}
export async function readCloudBoard(root,day,{signal}={}){signal?.throwIfAborted();const value=await requestNote(boardEndpoint(root,day),{signal});signal?.throwIfAborted();if(!value.board?.manifest)return {row:value.board||null,document:null};return {row:value.board,document:await unpackBoard(value.board.manifest,async entry=>{
  const {data,error}=await supabase.storage.from(BOARD_BUCKET).download(boardPagePath(value.board.owner_id,value.board.id,entry.hash),{}, {signal});if(error)throw error;return data.text();
},{signal})};}
export function listCloudBoards(root,{from,to,cursor,signal}={}){const params=new URLSearchParams({rootId:String(root)});for(const [key,value] of Object.entries({from,to,cursor}))if(value)params.set(key,value);return requestNote(`/api/classroom/boards?${params}`,{signal});}
export async function writeCloudBoard(root,day,expected,document,operation){
  const prepared=await requestNote('/api/classroom/boards',{method:'POST',body:JSON.stringify({rootId:String(root),day})});
  const row=prepared.board,packed=await packBoard(document),known=new Set(row.manifest?.pages.map(p=>p.hash)||[]);
  // Never overwrite an object. The server validates size/hash/content before CAS.
  for(const file of packed.files){if(known.has(file.hash))continue;const path=boardPagePath(row.owner_id,row.id,file.hash),bucket=supabase.storage.from(BOARD_BUCKET);
    const result=await bucket.upload(path,new Blob([file.text],{type:'application/json'}),{contentType:'application/json',upsert:false});
    if(result.error){const check=await bucket.download(path);if(check.error||await check.data.text()!==file.text)throw result.error;}
  }
  return requestNote('/api/classroom/boards',{method:'PUT',body:JSON.stringify({rootId:String(root),day,revision:expected,operation,manifest:packed.manifest})});
}
