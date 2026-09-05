import { describe, expect, it } from 'vitest';
import { materialIdValid, normalizeLearningWord, sourceHref, tokenContext } from '../learningSources';
describe('학습 출처 주소와 발췌',()=>{
 it('자료 ID 종류와 PostgreSQL bigint 범위를 검사한다',()=>{expect(materialIdValid('reading','9223372036854775807')).toBe(true);for(const id of ['0','-1','9223372036854775808','abc','1/../2'])expect(materialIdValid('reading',id)).toBe(false);expect(materialIdValid('pdf','1')).toBe(false);expect(materialIdValid('other','1')).toBe(false);});
 it('단어 표기를 NFC로 맞추고 원래 대소문자는 보존한다',()=>{expect(normalizeLearningWord(' Cafe\u0301 ')).toBe('Café');});
 it('교재 링크는 안전한 식별자와 내용 버전으로만 만든다',()=>{expect(sourceHref({kind:'textbook',lang:'Japanese',chapter_slug:'n5-first',locator:{revision:'r1',blockId:'tb-abc'},url:'javascript:alert(1)'})).toBe('/japanese/grammar/n5-first?sourceRevision=r1#tb-abc');expect(sourceHref({kind:'textbook',lang:'English',chapter_slug:'//evil.test'})).toBe(null);});
 it('읽기 자료 출처의 특수문자를 쿼리 값으로 인코딩한다',()=>{expect(sourceHref({kind:'reading',material_id:1,locator:{tokenId:'a&x=2',surface:'책'}})).toBe('/viewer/1?sourceToken=a%26x%3D2&sourceText=%EC%B1%85');});
 it('PDF는 검증된 쪽수만 링크에 담는다',()=>{const s={kind:'pdf',pdf_id:'20000000-0000-0000-0000-000000000001',locator:{page:12}};expect(sourceHref(s)).toContain('?page=12');expect(sourceHref({...s,locator:{page:-1}})).not.toContain('?');});
 it('발췌는 개행을 넘지 않고 언어에 맞춰 공백을 넣는다',()=>{const json={metadata:{language:'English'},sequence:['0','n','a','b','c','n2','9'],dictionary:{0:{text:'outside'},n:{pos:'개행'},a:{text:'Read'},b:{text:'a'},c:{text:'book'},n2:{pos:'개행'},9:{text:'outside'}}};expect(tokenContext(json,'c').quote).toBe('Read a book');expect(tokenContext({...json,metadata:{language:'Japanese'}},'c').quote).toBe('Readabook');expect(tokenContext(json,'missing')).toBe(null);});
});
