import {BOARD_PAGE_LIMIT, validateBoard} from './teachingBoard';

// Page provenance is descriptive, never authorization or a student record.
export function boardReuseSource(value) {
  if (!value || !['boardId','revision','pageId','day'].every(key => typeof value[key] === 'string' && value[key].length <= 200 && value[key])) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.day)) return null;
  return {boardId:value.boardId, revision:value.revision, pageId:value.pageId, day:value.day};
}
export const boardReuseKey = value => {const source=boardReuseSource(value);return source ? JSON.stringify(source) : '';};
export const pageReuseSource = (row, pageId) => boardReuseSource({boardId:row.id,revision:row.revision,day:row.day,pageId});

// All links within the copied scene move together. Removed elements and dangling
// references stay removed; the textbook source inside customData stays intact.
export function cloneBoardElements(elements, nextId=()=>crypto.randomUUID()) {
  const visible=elements.filter(el=>!el.isDeleted),ids=new Map(),groups=new Map();
  for(const el of visible)ids.set(el.id,nextId());
  for(const el of visible)for(const id of el.groupIds||[])if(!groups.has(id))groups.set(id,ids.get(id)||nextId());
  const binding=value=>value&&ids.has(value.elementId)?{...value,elementId:ids.get(value.elementId)}:null;
  return visible.map(original=>{
    const el=structuredClone(original);
    return {...el,id:ids.get(el.id),groupIds:(el.groupIds||[]).map(id=>groups.get(id)),
      ...(el.containerId!==undefined?{containerId:ids.get(el.containerId)||null}:{}),
      ...(el.frameId!==undefined?{frameId:ids.get(el.frameId)||null}:{}),
      ...(el.boundElements!==undefined?{boundElements:el.boundElements?.filter(item=>ids.has(item.id)).map(item=>({...item,id:ids.get(item.id)}))||null}:{}),
      ...(el.startBinding!==undefined?{startBinding:binding(el.startBinding)}:{}),
      ...(el.endBinding!==undefined?{endBinding:binding(el.endBinding)}:{}),
    };
  });
}

export function copyBoardPages(target, source, row, selectedIds, nextId=()=>crypto.randomUUID()) {
  const current=validateBoard(target),past=validateBoard(source),selected=new Set(selectedIds);
  if(!selected.size || [...selected].some(id=>!past.pages.some(p=>p.id===id)))throw new Error('가져올 페이지를 선택해 주세요.');
  const known=new Set(current.pages.map(p=>boardReuseKey(p.reusedFrom)).filter(Boolean));
  const pages=past.pages.filter(p=>selected.has(p.id)).filter(p=>!known.has(boardReuseKey(pageReuseSource(row,p.id))));
  if(!pages.length)throw new Error('이미 현재 수업에 가져온 페이지예요.');
  if(current.pages.length+pages.length>BOARD_PAGE_LIMIT)throw new Error(`현재 수업에 ${BOARD_PAGE_LIMIT-current.pages.length}개 페이지를 더 담을 수 있어요. 선택을 줄여 주세요.`);
  const copied=pages.map(p=>{
    const reusedFrom=pageReuseSource(row,p.id);if(!reusedFrom)throw new Error('지난 판의 저장 정보를 다시 확인해 주세요.');
    return {id:nextId(),elements:cloneBoardElements(p.elements,nextId),camera:{scrollX:0,scrollY:0,zoom:{value:1}},reusedFrom};
  });
  const document=validateBoard({...current,pages:[...current.pages,...copied],activePage:copied[0].id});
  return {document,ids:copied.map(p=>p.id)};
}
