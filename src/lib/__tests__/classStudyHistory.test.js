import {describe,it,expect} from 'vitest';
import {classHistoryEntries,filterClassHistory} from '../classStudyHistory';
describe('class history semantics',()=>{
 it('distinguishes direct input, verified textbook source and unknown legacy entry',()=>{
  const note={raw_text:'学校\n图书馆\n你好',processed_json:{metadata:{classEntries:[{id:'a',idx:0,text:'学校'},{id:'b',idx:1,text:'图书馆'},{id:'c',idx:2,text:'你好'}],classSources:{a:{kind:'manual'},b:{materialId:'2',tokenId:'x'},c:{materialId:'private'}}},sequence:[],dictionary:{}}};
  const entries=classHistoryEntries(note,['2']);expect(entries.map(e=>e.source?.kind)).toEqual(['manual','textbook',undefined]);expect(entries[2].source).toBe(null);
 });
 it('searches meanings/readings/dates and filters only explicit outside-textbook entries',()=>{
  const notes=[{day:'2026-09-10',entries:[{text:'学校',meaning:'학교',reading:'がっこう',source:{kind:'manual'}},{text:'你好',meaning:'안녕',source:null}]}];
  expect(filterClassHistory(notes,'학교')[0].entries[0].text).toBe('学校');expect(filterClassHistory(notes,'2026-09',true)[0].entries).toHaveLength(1);expect(filterClassHistory(notes,'안녕',true)).toHaveLength(0);
 });
});
