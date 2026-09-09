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
  it('passes meaning, character form and cancellation to the existing lookup',async()=>{
    callGemini.mockResolvedValue('{"form":"ホスト国","warn":null}');
    const signal=new AbortController().signal;
    expect(await lookupJapaneseReference({word:'东道主',meaning:'주최국',form:'東道主',signal})).toEqual({form:'ホスト国',warn:null});
    const [prompt,receivedSignal,options]=callGemini.mock.calls[0];
    expect(prompt).toContain('"koreanMeaning":"주최국"');
    expect(prompt).toContain('"japaneseCharacterForm":"東道主"');
    expect(receivedSignal).toBe(signal);expect(options.responseMimeType).toBe('application/json');
  });
  it('does not invent an equivalent when the result is uncertain or the meaning is empty',async()=>{
    callGemini.mockResolvedValue('{"form":null}');
    await expect(lookupJapaneseReference({word:'字',meaning:'뜻',form:'字'})).rejects.toThrow('대응어를 확인하지 못했어요');
    callGemini.mockClear();
    await expect(lookupJapaneseReference({word:'字',meaning:''})).rejects.toThrow('뜻을 먼저');
    expect(callGemini).not.toHaveBeenCalled();
  });
});
