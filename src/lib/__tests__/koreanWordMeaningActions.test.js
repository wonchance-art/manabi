import {describe,expect,it} from 'vitest';
import {selectedKoreanWordTokens,koreanListContextRequest,koreanListContextEntries} from '../koreanWordMeaning';

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

describe('Korean list help in another explanation locale (main reanalysis parity)',()=>{
  // Two occurrences of 갔어요 on different CRLF lines, plus a repeated surface on the second line.
  const raw='학교에 갔어요.\r\n집에 갔어요 갔어요.';
  const lineTwo=raw.indexOf('집');
  const source=(id,surface,start,quoteStart,quoteEnd)=>({kind:'reading',tokenId:id,surface,sourceSpan:{start,end:start+surface.length,unit:'utf16'},
    quote:raw.slice(quoteStart,quoteEnd),quoteSpan:{start:quoteStart,end:quoteEnd,unit:'utf16'}});
  const sources={
    a:source('a','갔어요',4,0,lineTwo),
    b:source('b','갔어요',lineTwo+3,lineTwo,raw.length),
    c:source('c','갔어요',lineTwo+7,lineTwo,raw.length),
  };
  const rows=['a','b','c'].map(id=>({id,text:'갔어요',base_form:'가다'}));
  const fresh=(line,tokens)=>({sequence:tokens.map((_,index)=>`ko_${line}_${index}`),dictionary:Object.fromEntries(tokens.map(([text,start,meaning],index)=>
    [`ko_${line}_${index}`,{text,meaning,explanationLocale:'zh-TW',sourceSpan:{start,end:start+text.length,unit:'utf16',lineIndex:line},
      morphology:[{form:'-었-',function:'過去'},{bad:true}]}]))});
  it('requests each source line once without its line break and keeps line-relative spans',()=>{
    const {lines,positions}=koreanListContextRequest(rows,sources);
    expect(lines).toEqual(['학교에 갔어요.','집에 갔어요 갔어요.']);
    expect(positions).toEqual({a:{line:0,start:4,end:7,surface:'갔어요'},b:{line:1,start:3,end:6,surface:'갔어요'},c:{line:1,start:7,end:10,surface:'갔어요'}});
  });
  it('attaches each fresh meaning only to its own occurrence instead of merging the lemma',()=>{
    const {positions}=koreanListContextRequest(rows,sources);
    const results=[fresh(0,[['학교에',0,'到學校'],['갔어요',4,'去了']]),fresh(1,[['집에',0,'回家'],['갔어요',3,'回去了'],['갔어요',7,'又回去了']])];
    const morphology=[{form:'-었-',function:'過去'}];
    expect(koreanListContextEntries(results,positions,'zh-TW')).toEqual([
      {id:'a',text:'갔어요',meaning:'去了',morphology},
      {id:'b',text:'갔어요',meaning:'回去了',morphology},
      {id:'c',text:'갔어요',meaning:'又回去了',morphology},
    ]);
  });
  it('never borrows a meaning from a shifted span, another surface, another locale or a failed line',()=>{
    const {positions}=koreanListContextRequest(rows,sources);
    const shifted=[fresh(0,[['갔어요',5,'錯位']]),fresh(1,[['갔다',3,'別的詞'],['갔어요',7,'']])];
    expect(koreanListContextEntries(shifted,positions,'zh-TW')).toEqual([]);
    const otherLocale=[fresh(0,[['갔어요',4,'去了']]),fresh(1,[])];
    expect(koreanListContextEntries(otherLocale,positions,'zh-CN')).toEqual([]);
    const failed={sequence:['failed_0'],dictionary:{failed_0:{text:'갔어요',failed:true,meaning:'x',explanationLocale:'zh-TW',sourceSpan:{start:4,end:7}}}};
    expect(koreanListContextEntries([failed],positions,'zh-TW')).toEqual([]);
    expect(koreanListContextEntries(undefined,positions,'zh-TW')).toEqual([]);
  });
  it('skips rows whose stored source no longer matches the occurrence',()=>{
    const stale={...sources,b:{...sources.b,surface:'집에'},c:{...sources.c,sourceSpan:{start:lineTwo+8,end:lineTwo+11,unit:'utf16'}}};
    expect(koreanListContextRequest(rows,stale)).toEqual({lines:['학교에 갔어요.'],positions:{a:{line:0,start:4,end:7,surface:'갔어요'}}});
    expect(koreanListContextRequest([],sources)).toEqual({lines:[],positions:{}});
  });
});
