import {describe,it,expect,vi} from 'vitest';
import {chapterCaption,validChapterOrder,prepareChapterItems,splitChapterDraft,fetchBookChapterPage,chapterError} from '../libraryBookChapters';
describe('book chapter entry',()=>{
 it('uses actual lesson numbers and keeps custom titles',()=>{
  expect(chapterCaption({title:'Book — 8과',order:8},'Book')).toBe('');
  expect(chapterCaption({title:'Book — 8과 · Travel',order:8},'Book')).toBe('Travel');
  expect(chapterCaption({title:'Book — An old custom title',order:3},'Book')).toBe('An old custom title');
  expect(chapterCaption({title:'anything',chapterTitle:'약속',order:5},'Book')).toBe('약속');
 });
 it('accepts gaps and unordered entries, rejects ambiguous order input and duplicates',()=>{
  expect(prepareChapterItems({parts:[8,3,5].map(order=>({order:String(order),text:'hello'}))}).map(i=>i.order)).toEqual([8,3,5]);
  for(const value of [0,-1,'1.5','01','1e2',10000,''])expect(validChapterOrder(value)).toBe(false);
  expect(()=>prepareChapterItems({parts:[{order:3,text:'a'},{order:'3',text:'b'}]})).toThrow(/중복/);
  expect(()=>prepareChapterItems({order:1,text:' '})).toThrow();
 });
 it('reuses bilingual splitting without adding translated lines as chapters',()=>{
  const parts=splitChapterDraft({order:'3',text:'私は学生です。\n나는 학생입니다.\nこれは本です。\n이것은 책입니다.'},1);
  expect(parts.map(p=>p.order)).toEqual([3,4]);expect(parts[0].translations['私は学生です。']).toBe('나는 학생입니다.');
 });
 it('loads the server-sorted prefix through a newly added row beyond the first page',async()=>{
  const rpc=vi.fn(async(_,p)=>({data:{total:42,title:'Book',nextOrder:100,items:Array.from({length:Math.min(20,42-p.p_offset)},(_,i)=>({id:String(p.p_offset+i+1),order:p.p_offset+i+1}))}}));
  const result=await fetchBookChapterPage({rpc},'book',20,'41');expect(result.items).toHaveLength(42);expect(rpc).toHaveBeenCalledTimes(3);
 });
 it('shows only a safe owner-scoped conflict destination',()=>{
  expect(chapterError({message:'book_order_exists',details:'{"id":"42","order":5}'})).toEqual({message:'5과가 있어요.',id:'42'});
  expect(chapterError({message:'internal secret'}).message).not.toContain('secret');
 });
});
