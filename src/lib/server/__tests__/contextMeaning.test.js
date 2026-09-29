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
 it('does not send an old gloss or POS that could anchor a different contextual sense',()=>{
  const prompt=buildContextMeaningPrompt(input);
  expect(prompt).toContain(JSON.stringify({sentence:input.sentence,word:input.word,surface:input.surface}));
  expect(prompt).not.toContain('주최국');
  expect(buildContextMeaningPrompt({...input,currentMeaning:'접대하는 사람 또는 주최 측',pos:'동사'})).toBe(prompt);
  expect(prompt).toContain('같은 품사라도');expect(prompt).toContain('uncertain:true');
 });
 it('asks for one evidenced use rather than a dictionary list of possible senses',()=>{
  const prompt=buildContextMeaningPrompt(input);
  expect(prompt).toContain('뜻 하나만');expect(prompt).toContain('다른 상황에서만 가능한 뜻');
  expect(prompt).toContain('meaning과 reason은 같은 쓰임');expect(prompt).toContain('뜻 사이에서 결정하지 못하면 uncertain:true, meaning:null');
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
