import {describe,it,expect} from 'vitest';
import {wordRecordKey,savedWordRecord,pendingWordRecord,wordRecordSummary} from '../teachingWordRecord';
const word={text:'复习',meaning:'복습하다',source:{kind:'manual'}};
const note={raw_text:'复习',processed_json:{metadata:{classEntries:[{id:'a',idx:0,text:'复习'}],classMeanings:{a:{text:'复习',meaning:'복습하다'}}}}};
describe('explicit teaching word records',()=>{
 it('keeps different senses of the same word distinct',()=>{
  expect(wordRecordKey(word)).not.toBe(wordRecordKey({...word,meaning:'연습'}));
  expect(savedWordRecord(note,word)?.id).toBe('a');
  expect(savedWordRecord(note,{...word,meaning:'연습'})).toBeUndefined();
  const queue=[{text:word.text,seed:{source:word.source,meaning:word.meaning},status:'queued'}];
  expect(pendingWordRecord(queue,word)).toBe(queue[0]);
  expect(pendingWordRecord(queue,{...word,meaning:'연습'})).toBeUndefined();
 });
 it('does not confuse queued or failed writes with confirmed server saves',()=>{
  expect(wordRecordSummary(['수업에 남김','저장 대기 중'])).toBe('저장 대기 중');
  expect(wordRecordSummary(['수업에 남김','저장 확인 필요'])).toBe('저장 확인 필요');
  expect(wordRecordSummary(['수업에 남김',null])).toBeNull();
  expect(wordRecordSummary(['수업에 남김','수업에 남김'])).toBe('수업에 남김');
  expect(wordRecordSummary([])).toBeNull();
 });
});
