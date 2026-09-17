import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {contextMeaningKey,dictionaryMeaningChoices,meaningChoiceCorrection,normalizeContextMeaning,fetchContextMeaning} from '../viewerMeaningChoices';
const {getSession}=vi.hoisted(()=>({getSession:vi.fn()}));
vi.mock('../supabase',()=>({supabase:{auth:{getSession}}}));
const scope={userId:'owner',materialId:250,tokenId:'id_1_2',word:'东道主',surface:'东道主',meaning:'주최국',pos:'명사',sentence:'今天我请客，我来当东道主。'};
beforeEach(()=>{getSession.mockResolvedValue({data:{session:{access_token:'test-only',user:{id:'owner'}}}});});
afterEach(()=>vi.unstubAllGlobals());
describe('explicit, material-scoped meaning choices',()=>{
 it('keeps different senses of the same POS and never chooses the first automatically',()=>{
  const options=dictionaryMeaningChoices({meanings:[{meaning:'주최국',pos:'명사'},{meaning:'주인',pos:'명사'},{meaning:'주인',pos:'명사'},{meaning:'<invalid>'}]});
  expect(options.map(row=>row.meaning)).toEqual(['주최국','주인']);
  expect(meaningChoiceCorrection(scope,null)).toBeNull();
  expect(meaningChoiceCorrection(scope,options[0])).toBeNull();
  expect(meaningChoiceCorrection(scope,options[1])).toEqual({meaning:'주인',pos:'명사'});
 });
 it('AI cannot overwrite reading, identity or scheduling fields',()=>{
  expect(meaningChoiceCorrection(scope,{meaning:'손님을 맞이하는 주인',source:'context-ai',pos:'동사',furigana:'wrong',due:'today'})).toEqual({meaning:'손님을 맞이하는 주인'});
  expect(meaningChoiceCorrection(scope,{meaning:'주인',source:'untrusted'})).toBeNull();
 });
 it('scopes cache to account, material, token, sense, POS and the complete sentence',()=>{
  const first=contextMeaningKey(scope);
  for(const [key,value] of Object.entries({userId:'another',materialId:251,tokenId:'id_1_3',word:'主',surface:'主',meaning:'주인',pos:'동사',sentence:scope.sentence+'다른 문맥'}))expect(contextMeaningKey({...scope,[key]:value})).not.toEqual(first);
  const prefix='甲'.repeat(150);
  expect(contextMeaningKey({...scope,sentence:prefix+'我请客。'})).not.toEqual(contextMeaningKey({...scope,sentence:prefix+'会议。'}));
 });
 it('validates Korean candidate and accepts an explicit abstention',()=>{
  expect(normalizeContextMeaning({explanation:'문맥이 부족해요.',candidate:null})).toEqual({explanation:'문맥이 부족해요.',candidate:null});
  for(const meaning of ['host','<주인>','주인\n설명','가'.repeat(101)])expect(normalizeContextMeaning({explanation:'설명',candidate:{meaning}})).toBeNull();
 });
 it('checks current account before sending the explicitly selected sentence',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({explanation:'请客가 대접한다는 단서입니다.',candidate:{meaning:'손님을 맞이하는 주인'}})});vi.stubGlobal('fetch',fetch);
  const signal=new AbortController().signal;
  expect((await fetchContextMeaning({...scope,signal})).candidate.source).toBe('context-ai');
  expect(fetch.mock.calls[0][1].signal).toBe(signal);
  expect(JSON.parse(fetch.mock.calls[0][1].body).token.meaningChoice).toBe(true);
  getSession.mockResolvedValue({data:{session:{access_token:'test-only',user:{id:'another'}}}});
  await expect(fetchContextMeaning(scope)).rejects.toThrow('로그인 상태');expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('rejects failed or malformed responses, without saving anything',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,json:async()=>({error:{message:'제한'}})}));
  await expect(fetchContextMeaning(scope)).rejects.toThrow('제한');
  fetch.mockResolvedValue({ok:true,json:async()=>({explanation:'설명',candidate:{meaning:'host'}})});
  await expect(fetchContextMeaning(scope)).rejects.toThrow('뜻 후보');
 });
});
