import {beforeEach,describe,expect,it,vi} from 'vitest';
import {japaneseReferenceKey,lookupJapaneseReference,japaneseReferenceForMeaning} from '../viewerJapaneseReference';
const {callGemini}=vi.hoisted(()=>({callGemini:vi.fn()}));
vi.mock('../gemini',()=>({callGemini,parseGeminiJSON:JSON.parse}));
const selection={userId:'teacher',word:'研究',meaning:'연구',pos:'명사',form:'研究'};
beforeEach(()=>callGemini.mockReset());

describe('Japanese references stay within the explicitly selected sense and POS',()=>{
  it.each([
    ['userId','student'],['word','学习'],['meaning','연구하다'],['pos','동사'],['form','学習'],
  ])('does not share cached responses after %s changes',(key,value)=>{
    expect(japaneseReferenceKey({...selection,[key]:value})).not.toEqual(japaneseReferenceKey(selection));
  });
  it('versions old POS-free responses out and handles unknown POS without invention',()=>{
    expect(japaneseReferenceKey(selection).slice(0,2)).toEqual(['viewer-japanese-reference',2]);
    expect(japaneseReferenceKey({...selection,pos:undefined})[5]).toBe('');
    expect(japaneseReferenceKey({...selection,pos:undefined})).not.toEqual(japaneseReferenceKey(selection));
    expect(japaneseReferenceKey({...selection,userId:null})[2]).toBe('guest');
  });
  it('trims boundaries without collapsing distinct selected meanings',()=>{
    expect(japaneseReferenceKey({...selection,word:' 研究 ',pos:' 명사 '})).toEqual(japaneseReferenceKey(selection));
    expect(japaneseReferenceKey({...selection,meaning:'연구, 조사'})).not.toEqual(japaneseReferenceKey({...selection,meaning:'연구 조사'}));
  });
  it.each(['명사','동사',undefined])('sends the selected POS %s and no surrounding document',async pos=>{
    callGemini.mockResolvedValue('{"form":"研究","warn":null}');
    const controller=new AbortController();
    await lookupJapaneseReference({...selection,pos,signal:controller.signal});
    const [prompt,signal]=callGemini.mock.calls[0];
    const data=JSON.parse(prompt.split('\n')[1]);
    expect(data).toEqual({chinese:'研究',koreanMeaning:'연구',partOfSpeech:pos||null,japaneseCharacterForm:'研究'});
    expect(signal).toBe(controller.signal);
  });
  it('uses dictionary senses with the matching POS even when another comes first',()=>{
    const entry={meanings:[{meaning:'연구',pos:'동사',ja:{form:'研究する'}},{meaning:'연구',pos:'명사',ja:{form:'研究'}}]};
    expect(japaneseReferenceForMeaning(entry,'연구',{pos:'명사'})).toEqual({form:'研究',warn:null});
    expect(japaneseReferenceForMeaning(entry,'연구',{pos:'동사'})).toEqual({form:'研究する',warn:null});
    expect(japaneseReferenceForMeaning(entry,'연구',{pos:'형용사'})).toBeNull();
  });
});
