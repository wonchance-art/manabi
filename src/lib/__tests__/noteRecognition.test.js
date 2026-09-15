import {describe,it,expect} from 'vitest';
import {recognitionElements,recognitionFingerprint,recognitionResult,recognizedCandidates} from '../noteRecognition';
import {newStudyNote,validateStudyNote,mergeNoteCandidates} from '../studyNotes';
const stroke={id:'a',type:'freedraw',x:10,y:20,width:30,height:40,points:[[0,0],[30,40]],version:1,roundness:{type:2,value:4},opacity:100};
const page={id:'p',elements:[stroke,{...stroke,id:'unselected',x:400}]};
describe('selected handwritten note recognition',()=>{
 it('rejects absent, duplicated, deleted, invisible and external selections',()=>{
  for(const ids of [[],['missing'],['a','a']])expect(()=>recognitionElements(page,ids)).toThrow();
  for(const change of [{isDeleted:true},{opacity:0},{type:'image'},{type:'embeddable'}])expect(()=>recognitionElements({id:'p',elements:[{...stroke,...change}]},['a'])).toThrow();
  expect(recognitionElements(page,['a'])).toEqual([stroke]);
 });
 it('tracks selected geometry/text but not JSONB key order, unselected words, or hidden metadata',async()=>{
  const before=await recognitionFingerprint(page,['a']);
  expect(await recognitionFingerprint({id:'p',elements:[{...stroke,roundness:{value:4,type:2},customData:{secret:'other material'}}]},['a'])).toBe(before);
  expect(await recognitionFingerprint({id:'p',elements:[{...stroke,points:[[0,0],[2,3]]}]},['a'])).not.toBe(before);
 });
 it('keeps kana as transcribed and all alternatives unreviewed, with no invented initial meaning',()=>{
  const result=recognitionResult({expressions:[{original:'はし',reading:'はし',uncertain:true,choices:[{text:'橋',meaning:'다리'},{text:'箸',meaning:'젓가락'}]}]});
  const capture={pageId:'p',elementIds:['a'],fingerprint:'a'.repeat(64)};
  const rows=recognizedCandidates(result,capture,'Japanese');
  expect(rows[0]).toMatchObject({text:'はし',meaning:'',reviewed:false,original:'はし',recognition:{uncertain:true}});
  const note=newStudyNote(crypto.randomUUID(),'p');note.board.pages[0].elements=[stroke];note.candidates=rows;
  expect(validateStudyNote(note).candidates[0].recognition.choices).toHaveLength(2);
  const edited={...rows[0],text:'箸',meaning:'젓가락',reviewed:true};
  expect(mergeNoteCandidates([edited],recognizedCandidates(result,capture,'Japanese'))).toEqual([edited]);
 });
 it('bounds provider output, ignores nonlanguage drawings, and suppresses English reading fields',()=>{
  expect(recognitionResult({expressions:[{original:'...',choices:[]}]})).toEqual([]);
  expect(()=>recognitionResult({expressions:Array(21).fill({original:'test'})})).toThrow();
  expect(()=>recognitionResult('not json')).toThrow();
  expect(recognizedCandidates([{original:'hello',reading:'helo'}],{pageId:'p',elementIds:['a'],fingerprint:'x'},'English')[0].reading).toBe('');
 });
});
