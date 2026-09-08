import {describe,it,expect} from 'vitest';
import {libraryFilters,libraryNarrowed,libraryPageArgs,libraryComposerHref,libraryItemHref,fetchLibraryPage,addToCollection,createCollection,removeFromCollection} from '../personalLibrary';
import {libraryReaderHref,safeLibraryReturn} from '../libraryReturn';
const owner='00000000-0000-4000-8000-000000000001',collection='00000000-0000-4000-8000-000000000002';
describe('personal library navigation',()=>{
 it('unifies owned entries, keeps notes and legacy unread/pinned semantics',()=>{
  const all=libraryFilters(new URLSearchParams('view=owned'));expect(libraryNarrowed(all)).toBe(false);
  const f=libraryFilters(new URLSearchParams('view=notes&unread=1&pinned=1&level=N5&lang=French&shown=40'));
  expect(f).toMatchObject({kind:'note',state:'unread',pinned:true,level:'N5',language:'French',shown:40});
  expect(libraryPageArgs(f,20,{pinned:[1,4]})).toMatchObject({p_offset:20,p_limit:20,p_pinned:['1','4']});
 });
 it('rejects malformed collection and limits inputs before RPC',()=>{
  const f=libraryFilters(new URLSearchParams({collection:'../../secret',lang:'Klingon',q:'x'.repeat(200),shown:'Infinity',kind:'secret'}));
  expect(f.collection).toBeNull();expect(f.query).toHaveLength(120);expect(f.shown).toBe(20);expect(f.language).toBe('');expect(f.kind).toBe('');
 });
 it('makes a scoped composer and restores filters for every original reader',()=>{
  const back=`/materials?collection=${collection}&q=雨&shown=40&kind=epub`;
  expect(new URL(libraryComposerHref(back,collection),'https://local').searchParams.get('collection')).toBe(collection);
  for(const href of ['/viewer/22','/pdf/abc?pdfjs=1','/books/japanese-n5?edition=aaaaaaaaaaaaaaaaaaaaaaaa#u03-start']){
   const next=new URL(libraryReaderHref(href,back,220),'https://local');expect(next.searchParams.get('returnTo')).toContain('restoreY=220');expect(next.searchParams.get('returnTo')).toContain('shown=40');
  }
  expect(safeLibraryReturn('https://bad.test/materials')).toBe('/materials');
 });
 it('keeps grouped material ids and chooses originals without copying any body',()=>{
  expect(libraryItemHref({target_kind:'book',target_id:'book-key',material_id:'37'})).toBe('/viewer/37');
  expect(libraryItemHref({target_kind:'pdf',target_id:'pdf-id'})).toBe('/pdf/pdf-id?pdfjs=1');
 });
 it('does not disguise a failed catalog as an empty library',async()=>{
  await expect(fetchLibraryPage({rpc:async()=>({error:{code:'42P01'}})},{})).rejects.toEqual({code:'42P01'});
  await expect(fetchLibraryPage({rpc:async()=>({data:[]})},{})).rejects.toThrow('INVALID_LIBRARY_PAGE');
 });
 it('membership retry only writes the reference, not the saved document',async()=>{
  const calls=[];let failures=1;
  const client={from(table){calls.push(table);return{upsert:async row=>failures--?{error:new Error('network')}:{data:row}};}};
  const target={target_kind:'material',target_id:'219'};
  await expect(addToCollection(client,owner,collection,target)).rejects.toThrow('network');
  await addToCollection(client,owner,collection,target);expect(calls).toEqual(['library_collection_items','library_collection_items']);
 });
 it('a lost collection creation reply reuses the same id',async()=>{
  const row={id:collection,name:'Travel'},ops=[];
  const client={from(){const query={insert:value=>{ops.push(value);return query;},select:()=>query,eq:()=>query,single:async()=>ops.length===1?{error:{code:'23505'}}:{data:row}};let read=false;const select=query.select;query.select=()=>{read=true;return query;};query.eq=()=>{ops.push('read');return query;};return query;}};
  expect(await createCollection(client,owner,'Travel',collection)).toEqual(row);expect(ops[0].id).toBe(collection);
 });
 it('removing a membership never removes a source',async()=>{
  const tables=[],filters=[];const q={delete:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},then:resolve=>resolve({})};
  await removeFromCollection({from:t=>{tables.push(t);return q;}},owner,collection,{target_kind:'material',target_id:'42'});
  expect(tables).toEqual(['library_collection_items']);expect(filters).toContainEqual(['owner_id',owner]);
 });
});
