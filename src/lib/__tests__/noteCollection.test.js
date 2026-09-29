import {describe, expect, it} from 'vitest';
import {canSaveNoteCandidate, filterNoteCandidates, noteCollectionSummary, fetchNoteCollectionProgress} from '../noteCollection';
import {newStudyNote, validateStudyNote, mergeNoteCandidates, noteMaterialRow} from '../studyNotes';

const id='11111111-1111-4111-8111-111111111111';
const candidate=(extra={})=>({id, pageId:'page-1',elementIds:['ink'],originKey:'ink:1',original:'はし',text:'橋',base:'',reading:'はし',meaning:'다리',language:'Japanese',reviewed:false,excluded:false,...extra});

describe('collect now, review later',()=>{
  it('counts unfinished and ready without confusing them with saved vocabulary',()=>{
    const rows=[candidate(),candidate({reviewed:true}),candidate({vocabularyId:id}),candidate({excluded:true})];
    expect(noteCollectionSummary(rows)).toEqual({pending:2,ready:1,saved:1,excluded:1,all:4});
    expect(filterNoteCandidates(rows,'pending')).toEqual(rows.slice(0,2));
    expect(filterNoteCandidates(rows,'saved')).toEqual([rows[2]]);
    expect(filterNoteCandidates(rows,'excluded')).toEqual([rows[3]]);
    expect(filterNoteCandidates(rows,'all')).toEqual(rows);
  });
  it('keeps acknowledged saves visible even if old data also marked them excluded',()=>{
    expect(noteCollectionSummary([candidate({reviewed:true,vocabularyId:id,excluded:true})])).toEqual({pending:0,ready:0,saved:1,excluded:0,all:1});
  });
  it('requires reviewed text and meaning; whitespace and excluded/saved entries cannot be submitted',()=>{
    for(const value of [{},{reviewed:true,text:' '},{reviewed:true,meaning:' '},{reviewed:true,excluded:true},{reviewed:true,vocabularyId:id}])expect(canSaveNoteCandidate(candidate(value))).toBe(false);
    expect(canSaveNoteCandidate(candidate({reviewed:true}))).toBe(true);
  });
  it('resumes from the existing server document with edits and selection intact',()=>{
    const document=newStudyNote(id,'page-1');
    document.candidates=[candidate({reviewed:true,meaning:'수업에서 배운 다리'})];
    const restored=validateStudyNote(JSON.parse(JSON.stringify(document)));
    expect(noteCollectionSummary(restored.candidates)).toMatchObject({pending:1,ready:1});
    expect(restored.candidates).toEqual(document.candidates);
  });
  it('repeated collection does not reintroduce saved or excluded entries as pending',()=>{
    const saved=candidate({vocabularyId:id}),excluded=candidate({originKey:'ink:2',excluded:true});
    const merged=mergeNoteCandidates([saved,excluded],[candidate(),candidate({originKey:'ink:2'})]);
    expect(noteCollectionSummary(merged)).toMatchObject({pending:0,saved:1,excluded:1,all:2});
  });
  it('handles empty notes and does not modify candidate records while filtering',()=>{
    expect(noteCollectionSummary()).toEqual({pending:0,ready:0,saved:0,excluded:0,all:0});
    const rows=Object.freeze([Object.freeze(candidate())]);
    expect(filterNoteCandidates(rows,'pending')).toEqual(rows);
  });
  it('derives shelf counts from validated candidates rather than a caller supplied summary',()=>{
    const note={...newStudyNote(id,'page-1'),candidates:[candidate()],summary:{pending:99}};
    expect(noteMaterialRow('owner','note',note,id).processed_json.metadata.studyNote.summary).toEqual({pending:1,ready:0,saved:0,excluded:0,all:1});
  });
  it('reads only private owner summaries in bounded batches and leaves older counts unknown',async()=>{
    const calls=[];
    const client={from(table){const call={table,filters:[]};calls.push(call);return {select(value){call.select=value;return this;},eq(...args){call.filters.push(args);return this;},async in(key,ids){call.ids=ids;return {data:ids.map((id,i)=>({id,note_summary:i?null:{pending:2}}))};}};}};
    const result=await fetchNoteCollectionProgress(client,'owner',Array.from({length:21},(_,i)=>String(i+1)));
    expect(calls).toHaveLength(2);expect(calls[0].ids).toHaveLength(20);
    expect(calls[0].select).toBe('id,note_summary:processed_json->metadata->studyNote->summary');
    expect(calls[0].filters).toEqual([['owner_id','owner'],['visibility','private'],['processed_json->metadata->studyNote->>version','1']]);
    expect(result['1']).toEqual({pending:2});expect(result['2']).toEqual({pending:null});
  });
  it('does not mask a failed progress request as a zero count',async()=>{
    const query={select(){return this;},eq(){return this;},async in(){return {error:new Error('connection failed')};}};
    await expect(fetchNoteCollectionProgress({from:()=>query},'owner',['1'])).rejects.toThrow('connection failed');
    expect(await fetchNoteCollectionProgress({},'',[])).toEqual({});
  });
});
