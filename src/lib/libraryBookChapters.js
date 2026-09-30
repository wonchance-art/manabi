import {splitLinesIntoChapters} from './bookSplit';
import {libraryRpc} from './libraryOperations';

export function chapterCaption(chapter, bookTitle = '') {
  if (chapter.chapterTitle != null) return chapter.chapterTitle;
  let title = String(chapter.title || '');
  if (bookTitle && title.startsWith(`${bookTitle} — `)) title = title.slice(bookTitle.length + 3);
  const prefix = `${chapter.order}과`;
  if (title === prefix) return '';
  if (title.startsWith(`${prefix} · `)) return title.slice(prefix.length + 3);
  return title;
}
export function validChapterOrder(value) { return /^[1-9][0-9]{0,3}$/.test(String(value)); }
export function prepareChapterItems(draft) {
  const items = draft.parts || [{order:draft.order,title:draft.title,text:draft.text}];
  if (!items.length || items.length > 50) throw new Error('한 번에 1~50과를 추가할 수 있어요.');
  const orders = new Set();
  for (const item of items) {
    if (!validChapterOrder(item.order)) throw new Error('과 번호는 1~9999로 입력해 주세요.');
    if (orders.has(Number(item.order))) throw new Error(`${item.order}과가 중복됐어요.`);
    if (!item.text?.trim() || item.text.length > 200000 || (item.title || '').length > 200) throw new Error('제목과 내용을 확인해 주세요.');
    orders.add(Number(item.order));
  }
  return items.map(item=>({...item,order:Number(item.order),title:(item.title||'').trim()}));
}
export function splitChapterDraft(draft, lines) {
  if (!validChapterOrder(draft.order)) throw new Error('시작 과 번호를 확인해 주세요.');
  return splitLinesIntoChapters(draft.text,{linesPerChapter:Number(lines)}).map((part,i)=>({...part,order:Number(draft.order)+i,title:''}));
}
export async function fetchBookChapterPage(client, key, count=20, ensureId=null) {
  const items=[];let result;
  do {
    result=await libraryRpc(client,'library_book_chapters',{p_key:key,p_offset:items.length,p_limit:20});
    items.push(...result.items);
    if(!result.items.length)break;
  } while(items.length<result.total&&(items.length<count||(ensureId&&!items.some(item=>item.id===ensureId))));
  return {...result,items};
}
export function chapterError(error) {
  if(error?.message==='book_order_exists'){
    let details;try{details=JSON.parse(error.details);}catch{/* No private server error text in UI. */}
    return {message:details?.order?`${details.order}과가 있어요.`:'이미 있는 과 번호예요.',id:details?.id};
  }
  const messages={book_forbidden:'이 책을 수정할 수 없어요.',book_unavailable:'책을 다시 확인해 주세요.',book_order_changed:'다른 창에서 번호를 바꿨어요. 다시 열어 주세요.',book_invalid_order:'과 번호는 1~9999로 입력해 주세요.',book_request_changed:'저장 중인 내용을 먼저 확인해 주세요.',book_invalid_items:'추가할 내용을 확인해 주세요.'};
  return {message:messages[error?.message]||(error?.code==='PGRST202'?'과 추가를 준비 중이에요. 잠시 후 다시 시도해 주세요.':'저장 결과를 확인하지 못했어요. 다시 확인해 주세요.')};
}
