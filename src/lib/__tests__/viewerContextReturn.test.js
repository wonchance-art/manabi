import {describe,expect,it} from 'vitest';
import {readingSourceTarget,reviewSourceContexts,sourceHref} from '../learningSources';
import {shouldReadComposerOriginal} from '../materialComposer';

const make=lines=>{const sequence=[],dictionary={};lines.forEach((words,line)=>{words.forEach((text,i)=>{const id=`new_${line}_${i}`;sequence.push(id);dictionary[id]={text,pos:'명사'};});const id=`newline_${line}`;sequence.push(id);dictionary[id]={text:'\n',pos:'개행'};});return {sequence,dictionary};};
const contextId='00000000-0000-4000-8000-000000000041';
describe('saved context returns to the intended occurrence',()=>{
  const json=make([['眼前','有','山','。'],['眼前','有','海','。']]);
  it('recovers a regenerated ID from its saved quote',()=>{
    expect(readingSourceTarget(json,{locator:{tokenId:'stale',surface:'眼前'},quote:'眼前有海。'})).toBe('new_1_0');
  });
  it('rejects an ID reused in the wrong sentence',()=>{
    expect(readingSourceTarget(json,{locator:{tokenId:'new_0_0',surface:'眼前'},quote:'眼前有海。'})).toBe('new_1_0');
  });
  it('does not guess the first word if the quote or occurrence is ambiguous',()=>{
    expect(readingSourceTarget(json,{locator:{surface:'眼前'}})).toBeNull();
    expect(readingSourceTarget(json,{locator:{tokenId:'new_0_0',surface:'眼前'},quote:'眼前有河。'})).toBeNull();
    expect(readingSourceTarget(make([['眼前','有','眼前']]),{locator:{surface:'眼前'},quote:'眼前有眼前'})).toBeNull();
  });
  it('supports a multi-token selection without matching inside a larger word',()=>{
    expect(readingSourceTarget(json,{locator:{surface:'眼前有海'},quote:'眼前有海。'})).toBe('new_1_0');
    expect(readingSourceTarget(json,{locator:{surface:'眼'}})).toBeNull();
  });
  it('supports old unique surface and base-form links',()=>{
    expect(readingSourceTarget(json,{locator:{surface:'海'}})).toBe('new_1_2');
    const inflected=make([['食べた']]);inflected.dictionary.new_0_0.base_form='食べる';
    expect(readingSourceTarget(inflected,{locator:{surface:'食べる'}})).toBe('new_0_0');
  });
  it('keeps quotes out of new URLs while retaining old URLs',()=>{
    expect(sourceHref({id:contextId,kind:'reading',material_id:211,locator:{tokenId:'private',surface:'private'},quote:'private quote'})).toBe(`/viewer/211?sourceContext=${contextId}`);
    expect(sourceHref({kind:'reading',material_id:211,locator:{surface:'山'}})).toBe('/viewer/211?sourceText=%E5%B1%B1');
    const material={raw_text:'a',processed_json:{metadata:{language:'Chinese',composer:{version:1}}}};
    expect(shouldReadComposerOriginal(material,new URLSearchParams(`sourceContext=${contextId}`))).toBe(false);
  });
});

describe('review shows one primary context and preserves legacy sources',()=>{
  const word={word_text:'眼前',source_material_id:211,source_sentence:'眼前有海。'};
  const contexts=[{id:'a',kind:'reading',material_id:188,quote:'眼前有山。',href:'/viewer/188'},{id:'b',kind:'reading',material_id:211,quote:'眼前有海。',href:'/viewer/211'}];
  it('prefers the originally saved quote and excludes it from the other contexts',()=>{
    const result=reviewSourceContexts(word,contexts);
    expect(result.primary.id).toBe('b');expect(result.others.map(c=>c.id)).toEqual(['a']);
  });
  it('retains original quote and link when connected contexts are unavailable',()=>{
    expect(reviewSourceContexts(word).primary).toMatchObject({quote:'眼前有海。',legacy:true,href:'/viewer/211?sourceText=%E7%9C%BC%E5%89%8D'});
    expect(reviewSourceContexts({...word,source_material_id:null}).primary).toEqual({quote:'眼前有海。',legacy:true});
    expect(reviewSourceContexts({}).primary).toBeNull();
  });
});

// 뷰어 v2 AD-R3 §4.3 — 묶은 뒤에도 저장 문맥이 그 자리로 돌아간다. 구성 토큰 id는 경계 기록 base에 남아 있으므로
// 「그 구간을 덮는 지금 토큰」 하나를 찾는다. 다시 나누면 원래 id가 돌아와 ① 규칙으로 정확히 맞는다.
describe('saved context survives a boundary edit (AD-R3 §4.3)',()=>{
  const tok=text=>({text,base_form:text,pos:'명사'});
  const line0=[['id_0_0_t',tok('运动员')],['id_0_1_t',tok('的')],['id_0_2_t',tok('身体')],['id_0_3_t',tok('素质')],['id_0_4_t',tok('非常')],['id_0_5_t',tok('好')],['id_0_6_t',{text:'。',pos:'기호'}]];
  const line1=[['id_1_0_t',tok('身体')],['id_1_1_t',tok('好')],['id_1_2_t',{text:'。',pos:'기호'}]];
  const build=(rows0,edits)=>{
    const sequence=[],dictionary={};
    for(const [id,t] of rows0){sequence.push(id);dictionary[id]=t;}
    sequence.push('br_0_t');dictionary.br_0_t={text:'\n',pos:'개행'};
    for(const [id,t] of line1){sequence.push(id);dictionary[id]=t;}
    return {sequence,dictionary,metadata:{language:'Chinese',...(edits?{viewerBoundaries:{version:1,edits}}:{})}};
  };
  const record={id:'b_1',line:0,start:4,end:8,text:'身体素质',cuts:[],status:'applied',base:[{id:'id_0_2_t',token:tok('身体')},{id:'id_0_3_t',token:tok('素质')}]};
  const merged=build([...line0.slice(0,2),['id_0_e2_rev',{...tok('身体素质'),boundary:'user'}],...line0.slice(4)],[record]);
  const saved={locator:{tokenId:'id_0_2_t',surface:'身体'},quote:'运动员的身体素质非常好。'};
  it('returns the merged token that now covers the saved word',()=>{
    expect(readingSourceTarget(build(line0),saved)).toBe('id_0_2_t');
    expect(readingSourceTarget(merged,saved)).toBe('id_0_e2_rev');
    expect(readingSourceTarget(merged,{locator:{tokenId:'id_0_3_t',surface:'素质'},quote:saved.quote})).toBe('id_0_e2_rev');
  });
  it('does not use the boundary record outside the saved quote, for another surface, or when the record is stale',()=>{
    expect(readingSourceTarget(merged,{...saved,quote:'身体好。'})).toBe('id_1_0_t');
    expect(readingSourceTarget(merged,{locator:{tokenId:'id_0_2_t',surface:'素质'},quote:saved.quote})).toBeNull();
    const stale=build([...line0.slice(0,2),['id_0_e2_rev',tok('身体条件')],...line0.slice(4)],[record]);
    expect(readingSourceTarget(stale,{...saved,quote:'运动员的身体条件非常好。'})).toBeNull();
  });
  it('returns the original token again after splitting back',()=>{
    expect(readingSourceTarget(build(line0,[]),saved)).toBe('id_0_2_t');
  });
});
