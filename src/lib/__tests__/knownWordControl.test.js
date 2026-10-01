import { describe, it, expect } from 'vitest';
import { knownWordKeys, knownWordSetOf, scopedKnownWords, updateKnownWords } from '../knownWordControl';
import { loadKnownWords } from '../knownWords';
describe('아는 단어 정본·표기·범위', () => {
  const rows = [{lang:'en',word_text:'books'}, {lang:'fr',word_text:'books'}, {lang:'fr',word_text:'e\u0301'}];
  it('원래 삭제 키를 반환하고 기본형·언어를 구분한다', () => {
    expect(knownWordKeys(rows,'en',{text:'books',base_form:'book'})).toEqual(['books']);
    expect(knownWordKeys(rows,'en',{text:'book'}, {known_word_keys:['books']})).toEqual(['books']);
    expect(knownWordKeys(rows,'fr',{text:'é'})).toEqual(['e\u0301']);
    expect(knownWordKeys(rows,'ja',{text:'books'})).toEqual([]);
    expect(knownWordSetOf(rows).has('é')).toBe(true);
  });
  it('같은 기본형에 과거 제외와 known 미러가 겹쳐도 원래 표시를 찾는다', () => {
    const exclusions = [{id:'old',language:'English',word_text:'book',vocabulary_id:'a'},
      {id:'mirror',language:'English',word_text:'book',known_word_keys:['books']}];
    expect(knownWordKeys(rows,'en',{id:'a',text:'book',base_form:'book'},exclusions)).toEqual(['books']);
    expect(knownWordSetOf(rows,exclusions,'en').has('book')).toBe(true);
    expect(knownWordSetOf(rows.slice(1),exclusions,'en').has('book')).toBe(false);
  });
  it('멱등 표시·해제는 다른 언어와 원본을 보존한다', () => {
    const body = {lang:'en',wordText:'books',known:true};
    expect(updateKnownWords(rows,body)).toEqual(rows);
    expect(updateKnownWords(rows,{...body,known:false,removeKeys:['books']})).toEqual(rows.slice(1));
    expect(rows).toHaveLength(3);
  });
  it('책 범위와 미저장 목록은 원래 known 출처 키로 구분한다', () => {
    const vocab = [{id:'a',language:'English',word_text:'book',base_form:'book'}];
    const exclusions = [{id:'e',language:'English',word_text:'book',known_word_keys:['books']}];
    expect(scopedKnownWords(rows,exclusions,vocab,['a'])).toEqual([rows[0]]);
    expect(scopedKnownWords(rows,exclusions,vocab,[])).toEqual([]);
    expect(scopedKnownWords(rows,exclusions,vocab,null)).toEqual(rows);
  });
  it('천 개 뒤의 표시와 페이지 실패를 숨기지 않는다', async () => {
    const all = Array.from({length:1001},(_,i)=>({word_text:String(i),lang:'en'}));
    const client = failure => ({from:()=>{
      const q={select:()=>q,eq:()=>q,order:()=>q,range:async(start,end)=>start===failure?{error:new Error('unavailable')}:{data:all.slice(start,end+1)}};return q;
    }});
    expect(await loadKnownWords(client(-1),'owner','en')).toHaveLength(1001);
    await expect(loadKnownWords(client(400),'owner')).rejects.toThrow('unavailable');
  });
});
