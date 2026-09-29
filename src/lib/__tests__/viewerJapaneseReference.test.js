import {beforeEach,describe,expect,it,vi} from 'vitest';
import {japaneseReferenceForMeaning,lookupJapaneseReference,normalizeJapaneseReference} from '../viewerJapaneseReference';
const {callGemini}=vi.hoisted(()=>({callGemini:vi.fn()}));
vi.mock('../gemini',()=>({callGemini,parseGeminiJSON:JSON.parse}));

beforeEach(()=>callGemini.mockReset());
describe('Japanese equivalents preserve the selected Chinese sense',()=>{
  const entry={meanings:[{meaning:'공부',ja:{form:'勉強'}},{meaning:'억지로 하다',ja:{form:'無理強い',warn:'공부',yomi:'むりじい'}}]};
  it('uses the matching meaning even when another meaning comes first',()=>{
    expect(japaneseReferenceForMeaning(entry,'억지로 하다')).toEqual({form:'無理強い',warn:'공부'});
    expect(japaneseReferenceForMeaning(entry,'마지못하다')).toBeNull();
    expect(japaneseReferenceForMeaning(entry,'')).toBeNull();
  });
  it('does not trust missing or malformed dictionary values',()=>{
    for(const value of [null,[],{form:null},{form:' '},{form:'<script>'},{form:'a\nb'},{form:'a'.repeat(81)}])expect(normalizeJapaneseReference(value)).toBeNull();
    expect(japaneseReferenceForMeaning({meanings:[{meaning:'주최국',ja:null}]},'주최국')).toBeNull();
    expect(normalizeJapaneseReference({form:' ホスト国 ',warn:' ',diff:true})).toEqual({form:'ホスト国',warn:null});
  });
  it('rejects the observed Korean output and mixed Korean glosses from both lookup sources',async()=>{
    for(const form of ['주최자','主催者 (주최자)','host','123','🎌']){
      expect(normalizeJapaneseReference({form})).toBeNull();
      expect(japaneseReferenceForMeaning({meanings:[{meaning:'주인',ja:{form}}]},'주인')).toBeNull();
    }
    callGemini.mockResolvedValue(JSON.stringify({form:'주최자',warn:'東道主는 현대 일본어에서 거의 사용되지 않는 고어 표현입니다.'}));
    await expect(lookupJapaneseReference({word:'东道主',meaning:'손님을 맞이하는 주인',pos:'명사',form:'東道主'})).rejects.toThrow('대응어를 확인하지 못했어요');
    expect(callGemini).toHaveBeenCalledTimes(1);
  });
  it('keeps kanji, kana and Japanese phrases with Latin abbreviations',()=>{
    for(const form of ['主催者','もてなす人','ホスト','SNSを使う','ＯＫする']){
      expect(normalizeJapaneseReference({form,warn:null})).toEqual({form,warn:null});
    }
  });
  it('translates the selected sense without suggesting a converted glyph and retains cancellation',async()=>{
    callGemini.mockResolvedValue('{"form":"ホスト国","warn":null}');
    const signal=new AbortController().signal;
    expect(await lookupJapaneseReference({word:'东道主',meaning:'주최국',form:'東道主',signal})).toEqual({form:'ホスト国',warn:null});
    const [prompt,receivedSignal,options]=callGemini.mock.calls[0];
    expect(prompt).toContain('"koreanMeaning":"주최국"');
    expect(prompt).not.toContain('japaneseCharacterForm');
    expect(prompt).not.toContain('東道主');
    expect(receivedSignal).toBe(signal);expect(options.responseMimeType).toBe('application/json');
  });
  it('does not let glyph metadata anchor the request or return a second warning-generation task',async()=>{
    callGemini.mockResolvedValue('{"form":"もてなす人","warn":"별개의 자형 설명"}');
    const selection={word:'东道主',meaning:'접대하는 사람',pos:'명사'};
    expect(await lookupJapaneseReference({...selection,form:'東道主'})).toEqual({form:'もてなす人',warn:null});
    await lookupJapaneseReference({...selection,form:'다른 자형'});
    expect(callGemini.mock.calls[0][0]).toBe(callGemini.mock.calls[1][0]);
    expect(callGemini.mock.calls[0][0]).toContain('드문 한자어·고어');
    expect(callGemini.mock.calls[0][0]).toContain('form:null로 보류');
  });
  it('does not invent an equivalent when the result is uncertain or the meaning is empty',async()=>{
    callGemini.mockResolvedValue('{"form":null}');
    await expect(lookupJapaneseReference({word:'字',meaning:'뜻',form:'字'})).rejects.toThrow('대응어를 확인하지 못했어요');
    callGemini.mockClear();
    await expect(lookupJapaneseReference({word:'字',meaning:''})).rejects.toThrow('뜻을 먼저');
    expect(callGemini).not.toHaveBeenCalled();
  });
});
