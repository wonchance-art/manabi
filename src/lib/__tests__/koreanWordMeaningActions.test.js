import {describe,expect,it} from 'vitest';
import {selectedKoreanWordTokens} from '../koreanWordMeaning';

describe('Korean list selections keep the original occurrences',()=>{
  const dictionary={a:{text:'눈을',base_form:'눈',meaning:'眼睛'},b:{text:'눈이',base_form:'눈',meaning:'雪'},space:{text:' '}};
  const sources={a:{tokenId:'a',surface:'눈을',sourceSpan:{start:0,end:2,unit:'utf16'}},
    b:{tokenId:'b',surface:'눈이',sourceSpan:{start:8,end:10,unit:'utf16'}}};
  it('does not deduplicate different senses by lemma',()=>{
    expect(selectedKoreanWordTokens(dictionary,['a','space','b'],sources)).toEqual([{...dictionary.a,id:'a'},{...dictionary.b,id:'b'}]);
  });
  it('uses the confirmed second selection instead of searching for the first matching text',()=>{
    const dict={a:{...dictionary.a},b:{...dictionary.a}};
    const refs={...sources,b:{...sources.b,surface:'눈을'}};
    expect(selectedKoreanWordTokens(dict,['b'],refs).map(token=>token.id)).toEqual(['b']);
  });
  it('does not manufacture a source for detached or stale analysis rows',()=>{
    expect(selectedKoreanWordTokens(dictionary,['a','missing'],{a:{...sources.a,surface:'손을'}})).toEqual([]);
    expect(selectedKoreanWordTokens(dictionary,undefined,sources)).toEqual([]);
  });
});
