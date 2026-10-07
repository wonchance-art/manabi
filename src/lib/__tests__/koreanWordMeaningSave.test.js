import {describe,expect,it,vi} from 'vitest';
vi.mock('@/content/refGrammarLoaders',()=>({loadChapter:vi.fn(),getGrammarManifest:vi.fn()}));
vi.mock('@/lib/publishedChapter',()=>({loadPublishedRegistry:vi.fn()}));
import {resolveSave} from '../server/learningContext';
import {koreanReadingSource,readingSourceTarget} from '../learningSources';
import {koreanWordMeaningInput,koreanMeaningEnvelope} from '../koreanWordMeaning';

const raw='벽에 붙였어요.\r\n벽에 붙였어요.';
const token={id:'second',text:'벽에',base_form:'벽',pos:'명사',meaning:'在墙上',sourceSpan:{start:10,end:12,unit:'utf16'}};
const material={id:211,owner_id:'alice',visibility:'private',direction:'read',raw_text:raw,
  processed_json:{metadata:{language:'Korean'},sequence:['second'],dictionary:{second:token}}};
const client=row=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:row,error:null})};return {from:()=>q,rpc:vi.fn()};};
async function payload() {
  const source=await koreanReadingSource({materialId:211,rawText:raw,token});
  const input=koreanWordMeaningInput({accountId:'alice',materialId:211,token,source,locale:'zh-CN'});
  return {source,word:{word_text:'벽',base_form:'벽',language:'Korean',meaning:'墙壁',
    meaningCandidate:koreanMeaningEnvelope(input,{lemma:'벽',lemmaStatus:'matched',lexicalMeaning:'墙壁'})}};
}
describe('lexical meaning through the real reading save resolver',()=>{
  it('passes only the lexical meaning to storage and retains the exact second occurrence',async()=>{
    const body=await payload(), before=structuredClone(material);
    const result=await resolveSave(client(material),'alice',body);
    expect(result.word).toMatchObject({word_text:'벽',meaning:'墙壁',language:'Korean'});
    expect(result.word).not.toHaveProperty('meaningCandidate');
    expect(result.source.locator.sourceSpan).toEqual(token.sourceSpan);
    expect(readingSourceTarget(material.processed_json,result.source,{rawText:raw,sourceRevision:body.source.sourceRevision})).toBe('second');
    expect(material).toEqual(before);
  });
  it.each([{lemma:'학교'},{locale:'en'},{locale:'ko'},{version:'old'},{lexicalMeaning:'在墙上'},{sourceRevision:'old'},{sourceSpan:{start:0,end:2,unit:'utf16'}}])('rejects mismatched envelope %j before an RPC',async patch=>{
    const body=await payload(), db=client(material);
    body.word.meaningCandidate={...body.word.meaningCandidate,...patch};
    await expect(resolveSave(db,'alice',body)).rejects.toMatchObject({status:400}); expect(db.rpc).not.toHaveBeenCalled();
  });
  it('retains the manual/older-client contract and does not mislabel it as lexical validation',async()=>{
    const body=await payload(); delete body.word.meaningCandidate; body.word.meaning='사용자 뜻';
    expect((await resolveSave(client(material),'alice',body)).word.meaning).toBe('사용자 뜻');
  });
  it('rejects a private source belonging to another account and a now-changed source',async()=>{
    const body=await payload();
    await expect(resolveSave(client(material),'bob',body)).rejects.toMatchObject({status:404});
    await expect(resolveSave(client({...material,raw_text:raw+' 변경'}),'alice',body)).rejects.toMatchObject({status:400});
  });
});
