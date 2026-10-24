import React,{createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it,vi} from 'vitest';
vi.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams(),usePathname:()=>'/books/japanese-n3'}));
vi.mock('@/lib/AuthContext',()=>({useAuth:()=>({profile:{role:'admin'},user:null,loading:false})}));
vi.mock('@tanstack/react-query',()=>({useInfiniteQuery:()=>({data:{pages:[]},isPending:false,error:null})}));
vi.mock('@/components/books/useReadingProgress',()=>({default:()=>({progress:{page:'u48-practice',completed:['u47']},hasProgress:true,ready:true})}));
vi.mock('@/components/library/LibrarySaveButton',()=>({default:({edition,bookTitle})=><span data-save-edition={edition}>{bookTitle}</span>}));
import BookHome from '@/components/books/BookHome';
import BookReview from '@/components/books/BookReview';
import BookEditionFonts from '@/components/books/BookEditionFonts';
import Bookshelf from '@/components/books/Bookshelf';
import BookReaderSkeleton from '@/components/books/BookReaderSkeleton';
import {parseReviewScope} from '@/lib/reviewScopeUrl';
const edition='c'.repeat(24);
const n3={bookId:'japanese-n3',level:'N3',edition,title:'근거를 읽고, 내 생각을 전하는 일본어',cultures:[],lessons:Array.from({length:48},(_,i)=>({id:`u${String(i+1).padStart(2,'0')}`,number:i+1,part:'상황과 생각',title:`생각을 연결하는 ${i+1}과`}))};
const n4={...n3,bookId:'japanese-n4',level:'N4',edition:'d'.repeat(24),lessons:n3.lessons.slice(0,42)};
const render=(component,props)=>renderToStaticMarkup(createElement(component,props));
describe('N3 course presentation uses its own title, level and immutable edition',()=>{
 it('lists N3 only when verified while preserving separate N4 and N5 entries',()=>{
  const html=render(Bookshelf,{books:[n4,n3],initialLang:'Japanese'});
  expect(html).toContain(`href="/books/japanese-n3?edition=${edition}#cover"`);
  expect(html).toContain('aria-label="일본어 N3 책 둘러보기"');
  expect(html).toContain('N3 · 48과');expect(html).toContain('href="/admin/books/japanese-n3"');
  const withoutN3=render(Bookshelf,{books:[n4],initialLang:'Japanese'});
  expect(withoutN3).not.toContain('aria-label="일본어 N3 책 둘러보기"');
 });
 it('keeps the N3 cover, final-unit resume and tools in the N3 course',()=>{
  const html=render(BookHome,{book:n3,progress:{page:'u48-practice',completed:[]},hasProgress:true});
  for(const text of [n3.title,'48과 이어 읽기','N4에서 이어가기','음성과 PDF는 아직 제공하지 않아요.'])expect(html).toContain(text);
  for(const page of ['u48-practice','guide-start','reference-start'])expect(html).toContain(`/books/japanese-n3?edition=${edition}#${page}`);
  expect(html).not.toContain('/books/japanese-n5');
  expect(render(BookHome,{book:n3,preview:true,progress:{completed:[]}})).not.toContain('data-save-edition');
 });
 it.each(['japanese-n5','japanese-n4'])('does not let an N3 expression list adopt %s as its source return',other=>{
  const foreign=`/books/${other}?edition=${'e'.repeat(24)}#u07-patterns`;
  const html=render(BookReview,{book:n3,returnTo:foreign});
  const hrefs=[...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1].replaceAll('&amp;','&'));
  const scope=parseReviewScope(new URL(hrefs.find(href=>href.startsWith('/vocab?')),'https://local.invalid').searchParams);
  expect(scope.scope.source).toEqual({kind:'book',bookId:'japanese-n3',from:1,to:48});
  expect(scope.returnTo).toBe(`/books/japanese-n3?edition=${edition}#u48-practice`);
  expect(hrefs).not.toContain(foreign);
 });
 it('loads the five N3 font faces from only the exact N3 edition and keeps N4 separate',()=>{
  const html=render(BookEditionFonts,{book:n3});
  for(const face of ['KR','KRB','KRS','JP','JPS'])expect(html).toContain(`/api/books/japanese-n3/${edition}/asset?file=fonts/${face}.woff`);
  expect(html).toContain('font-family:ManabiN3JP');expect(html).toContain('data-book-id="japanese-n3"');
  expect(html).not.toContain('ManabiN4');
  const earlier=render(BookEditionFonts,{book:n4});expect(earlier).toContain('ManabiN4');expect(earlier).not.toContain('ManabiN3');
  expect(render(BookEditionFonts,{book:{...n3,edition:'"><script>invalid</script>'}})).toBe('');
 });
 it('labels the route skeleton N3 before course data has arrived',()=>{
  const html=render(BookReaderSkeleton,{});expect(html).toContain('N3');expect(html).not.toContain('N5');
 });
});
