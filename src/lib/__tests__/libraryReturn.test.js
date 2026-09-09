import { describe, it, expect } from 'vitest';
import { safeLibraryReturn, libraryReaderHref, librarySearchHref } from '../libraryReturn';
describe('library navigation without mixing learning progress',()=>{
  it('search always leads to a view that renders the search input',()=>{
    expect(librarySearchHref({id:'member'})).toBe('/materials?view=owned#library-search');
    expect(librarySearchHref(null)).toBe('/materials?tab=public#library-search');
  });
  it.each(['https://evil.test','//evil.test','/materials/add','/materials/../admin','/materials?x=1#bad','javascript:alert(1)',null])('rejects unrelated redirects: %s',v=>{
    expect(safeLibraryReturn(v)).toBe('/materials');
  });
  it('preserves permitted filters, expanded rows and list position, strips arbitrary parameters',()=>{
    expect(safeLibraryReturn('/materials?view=owned&q=caf%C3%A9&shown=48&restoreY=840&next=evil')).toBe('/materials?view=owned&q=caf%C3%A9&shown=48&restoreY=840');
  });
  it('keeps precise PDF pages and token source parameters while adding a return destination',()=>{
    const href=libraryReaderHref('/pdf/file-id?page=7','/materials?view=owned&q=hello',320);
    const parsed=new URL(href,'https://manabi.invalid');
    expect(parsed.searchParams.get('page')).toBe('7');expect(parsed.searchParams.get('returnTo')).toBe('/materials?view=owned&q=hello&restoreY=320');
    expect(libraryReaderHref('/viewer/123?sourceToken=x#word','/materials')).toContain('sourceToken=x');
    expect(libraryReaderHref('/viewer/123?sourceToken=x#word','/materials')).toMatch(/#word$/);
    expect(libraryReaderHref('/books/japanese-n5#u03','/materials')).toBe('/books/japanese-n5#u03');
  });
});
