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
