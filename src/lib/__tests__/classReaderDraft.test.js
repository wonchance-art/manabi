import {describe,it,expect} from 'vitest';
import {readerDraftScope,readerDraftValue,readerDraftContext,newestReaderDrafts,hydrateReaderDrafts,classroomSaveLabel,isClassComposing} from '../classReaderDraft';
const scope=readerDraftScope('owner','team','2026-09-11',12);
const selection={text:'明天',source:{kind:'manual'}};
const value={input:'明天',selection,meaning:'내일',reading:'míng tiān'};
const row=(id='one',updatedAt=1)=>({id,revision:id,scope,kind:'draft',category:'reader',context:'manual',value,updatedAt});
describe('class reader draft contracts',()=>{
  it('isolates owner, team, day and material without delimiter collisions',()=>{
    expect(new Set([scope,readerDraftScope('another','team','2026-09-11',12),readerDraftScope('owner','other','2026-09-11',12),readerDraftScope('owner','team','2026-09-12',12),readerDraftScope('owner','team','2026-09-11',13)]).size).toBe(5);
    expect(readerDraftScope('a:b','c','d',1)).not.toBe(readerDraftScope('a','b:c','d',1));
  });
  it('keeps only input, selected source and edited gloss, never whole dictionaries',()=>{
    expect(readerDraftValue({...value,fullBook:'private',selection:{...selection,dictionary:{private:1}}})).toEqual(value);
    expect(readerDraftValue({input:'未查'})).toEqual({input:'未查',selection:null,meaning:'',reading:''});
  });
  it('rejects corrupted or oversized drafts instead of silently truncating user edits',()=>{
    for(const invalid of [{...value,input:'a'.repeat(301)},{...value,meaning:'a'.repeat(501)},{...value,reading:'a'.repeat(501)},{...value,selection:{...selection,text:'a'.repeat(5001)}},{...value,input:null}])expect(readerDraftValue(invalid)).toBeNull();
  });
  it('retains source positions but strips unrelated source fields',()=>{
    const source={materialId:12,quote:'明天',tokenId:'id1',secret:'no',anchor:{type:'TextQuoteSelector',exact:'明天',prefix:'',suffix:'见',start:0,end:2}};
    const saved=readerDraftValue({...value,selection:{text:'明天',source}});
    expect(saved.selection.source.materialId).toBe('12');expect(saved.selection.source.secret).toBeUndefined();
    expect(readerDraftValue({...value,selection:{text:'明天',source:{...source,quote:'昨天'}}})).toBeNull();
  });
  it('shows newest drafts in this scope without mutating records from other writers',()=>{
    const rows=[row('older',1),row('newer',2),{...row('alien',3),scope:'other'},{...row('outbox',4),kind:'queued'},{...row('live',5),category:undefined}];
    expect(newestReaderDrafts(rows,scope).map(r=>r.id)).toEqual(['newer']);expect(rows.map(r=>r.id)).toEqual(['older','newer','alien','outbox','live']);
  });
  it('excludes malformed identity/context records from recovery',()=>{
    expect(newestReaderDrafts([{...row(),id:null},{...row(),revision:null},{...row(),context:'wrong'}],scope)).toEqual([]);
  });
  it('a late storage response never replaces typing already started on screen',()=>{
    const restored={...row('old',999),value:{...value,meaning:'이전 뜻'}};
    const editing={...row('new',1),value:{...value,meaning:'지금 입력한 뜻'}};
    expect(hydrateReaderDrafts([restored],scope,[editing])[0].value.meaning).toBe('지금 입력한 뜻');
  });
  it('manual query changes share a draft slot, different source locations do not',()=>{
    expect(readerDraftContext(selection)).toBe(readerDraftContext({...selection,text:'学校'}));
    const a={text:'明天',source:{materialId:12,quote:'明天',anchor:{type:'TextQuoteSelector',exact:'明天',prefix:'',suffix:'',start:0,end:2}}};
    expect(readerDraftContext(a)).not.toBe(readerDraftContext({...a,source:{...a.source,anchor:{...a.source.anchor,start:10,end:12}}}));
  });
  it('never says server confirmed when reads failed, offline, loading or a write is uncertain',()=>{
    const base={error:null,online:true,queue:[],loading:false};
    expect(classroomSaveLabel(base)).toBe('서버 저장 확인됨');
    for(const state of [{error:new Error('network')},{online:false},{loading:true},{queue:[{status:'sending'}]},{queue:[{status:'error'}]}])expect(classroomSaveLabel({...base,...state})).not.toBe('서버 저장 확인됨');
  });
  it('treats composition flags and candidate-confirmation key as IME, not submit',()=>{
    for(const [event,active] of [[{},true],[{isComposing:true},false],[{nativeEvent:{isComposing:true}},false],[{keyCode:229},false],[{nativeEvent:{keyCode:229}},false]])expect(isClassComposing(event,active)).toBe(true);
    expect(isClassComposing({key:'Enter',keyCode:13},false)).toBe(false);
  });
});
