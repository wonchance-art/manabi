import {describe,it,expect,vi} from 'vitest';
import {classStudyContext,classStudyNeighborHref,studySelection,studySelectionKey,findStudyEntry,buildStudySeed} from '../classStudy';
import {sharedSnapshot,classCopyUpdatePlan} from '../classCopyModel';
import {findExistingCopies,claimSharedCopies} from '../sharedCopy';
const material=()=>({id:12,title:'수업 교재',raw_text:'图书馆',processed_json:{status:'completed',sequence:['id_0_one'],dictionary:{id_0_one:{text:'图书馆',meaning:'도서관',furigana:'tú shū guǎn',pos:'명사'}},metadata:{language:'Chinese',book:{key:'book'}}}});
describe('교재 안 수업 선택',()=>{
 it('keeps the class day and return destination through neighboring chapters',()=>{
  const context={team:'class-a',day:'2026-09-10'};
  const next=new URL(classStudyNeighborHref({id:13},context),'https://manabi.invalid');
  expect(next.pathname).toBe('/viewer/13');
  expect(classStudyContext(next.searchParams)).toEqual(context);
  expect(next.searchParams.get('returnTo')).toBe('/class/class-a/live?day=2026-09-10');
 });
 it('preserves ordinary reading and local student-copy download routes',()=>{
  expect(classStudyNeighborHref({id:13},null)).toBe('/viewer/13');
  expect(classStudyNeighborHref({id:13,href:'/class/class-a?open=13'},{team:'class-a',day:'2026-09-10'})).toBe('/class/class-a?open=13');
 });
 it('accepts only bounded class and calendar context',()=>{
  expect(classStudyContext(new URLSearchParams({class:'class-a',day:'2026-09-10'}))).toEqual({team:'class-a',day:'2026-09-10'});
  expect(classStudyContext(new URLSearchParams({class:'../admin'}))).toBeNull();
  expect(classStudyContext(new URLSearchParams({class:'a',day:'2026-02-30'}))).toBeNull();
 });
 it('a range carries no fabricated sentence translation',()=>{
  const m=material(),t={id:'id_0_one',...m.processed_json.dictionary.id_0_one};
  expect(studySelection(m,t).meaning).toBe('도서관');
  expect(studySelection(m,t,'图书馆')).toMatchObject({meaning:'',source:{quote:'图书馆'}});
  expect(studySelection(m,t,'图书馆').source.tokenId).toBeUndefined();
 });
 it('keeps source identities distinct and matches only the same entry',()=>{
  const selection={text:'图书馆',source:{materialId:'12',quote:'图书馆',tokenId:'one'}};
  const n={processed_json:{metadata:{classEntries:[{id:'entry',text:selection.text}],classSources:{entry:selection.source}}}};
  expect(findStudyEntry(n,selection)?.id).toBe('entry');
  expect(studySelectionKey(selection)).toBe(studySelectionKey({text:selection.text,source:{quote:'图书馆',tokenId:'one',materialId:'12'}}));
  expect(findStudyEntry(n,{...selection,source:{...selection.source,tokenId:'two'}})).toBeNull();
  expect(studySelectionKey(selection)).not.toBe(studySelectionKey({text:selection.text}));
  expect(buildStudySeed({text:'你好'},'안녕','nǐ hǎo').source).toEqual({kind:'manual'});
 });
});
describe('학생 사본 갱신',()=>{
 it('ignores runtime metadata and never imports private session state',()=>{
  const m=material(),base=sharedSnapshot(m);m.processed_json.metadata.classOperations={private:'draft'};m.processed_json.metadata.viewerRevision='new';m.processed_json.last_idx=30;
  expect(sharedSnapshot(m)).toEqual(base);
 });
 it('updates a teacher gloss while preserving a student override and identity',()=>{
  const m=material(),base=sharedSnapshot(m),next=material();next.processed_json.dictionary.id_0_one.meaning='새 뜻';
  expect(classCopyUpdatePlan(m,base,next).material.processed_json.dictionary.id_0_one.meaning).toBe('새 뜻');
  m.processed_json.dictionary.id_0_one.meaning='내 뜻';
  const plan=classCopyUpdatePlan(m,base,next);expect(plan.state).toBe('update');expect(plan.material.processed_json.dictionary.id_0_one.meaning).toBe('내 뜻');
  expect(plan.material.processed_json.sequence).toEqual(['id_0_one']);
 });
 it('holds unknown legacy baselines and personal/source text changes',()=>{
  const m=material(),base=sharedSnapshot(m),next=material();next.raw_text='图书室';
  expect(classCopyUpdatePlan(m,base,next).state).toBe('blocked');
  expect(classCopyUpdatePlan(m,null,next).state).toBe('blocked');
  expect(classCopyUpdatePlan(m,null,m).state).toBe('current');
  next.raw_text=m.raw_text;next.title='새 제목';m.raw_text+=' 개인 메모';expect(classCopyUpdatePlan(m,base,next).state).toBe('blocked');
 });
 it('allows appended expressions without altering existing tokens',()=>{
  const m=material(),base=sharedSnapshot(m),next=material();next.raw_text+='\n\n明天';next.processed_json.sequence.push('id_2_two');next.processed_json.dictionary.id_2_two={text:'明天',meaning:'내일'};
  const plan=classCopyUpdatePlan(m,base,next);expect(plan.state).toBe('update');expect(plan.summary.added).toBe(1);expect(plan.material.processed_json.dictionary.id_0_one).toEqual(m.processed_json.dictionary.id_0_one);
 });
 it('blocks changed segmentation instead of losing saved token locations',()=>{
  const m=material(),base=sharedSnapshot(m),next=material();next.processed_json.sequence=['id_0_a','id_0_b'];next.processed_json.dictionary={id_0_a:{text:'图书',meaning:'책'},id_0_b:{text:'馆',meaning:'관'}};
  expect(classCopyUpdatePlan(m,base,next).state).toBe('blocked');
 });
 it('keeps prepared explanations, edition/source metadata and personal changes',()=>{
  const m=material();m.lesson_explanation_ko='원래 해설';m.conversation_script='대화문';m.direction='read';m.processed_json.metadata.edition={id:'edition1'};m.processed_json.metadata.classSources={entry:{materialId:'2',quote:'图书馆'}};
  const base=sharedSnapshot(m),next=structuredClone(m);next.lesson_explanation_ko='새 해설';next.conversation_script='새 대화';m.conversation_script='내 대화 메모';
  const plan=classCopyUpdatePlan(m,base,next);expect(plan.material.lesson_explanation_ko).toBe('새 해설');expect(plan.material.conversation_script).toBe('내 대화 메모');expect(plan.material.processed_json.metadata.edition).toEqual({id:'edition1'});expect(plan.material.processed_json.metadata.classSources).toEqual(m.processed_json.metadata.classSources);
 });
 it('lookup errors cannot become permission to insert',async()=>{
  const chain={select:()=>chain,eq:()=>chain,not:()=>chain,order:()=>chain,range:()=>Promise.resolve({error:new Error('offline')})};
  await expect(findExistingCopies({from:()=>chain},'student')).rejects.toThrow('offline');
  const client={from:vi.fn()};await expect(claimSharedCopies(client,'student',{materials:[material()]})).rejects.toThrow('안전하게');expect(client.from).not.toHaveBeenCalled();
 });
});
