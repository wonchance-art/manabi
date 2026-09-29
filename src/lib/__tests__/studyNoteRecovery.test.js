import {beforeEach, describe, expect, it, vi} from 'vitest';
import {newStudyNote} from '../studyNotes';
const local=vi.hoisted(()=>({read:vi.fn(),save:vi.fn(),preserve:vi.fn()}));
vi.mock('../teachingBoardStore',()=>({readTeachingBoard:local.read,saveTeachingBoard:local.save,preserveTeachingBoardRecovery:local.preserve}));
import {recoverStudyNote} from '../useStudyNote';
const key='11111111-1111-4111-8111-111111111111';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function fixture(){
 const document=newStudyNote(key,'page-a');
 document.board.pages[0].elements=[{id:'ink',type:'freedraw',x:1,y:2,width:3,height:4,points:[[0,0],[3,4]],pressures:[.3,.8]}];
 document.candidates=[{id:'22222222-2222-4222-8222-222222222222',pageId:'page-a',elementIds:['ink'],originKey:'ink-a',original:'確認',text:'確認',reading:'かくにん',meaning:'확인',language:'Japanese',reviewed:true,excluded:true}];
 const run={alive:true,id:'23',scope:'own-note',writer:'writer',generation:1,localRevision:'old-local',localQueue:Promise.resolve(),dirty:true,blocked:true,value:{id:'23',title:'내 초안',revision:'old-cloud',document}};
 const remote={...structuredClone(run.value),title:'최신 제목',revision:'latest-cloud'};remote.document.board.pages[0].elements=[];remote.document.candidates=[];
 const copies=new Map();
 const request=vi.fn(async(url,options)=>{if(options?.method==='POST'){const body=JSON.parse(options.body);if(!copies.has(body.document.key))copies.set(body.document.key,{id:'24',revision:'copy-cloud',...body});return structuredClone(copies.get(body.document.key));}return structuredClone(remote);});
 return {run,remote,request,copies};
}
beforeEach(()=>{vi.resetAllMocks();local.read.mockResolvedValue({revision:'current-local',document:{personalNote:{dirty:false}}});local.save.mockResolvedValue({revision:'installed-local'});local.preserve.mockResolvedValue();});
describe('explicit private-note recovery',()=>{
 it('archives all local content before reading/installing latest without PUTing the original',async()=>{
  const {run,remote,request,copies}=fixture(),original=structuredClone(run.value);
  const result=await recoverStudyNote(run,request);
  expect(result).toEqual({value:remote,recoveryId:'24'});expect(run).toMatchObject({dirty:false,blocked:false,localRevision:'installed-local'});
  const copy=[...copies.values()][0];expect(copy.document).toEqual({...original.document,key:copy.document.key});expect(copy.title).toBe('내 초안 · 내 초안');
  expect(request.mock.calls.map(([url,o])=>[url,o?.method||'GET'])).toEqual([['/api/notes/23','GET'],['/api/notes','POST'],['/api/notes/23','GET']]);
  expect(local.save.mock.calls[0][2].personalNote).toMatchObject({dirty:false,title:'최신 제목',revision:'latest-cloud'});
 });
 it('shares an in-flight recovery so repeated clicks create one copy',async()=>{
  const {run,request,copies}=fixture(),gate=deferred();local.preserve.mockReturnValueOnce(gate.promise);
  const first=recoverStudyNote(run,request),second=recoverStudyNote(run,request);expect(second).toBe(first);gate.resolve();await first;expect(copies.size).toBe(1);
 });
 it('reuses the same import key after a successful archive response is lost',async()=>{
  const {run,request,copies}=fixture(),normal=request.getMockImplementation();let lost=true;
  request.mockImplementation(async(...args)=>{const result=await normal(...args);if(args[1]?.method==='POST'&&lost){lost=false;throw new Error('lost response');}return result;});
  const old=run.value;await expect(recoverStudyNote(run,request)).rejects.toThrow('lost');expect(run.value).toBe(old);
  await recoverStudyNote(run,request);expect(copies.size).toBe(1);expect(request.mock.calls.filter(([,o])=>o?.method==='POST').map(([,o])=>JSON.parse(o.body).document.key)).toEqual([...copies.keys(),...copies.keys()]);
 });
 it('retains the draft if preserving the local backup or cloud copy fails',async()=>{
  for(const failure of ['local','cloud']){
   const {run,request}=fixture(),old=run.value;local.save.mockClear();
   if(failure==='local')local.preserve.mockRejectedValueOnce(new Error('backup failed'));else request.mockImplementation(async(_,o)=>{if(o?.method==='POST')throw new Error('copy failed');return fixture().remote;});
   await expect(recoverStudyNote(run,request)).rejects.toThrow('failed');expect(run.value).toBe(old);expect(run.dirty).toBe(true);expect(local.save).not.toHaveBeenCalled();
  }
 });
 it('keeps the confirmed copy and draft when latest read fails, and retry does not archive again',async()=>{
  const {run,request,copies}=fixture(),normal=request.getMockImplementation();let reads=0;
  request.mockImplementation(async(...a)=>{if(!a[1]?.method&&++reads===2)throw new Error('latest offline');return normal(...a);});
  await expect(recoverStudyNote(run,request)).rejects.toThrow('offline');expect(run.recoveryId).toBe('24');expect(run.value.title).toBe('내 초안');
  await recoverStudyNote(run,request);expect(copies.size).toBe(1);expect(request.mock.calls.filter(([,o])=>o?.method==='POST')).toHaveLength(1);
 });
 it.each([401,403,404])('checks access first and never copies after denied read %s',async status=>{
  const {run,request}=fixture();request.mockRejectedValue(Object.assign(new Error('denied'),{status}));await expect(recoverStudyNote(run,request)).rejects.toMatchObject({status});expect(local.preserve).not.toHaveBeenCalled();expect(local.save).not.toHaveBeenCalled();
 });
 it('does not install stale data after editing during the archive request',async()=>{
  const {run,request}=fixture(),normal=request.getMockImplementation();request.mockImplementation(async(...a)=>{const result=await normal(...a);if(a[1]?.method==='POST'){run.generation++;run.value={...run.value,title:'방금 쓴 제목'};}return result;});
  await expect(recoverStudyNote(run,request)).rejects.toThrow('내용이 바뀌');expect(run.value.title).toBe('방금 쓴 제목');expect(run.recoveryId).toBe('24');expect(local.save).not.toHaveBeenCalled();
 });
 it('flushes buffered canvas ink before replacing a document',async()=>{
  const {run,request}=fixture();let buffered=false;local.read.mockImplementation(async()=>{buffered=true;return {revision:'latest',document:{}};});
  await expect(recoverStudyNote(run,request,()=>{if(buffered){buffered=false;run.generation++;}})).rejects.toThrow('내용이 바뀌');expect(local.save).not.toHaveBeenCalled();expect(run.dirty).toBe(true);
 });
 it('preserves a new edit during the final local commit and never rebases its server revision',async()=>{
  const {run,request}=fixture();local.save.mockImplementation(async()=>{run.generation++;run.value={...run.value,title:'새 입력'};return {revision:'installed-local'};});
  await expect(recoverStudyNote(run,request)).rejects.toThrow('내용이 바뀌');expect(run.value).toMatchObject({title:'새 입력',revision:'old-cloud'});expect(run.dirty).toBe(true);expect(local.preserve.mock.calls.at(-1)[1].personalNote.title).toBe('새 입력');
 });
 it('preserves another tab’s dirty local envelope before CAS installation',async()=>{
  const {run,request}=fixture(),other={personalNote:{dirty:true,title:'다른 초안'}};local.read.mockResolvedValue({revision:'other-local',document:other});await recoverStudyNote(run,request);expect(local.preserve.mock.calls[1][1]).toBe(other);expect(local.save.mock.calls[0][1]).toBe('other-local');
 });
 it('does not apply a late response to a closed or changed account session',async()=>{
  const {run,request}=fixture();request.mockImplementation(async()=>{run.alive=false;return fixture().remote;});await expect(recoverStudyNote(run,request)).rejects.toThrow('닫혔');expect(local.save).not.toHaveBeenCalled();expect(request).toHaveBeenCalledTimes(1);
 });
 it('does not replace the current draft after a local revision race',async()=>{
  const {run,request}=fixture(),old=run.value;local.save.mockRejectedValue(Object.assign(new Error('race'),{code:'board_conflict'}));await expect(recoverStudyNote(run,request)).rejects.toThrow('race');expect(run.value).toBe(old);expect(run.blocked).toBe(true);expect(run.recoveryId).toBe('24');
 });
 it('reads a clean note without creating a recovery copy',async()=>{
  const {run,request,copies}=fixture();run.dirty=false;run.blocked=false;await recoverStudyNote(run,request);expect(copies.size).toBe(0);expect(request).toHaveBeenCalledTimes(1);
 });
});
