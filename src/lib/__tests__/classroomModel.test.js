import { describe,it,expect,vi } from 'vitest';
import { classroomEntries,classMeaningPatch,classLinkPath,classroomScope,appendClassroomEntry,classroomPlainText,classroomAnalysisIndices } from '../classroomModel';
function note(tokens){return {id:1,title:'수업',raw_text:'東道主',processed_json:{sequence:tokens.map((_,i)=>`id_0_${i}`),dictionary:Object.fromEntries(tokens.map((t,i)=>[`id_0_${i}`,t])),metadata:{language:'Chinese',classEntries:[{id:'stable',idx:0,text:'東道主'}]}}};}
describe('classroom learner meaning',()=>{
 it('only retries completed empty glosses on explicit request, preserving manual primary meanings',()=>{
  const n=note([{text:'東道主',pos:'명사',meaning:''}]);
  n.processed_json.metadata.classMeanings={stable:{text:'東道主',meaning:'호스트 국가'}};
  expect(classroomEntries(n)[0]).toMatchObject({primary:'호스트 국가',missingMeanings:true});
  expect(classroomAnalysisIndices(n)).toEqual([]);
  expect(classroomAnalysisIndices(n,true)).toEqual([0]);
  n.processed_json.dictionary.id_0_0.meaning='주최자';
  expect(classroomEntries(n)[0].primary).toBe('호스트 국가');
  expect(classroomAnalysisIndices(n,true)).toEqual([]);
 });
 it('does not treat missing sentence translation, punctuation, or deliberately cleared gloss as an enrichment failure',()=>{
  const sentence=note([{text:'東',meaning:'동쪽'},{text:'道主',meaning:'주인'},{text:'。',pos:'기호',meaning:''}]);
  expect(classroomEntries(sentence)[0].primary).toBe('');
  expect(classroomAnalysisIndices(sentence,true)).toEqual([]);
  const corrected=note([{text:'東道主',pos:'명사',meaning:''}]);
  corrected.processed_json.metadata.viewerCorrections={id_0_0:['meaning']};
  expect(classroomAnalysisIndices(corrected,true)).toEqual([]);
 });
 it('shows a single word meaning but not joined sentence glosses',()=>{
  expect(classroomEntries(note([{text:'東道主',pos:'명사',meaning:'주최국',furigana:'dōng dào zhǔ'}]))[0].primary).toBe('주최국');
  const e=classroomEntries(note([{text:'東',meaning:'동쪽'},{text:'道主',meaning:'주인'}]))[0];expect(e.primary).toBe('');expect(e.meaning).toBe('동쪽 · 주인');
 });
 it('preserves manually empty and edited meanings on the exact anchored text',()=>{
  const n=note([{text:'東道主',meaning:'자동'}]),entry=classroomEntries(n)[0];n.processed_json.metadata={...n.processed_json.metadata,...classMeaningPatch(n,entry,'호스트 국가')};
  expect(classroomEntries(n)[0].primary).toBe('호스트 국가');n.processed_json.metadata.classMeanings.stable.meaning='';expect(classroomEntries(n)[0].primary).toBe('');
  n.raw_text='다른 원문';expect(()=>classMeaningPatch(n,entry,'뜻')).toThrow();expect(classroomEntries(n)[0].manual).toBe(false);
 });
 it('does not export multiple glosses as a translation',()=>expect(classroomPlainText(note([{text:'東',meaning:'동쪽'},{text:'道主',meaning:'주인'}]))).not.toContain('동쪽'));
 it('omits reading for English and French',()=>{for(const lang of ['English','French']){const n=note([{text:'word',meaning:'뜻',furigana:'pronunciation'}]);n.processed_json.metadata.language=lang;expect(classroomEntries(n)[0].reading).toBe('');}});
});
describe('classroom boundary',()=>{
 it('routes valid class links only',()=>{const origin='https://teset-gilt.vercel.app';expect(classLinkPath(origin+'/class/team-a?open=123',origin)).toBe('/class/team-a');expect(classLinkPath('team-a',origin)).toBe('/class/team-a');for(const bad of ['javascript:alert(1)','https://other.test/class/a','/viewer/123','/class/../admin','https://name:secret@teset-gilt.vercel.app/class/a'])expect(classLinkPath(bad,origin)).toBe(null);});
 it('separates owner, team and day',()=>{expect(new Set([classroomScope('a','x','2026-09-10'),classroomScope('b','x','2026-09-10'),classroomScope('a','y','2026-09-10'),classroomScope('a','x','2026-09-11')]).size).toBe(4);});
 it('retries using the same operation and never falls back to unsafe insert',async()=>{const rpc=vi.fn().mockResolvedValue({error:{code:'PGRST202'}});const operation={rootId:4,day:'2026-09-10',text:'原文',id:'operation'};await expect(appendClassroomEntry({rpc},operation)).rejects.toEqual({code:'PGRST202'});await expect(appendClassroomEntry({rpc},operation)).rejects.toEqual({code:'PGRST202'});expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);});
});

it('only definitely unsent requests can be discarded without server confirmation',async()=>{
 const {canDiscardClassOperation}=await import('../classroomOutbox');
 expect(canDiscardClassOperation({attempted:false})).toBe(true);
 expect(canDiscardClassOperation({attempted:true,errorCode:'PGRST202'})).toBe(true);
 expect(canDiscardClassOperation({attempted:true,errorCode:'42501'})).toBe(true);
 expect(canDiscardClassOperation({attempted:true,errorCode:'503'})).toBe(false);
 expect(canDiscardClassOperation({attempted:true,errorCode:''})).toBe(false);
});
