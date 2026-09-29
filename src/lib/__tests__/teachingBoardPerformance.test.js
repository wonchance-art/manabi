import {it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import os from 'node:os';
import {emptyBoard,validateBoard,BOARD_LIMIT} from '../teachingBoard';
import {sameBoardContent,packBoard,unpackBoard,validateBoardManifest,boardDigest,cloudDocument} from '../teachingBoardCloud';
import {wordCardSkeleton} from '../teachingBoardCard';

const palette={paper:'#fff',ink:'#222',muted:'#555',accent:'#356',line:'#ddd'};
function fixture(count,elements){const board=emptyBoard('p0');board.pages=Array.from({length:count},(_,i)=>({id:`p${i}`,camera:{scrollX:0,scrollY:0,zoom:{value:1}},elements:elements(i)}));return board;}
const ink=(n,p)=>Array.from({length:n},(_,i)=>({id:`ink-${p}-${i}`,type:'freedraw',x:i%100,y:Math.floor(i/100),width:4,height:2,points:[[0,0],[2,2],[4,0]],version:1}));
const cases={normal:fixture(5,p=>[...Array.from({length:4},(_,i)=>wordCardSkeleton({text:'学习',reading:'xué xí',meaning:'공부하다',language:'Chinese',layoutVersion:2},`word-${p}-${i}`,{x:i*300,y:0},palette)).flat(),...ink(20,p)]),large:fixture(20,p=>ink(200,p)),elements:fixture(1,p=>ink(5000,p)),bytes:fixture(1,()=>[{id:'large-text',type:'text',text:'a'.repeat(BOARD_LIMIT-4096),fontSize:20,x:0,y:0,width:300,height:100}])};
it('loads normal, twenty-page and boundary boards without losing content',async()=>{for(const board of Object.values(cases)){const original=JSON.stringify(board);expect(validateBoard(board).pages).toHaveLength(board.pages.length);const packed=await packBoard(board);const restored=await unpackBoard(packed.manifest,entry=>packed.files.find(f=>f.hash===entry.hash).text);expect(sameBoardContent(restored,board)).toBe(true);expect(JSON.stringify(board)).toBe(original);}});
it.skipIf(!process.env.QA_BOARD_BENCH)('records isolated validation/compare/read costs with synthetic boards',async()=>{
 const report={node:process.version,platform:process.platform,cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,samples:[],network:'synthetic 10ms/page; no external requests'};
 const measure=async(name,fn,n=12)=>{const times=[];for(let i=0;i<n;i++){const start=performance.now();await fn();times.push(performance.now()-start);}times.sort((a,b)=>a-b);report.samples.push({name,n,median:times[Math.floor(n/2)],p95:times[Math.ceil(n*.95)-1]});};
 for(const [name,board] of Object.entries(cases)){await measure(`${name}:validate`,()=>validateBoard(board));await measure(`${name}:camera-content-compare`,()=>sameBoardContent(board,{...board,pages:board.pages.map(p=>({...p,camera:{scrollX:100,scrollY:100,zoom:{value:2}}}))}));}
 const packed=await packBoard(cases.large);
 const sequential=async(manifest,read)=>{const clean=validateBoardManifest(manifest),pages=[];for(const entry of clean.pages){const text=await read(entry);if(new TextEncoder().encode(text).length!==entry.bytes||await boardDigest(text)!==entry.hash)throw Error('integrity');const page=JSON.parse(text);if(page.id!==entry.id)throw Error('id');pages.push(page);}return cloudDocument({...clean,pages});};
 await measure('20-page-download-sequential-baseline',()=>sequential(packed.manifest,async entry=>{await new Promise(r=>setTimeout(r,10));return packed.files.find(f=>f.hash===entry.hash).text;}),8);
 await measure('20-page-download',()=>unpackBoard(packed.manifest,async entry=>{await new Promise(r=>setTimeout(r,10));return packed.files.find(f=>f.hash===entry.hash).text;}),8);
 writeFileSync(process.env.QA_BOARD_BENCH,JSON.stringify(report,null,2));
});
