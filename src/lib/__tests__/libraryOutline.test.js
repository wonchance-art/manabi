import {describe,it,expect} from 'vitest';
import {libraryOutline,libraryOutlineHref} from '../libraryOutline';
import {libraryReaderHref,safeReaderReturn} from '../libraryReturn';
import {classStudyNeighborHref} from '../classStudy';

describe('library outline return state',()=>{
 it('keeps several outlines and loaded pages through a sibling reader and library return',()=>{
  const folder='00000000-0000-4000-8000-000000000002';
  let path=`/materials?collection=${folder}&q=학교&sort=title&shown=40`;
  path=libraryOutlineHref(path,'book:lesson-book',true,21);
  path=libraryOutlineHref(path,'pdf:original',true,20);
  const reader=new URL(libraryReaderHref('/viewer/22',path,513),'https://local');
  const next=new URL(classStudyNeighborHref({id:23},null,reader.searchParams.get('returnTo')),'https://local');
  const back=new URL(safeReaderReturn(next.searchParams.get('returnTo')),'https://local');
  expect(back.searchParams.get('collection')).toBe(folder);expect(back.searchParams.get('q')).toBe('학교');
  expect(back.searchParams.get('shown')).toBe('40');expect(back.searchParams.get('restoreY')).toBe('513');
  expect(libraryOutline(back.searchParams.get('outline'))).toEqual({'book:lesson-book':40,'pdf:original':20});
  const closed=new URL(libraryOutlineHref(back.pathname+back.search,'book:lesson-book',false),'https://local');
  expect(libraryOutline(closed.searchParams.get('outline'))).toEqual({'pdf:original':20});
  expect(closed.searchParams.has('restoreY')).toBe(false);
 });
 it('rejects malformed state and never expands another kind or requests an unbounded page count',()=>{
  for(const value of ['{broken','{}',JSON.stringify([['material:1',20]]),JSON.stringify([['book:x',999999]])])expect(libraryOutline(value)).toEqual({});
  const path=libraryOutlineHref('/materials','book:x',true,100000);
  expect(libraryOutline(new URL(path,'https://local').searchParams.get('outline'))).toEqual({'book:x':2000});
  expect(libraryOutlineHref('/discover','book:x',true)).toBe('/discover');
 });
 it('bounds the complete return URL without losing search and folder context',()=>{
  let path='/materials?q='+encodeURIComponent('語'.repeat(120));
  for(let i=0;i<30;i++)path=libraryOutlineHref(path,`book:${'x'.repeat(80)}${i}`,true,40);
  expect(path.length).toBeLessThanOrEqual(1950);
  expect(new URL(path,'https://local').searchParams.get('q')).toBe('語'.repeat(120));
  expect(safeReaderReturn(path)).toBe(path);
  const overlong='/materials?q='+ 'x'.repeat(2100);
  expect(libraryOutlineHref(overlong,'book:x',true)).toBe(overlong);
 });
});
