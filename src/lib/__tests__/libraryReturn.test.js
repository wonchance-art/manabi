import { describe, it, expect } from 'vitest';
import { safeLibraryReturn, safeReaderReturn, libraryReaderHref, librarySearchHref } from '../libraryReturn';
describe('library navigation without mixing learning progress',()=>{
  it('returns classroom notes to the same class and date without broadening composer redirects',()=>{
    expect(safeReaderReturn('/class/class-1/live?day=2026-09-10&next=https://evil.test')).toBe('/class/class-1/live?day=2026-09-10');
    expect(safeReaderReturn('/class/class-1/live?day=2026-02-30')).toBe('/class/class-1/live');
    expect(safeLibraryReturn('/class/class-1/live')).toBe('/materials');
    expect(safeReaderReturn('/materials?view=owned&restoreY=90')).toBe('/materials?view=owned&restoreY=90');
  });
  it('keeps the class history destination after reading a saved lesson note',()=>{
    expect(safeReaderReturn('/class/class-1?view=history')).toBe('/class/class-1?view=history');
    expect(safeReaderReturn('/class/class-1?day=2026-09-10&view=history&next=https://evil.test')).toBe('/class/class-1?day=2026-09-10&view=history');
    expect(safeReaderReturn('/class/class-1?view=admin&next=https://evil.test')).toBe('/class/class-1');
    expect(safeLibraryReturn('/class/class-1?view=history')).toBe('/materials');
  });
  it.each(['//evil.test/class/a/live','https://evil.test/class/a/live','/class/a/../admin','/class/a/live#bad','/class/a/live/../../admin','/class/a/board','/class/a%2fb/live','javascript:alert(1)'])('rejects unsafe reader return: %s',value=>{
    expect(safeReaderReturn(value)).toBe('/materials');
  });
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
