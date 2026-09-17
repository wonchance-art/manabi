import {describe,it,expect} from 'vitest';
import {contextMeaningInput,buildContextMeaningPrompt,parseContextMeaning} from '../contextMeaning';
const input={sentence:'今天我请客，我来当东道主。',word:'东道主',surface:'东道主',currentMeaning:'주최국',pos:'명사'};
describe('contextual meaning proposal boundary',()=>{
 it('requires an observed surface and preserves complete bounded context',()=>{
  expect(contextMeaningInput(input,'Chinese')).toEqual(input);
  for(const patch of [{surface:'车'},{word:''},{sentence:'甲'.repeat(2001)}, {sentence:null}])expect(contextMeaningInput({...input,...patch},'Chinese')).toBeNull();
  expect(contextMeaningInput(input,'Japanese')).toBeNull();
  const long={...input,sentence:'甲'.repeat(250)+input.sentence};expect(contextMeaningInput(long,'Chinese').sentence).toBe(long.sentence);
 });
 it('does not treat the old same-POS meaning as ground truth',()=>{
  const prompt=buildContextMeaningPrompt(input);expect(prompt).toContain('같은 품사라도');expect(prompt).toContain(JSON.stringify(input));expect(prompt).toContain('uncertain:true');
 });
 it('accepts the observed host-sense correction as a proposal',()=>{
  expect(parseContextMeaning(JSON.stringify({word:'东道主',meaning:'손님을 맞이하는 주인',uncertain:false,reason:'请客라는 말에서 대접하는 사람임을 알 수 있어요.'}),input)).toEqual({candidate:{meaning:'손님을 맞이하는 주인',source:'context-ai'},explanation:'请客라는 말에서 대접하는 사람임을 알 수 있어요.'});
 });
 it('requires exact lexical identity and rejects contradiction or malformed output',()=>{
  const valid={word:input.word,meaning:'주인',uncertain:false,reason:'문맥 설명'};
  for(const patch of [{word:'主'},{uncertain:true},{meaning:null},{meaning:'host'},{reason:''},{reason:'<script>'},{uncertain:'false'}])expect(parseContextMeaning(JSON.stringify({...valid,...patch}),input)).toBeNull();
  expect(parseContextMeaning('not json',input)).toBeNull();
  expect(parseContextMeaning(JSON.stringify({...valid,uncertain:true,meaning:null}),input).candidate).toBeNull();
 });
});
