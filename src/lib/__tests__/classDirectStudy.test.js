import {describe,it,expect,vi,beforeEach} from 'vitest';
import {saveClassroomMetadata,classMeaningPatch,classroomEntries} from '../classroomModel';
import {classCopyUpdatePlan,sharedSnapshot} from '../classCopyModel';
import {toPayload} from '../server/classIndex';
import {sourceHref,reviewSourceContexts} from '../learningSources';
vi.mock('../supabase',()=>({supabase:{}}));
vi.mock('../classClient',()=>({readUnlock:vi.fn(),fetchTeamMaterial:vi.fn()}));
vi.mock('../sharedStore',()=>({getSharedCopy:vi.fn(),putSharedCopy:vi.fn()}));
import {readUnlock,fetchTeamMaterial} from '../classClient';
import {getSharedCopy,putSharedCopy} from '../sharedStore';
import {readClassMaterial} from '../classDirectStudy';
const note=()=>({id:21,title:'수업',raw_text:'学习',processed_json:{sequence:['id_0_one'],dictionary:{id_0_one:{text:'学习',meaning:'공부하다',furigana:'xué xí',pos:'동사'}},metadata:{language:'Chinese',classEntries:[{id:'entry',idx:0,text:'学习'}],classMeanings:{entry:{text:'学习',meaning:'공부하다'}}}}});
describe('teacher meaning reaches reading and optional copies',()=>{
 it('saves metadata and dictionary atomically; signals changes without overwriting a student correction',async()=>{
  const original=note(),base=sharedSnapshot(original),copy=structuredClone(original);
  original.processed_json.metadata.viewerCorrections={id_0_one:['meaning']};
  const client={rpc:vi.fn(async(_,p)=>({data:{material:{...original,processed_json:p.p_json}}}))};
  const changed=await saveClassroomMetadata(client,original,classMeaningPatch(original,classroomEntries(original)[0],'본받다'));
  expect(changed.processed_json.dictionary.id_0_one.meaning).toBe('본받다');
  expect(toPayload(changed,'note').processed_json.dictionary.id_0_one.meaning).toBe('본받다');
  const plan=classCopyUpdatePlan(copy,base,changed);
  expect(plan.summary.meanings).toEqual([{text:'学习',before:'공부하다',after:'본받다',personal:false}]);
  expect(plan.material.processed_json.dictionary.id_0_one.meaning).toBe('본받다');
  copy.processed_json.dictionary.id_0_one.meaning='내가 정리한 뜻';
  const mine=classCopyUpdatePlan(copy,base,changed);
  expect(mine.summary.meanings[0].personal).toBe(true);
  expect(mine.material.processed_json.dictionary.id_0_one.meaning).toBe('내가 정리한 뜻');
  expect(original.processed_json.dictionary.id_0_one.meaning).toBe('공부하다');
 });
 it('repairs a legacy metadata-only edit once and continues receiving later edits',()=>{
  const source=note(),copy=note(),base=sharedSnapshot(source);
  source.processed_json.metadata.classMeanings.entry.meaning='본받다';
  const plan=classCopyUpdatePlan(copy,base,source);expect(plan.state).toBe('update');
  const received={...copy,...plan.material},legacyBase=sharedSnapshot(source);
  expect(classCopyUpdatePlan(received,legacyBase,source).state).toBe('current');
  source.processed_json.metadata.classMeanings.entry.meaning='배우다';
  const later=classCopyUpdatePlan(received,legacyBase,source);
  expect(later.material.processed_json.dictionary.id_0_one.meaning).toBe('배우다');
 });
 it('normalizes old source metadata without applying sentence meanings to constituent tokens',()=>{
  const n=note();n.processed_json.metadata.classMeanings.entry.meaning='수정한 뜻';
  expect(toPayload(n,'note').processed_json.dictionary.id_0_one.meaning).toBe('수정한 뜻');
  n.raw_text='学习中文';n.processed_json.metadata.classEntries[0].text='学习中文';n.processed_json.metadata.classMeanings.entry.text='学习中文';
  n.processed_json.sequence.push('id_0_two');n.processed_json.dictionary.id_0_two={text:'中文',meaning:'중국어'};
  expect(toPayload(n,'note').processed_json.dictionary.id_0_one.meaning).toBe('공부하다');
 });
});
describe('class original access',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('navigator',{onLine:true});readUnlock.mockReturnValue({token:'test'});putSharedCopy.mockResolvedValue(true);});
 it('revalidates online on every open without trusting a cached source',async()=>{
  fetchTeamMaterial.mockResolvedValue(note());await readClassMaterial('local:21','team');await readClassMaterial('local:21','team');
  expect(fetchTeamMaterial).toHaveBeenCalledTimes(2);expect(getSharedCopy).not.toHaveBeenCalled();
 });
 it('opens the online original even if optional device caching fails',async()=>{
  fetchTeamMaterial.mockResolvedValue(note());putSharedCopy.mockResolvedValue(false);
  expect((await readClassMaterial('local:21','team')).id).toBe(21);
 });
 it('never resurrects revoked material from cache',async()=>{
  fetchTeamMaterial.mockRejectedValue(Object.assign(new Error('denied'),{status:401}));
  getSharedCopy.mockResolvedValue({team:'team',material:note()});await expect(readClassMaterial('local:21','team')).rejects.toThrow('denied');expect(getSharedCopy).not.toHaveBeenCalled();
 });
 it('requires a valid class capability even offline and rejects another team cache',async()=>{
  vi.stubGlobal('navigator',{onLine:false});readUnlock.mockReturnValue(null);
  await expect(readClassMaterial('local:21','team')).rejects.toThrow('수업 암호');
  readUnlock.mockReturnValue({token:'test'});getSharedCopy.mockResolvedValue({team:'other',material:note()});
  await expect(readClassMaterial('local:21','team')).rejects.toThrow('온라인');
 });
 it('review links use validated identifiers and private context IDs, not stored URLs',()=>{
  const c={id:'00000000-0000-4000-8000-000000000088',kind:'class',quote:'学习',locator:{team:'team',materialId:'21',url:'https://evil.test'}};
  expect(sourceHref(c)).toBe('/viewer/local:21?team=team&returnTo=%2Fclass%2Fteam&sourceContext='+c.id);
  expect(reviewSourceContexts({word_text:'学习'},[c]).primary.href).toBe(sourceHref(c));
  expect(sourceHref({...c,locator:{...c.locator,team:'../bad'}})).toBeNull();
 });
});
