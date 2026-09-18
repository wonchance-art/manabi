import {describe,it,expect} from 'vitest';
import corpus from '../../../e2e/fixtures/lexical-senses.json';
import {mergeNoteCandidates,noteCandidatePayload} from '../studyNotes';
import {japaneseReferenceForMeaning,japaneseReferenceKey} from '../viewerJapaneseReference';
const id='00000000-0000-4000-8000-000000000001';
describe('source-supported sense contracts (fixed data, not provider accuracy)',()=>{
 it.each(corpus.cases)('$id keeps reviewed meaning and reading after another recognition',row=>{
  const reviewed={...row,id,originKey:`ink:${row.id}`,pageId:'page',reviewed:true,excluded:false};
  const result=mergeNoteCandidates([reviewed],[{...reviewed,id:'incoming',meaning:row.rejectMeaning,reading:'wrong',reviewed:false}]);
  expect(result).toEqual([reviewed]);
  const payload=noteCandidatePayload('123',result[0]);
  expect(payload.word).toMatchObject({word_text:row.text,meaning:row.meaning,furigana:row.reading,language:row.language});
  expect(payload.source).toEqual({kind:'reading',materialId:'123',noteCandidateId:id});
  expect(()=>noteCandidatePayload('123',{...reviewed,reviewed:false})).toThrow();
  expect(()=>noteCandidatePayload('123',{...reviewed,excluded:true})).toThrow();
 });
 it.each(corpus.cases.filter(row=>row.language==='Chinese'))('$id does not reuse a different meaning or POS',row=>{
  const entry={meanings:[{meaning:row.rejectMeaning,pos:row.pos,ja:{form:'別の意味'}},{meaning:row.meaning,pos:row.pos,ja:{form:row.jaExample}}]};
  expect(japaneseReferenceForMeaning(entry,row.meaning,{pos:row.pos})).toEqual({form:row.jaExample,warn:null});
  const otherPos=row.pos==='동사'?'명사':'동사';
  expect(japaneseReferenceForMeaning(entry,row.meaning,{pos:otherPos})).toBeNull();
  expect(japaneseReferenceKey({...row,word:row.text})).not.toEqual(japaneseReferenceKey({...row,word:row.text,meaning:row.rejectMeaning}));
 });
});
