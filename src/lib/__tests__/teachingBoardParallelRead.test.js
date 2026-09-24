import {it,expect} from 'vitest';
import {emptyBoard} from '../teachingBoard';
import {packBoard,unpackBoard,cloudDocument} from '../teachingBoardCloud';
const source=()=>({...emptyBoard('p0'),pages:Array.from({length:7},(_,i)=>({...emptyBoard(`p${i}`).pages[0]}))});
it('caps active downloads at two and restores manifest order despite reversed completion',async()=>{
 const board=source(),packed=await packBoard(board);let active=0,peak=0;const completed=[];
 const result=await unpackBoard(packed.manifest,async entry=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,entry.id==='p0'?20:1));active--;completed.push(entry.id);return packed.files.find(f=>f.id===entry.id).text;});
 expect(peak).toBe(2);expect(completed[0]).toBe('p1');expect(result).toEqual(cloudDocument(board));
});
it('rejects the whole board on corruption and stops scheduling further reads',async()=>{
 const packed=await packBoard(source());const reads=[];
 await expect(unpackBoard(packed.manifest,async entry=>{reads.push(entry.id);if(entry.id==='p0')return 'corrupt';await new Promise(r=>setTimeout(r,10));return packed.files.find(f=>f.id===entry.id).text;})).rejects.toThrow('확인');
 expect(reads).toEqual(['p0','p1']);
});
it('cancellation stops scheduling work and never returns a partial document',async()=>{
 const controller=new AbortController(),packed=await packBoard(source()),reads=[];
 await expect(unpackBoard(packed.manifest,async entry=>{reads.push(entry.id);controller.abort();return packed.files.find(f=>f.id===entry.id).text;},{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
 expect(reads.length).toBeLessThanOrEqual(2);
});
