import {expressionOf, validateBoard, BOARD_PAGE_LIMIT} from './teachingBoard';
import {expressionElements, readCard} from './teachingBoardCard';
import {cloneBoardElements} from './teachingBoardReuse';
import {stableJson} from './classCopyModel';

const live = elements => elements.filter(el => !el.isDeleted);
const contains = (outer, inner) => inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];

// An expression is semantic, not a handful of independent visible text fields.
// Bounds are supplied by the existing editor (including rotation and bindings).
export function fragmentUnits(elements, boundsOf) {
  const visible = live(elements), assigned = new Set(), units = [];
  for (const anchor of visible.filter(expressionOf)) {
    const members = expressionElements(anchor, visible);
    members.forEach(el => assigned.add(el.id));
    const value=readCard(anchor,visible);
    units.push({id:anchor.id, ids:members.map(el=>el.id), kind:'expression', label:value?.text || '표현', detail:value?.meaning || '', bounds:boundsOf(members)});
  }
  for (const el of visible) {
    if (assigned.has(el.id)) continue;
    const members = [el, ...visible.filter(child => child.type === 'text' && child.containerId === el.id && !assigned.has(child.id))];
    if (el.type === 'text' && el.containerId && visible.some(parent=>parent.id===el.containerId)) continue;
    members.forEach(child=>assigned.add(child.id));
    units.push({id:el.id, ids:members.map(child=>child.id), kind:el.type,
      label:el.type==='text'?el.text.slice(0,70):el.type==='freedraw'?'필기':el.type==='arrow'?'화살표':el.type==='frame'?'프레임':'도형', bounds:boundsOf(members)});
  }
  return units;
}

export function fragmentSelection(elements, units, unitIds) {
  const visible = live(elements), selected = new Set(units.filter(unit=>unitIds.includes(unit.id)).flatMap(unit=>unit.ids));
  let changed = true;
  while (changed) {
    changed = false;
    for (const el of visible) {
      if (el.frameId && selected.has(el.frameId) && !selected.has(el.id)) {selected.add(el.id); changed = true;}
    }
    for (const unit of units) {
      if (!unit.ids.some(id=>selected.has(id))) continue;
      for (const id of unit.ids) if (!selected.has(id)) {selected.add(id); changed = true;}
    }
  }
  return visible.filter(el=>selected.has(el.id));
}

export const fragmentInArea = (units, area) => units.filter(unit=>contains(area,unit.bounds)).map(unit=>unit.id);

export function fragmentAtPoint(units, point, tolerance=0) {
  // Prefer the smallest hit so an enclosing frame cannot swallow its content.
  return units.filter(u=>point.x>=u.bounds[0]-tolerance&&point.y>=u.bounds[1]-tolerance&&point.x<=u.bounds[2]+tolerance&&point.y<=u.bounds[3]+tolerance)
    .sort((a,b)=>(a.bounds[2]-a.bounds[0])*(a.bounds[3]-a.bounds[1])-(b.bounds[2]-b.bounds[0])*(b.bounds[3]-b.bounds[1]))[0]?.id;
}

async function digest(value) {
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stableJson(value)));
  return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
}

export async function fragmentOrigin(row, page, elements) {
  if(!row?.id || !page?.id || !elements.length)throw new Error('가져올 내용을 선택해 주세요.');
  const entries=await Promise.all(elements.map(async el=>{
    const value=structuredClone(el);delete value.customData?.manabiReuse;
    for(const key of ['updated','version','versionNonce'])delete value[key];
    return {sourceId:el.id,stamp:await digest(value)};
  }));
  const batch=await digest({boardId:row.id,pageId:page.id,entries:[...entries].sort((a,b)=>a.sourceId.localeCompare(b.sourceId))});
  return {boardId:row.id,pageId:page.id,day:row.day,batch,entries};
}

export function findFragment(document, origin) {
  const desired=new Map(origin.entries.map(entry=>[entry.sourceId,entry.stamp])), matches=[];
  for(const page of document.pages)for(const el of live(page.elements)){
    const from=el.customData?.manabiReuse;
    if(from?.boardId===origin.boardId&&from.pageId===origin.pageId&&desired.get(from.sourceId)===from.stamp)matches.push({pageId:page.id,id:el.id,sourceId:from.sourceId});
  }
  const count=new Set(matches.map(el=>el.sourceId)).size;
  return {kind:count===desired.size?'all':count?'partial':'none',matches};
}

// Preserve complete user groups only. Expression groups were completed upstream.
export function cloneFragment(sourceElements, chosen, origin, nextId) {
  const ids=new Set(chosen.map(el=>el.id)), entries=new Map(origin.entries.map(entry=>[entry.sourceId,entry]));
  const incomplete=new Set(live(sourceElements).filter(el=>!ids.has(el.id)).flatMap(el=>el.groupIds||[]));
  return cloneBoardElements(chosen.map(el=>({...el,groupIds:(el.groupIds||[]).filter(id=>!incomplete.has(id)),customData:{...el.customData,
    manabiReuse:{boardId:origin.boardId,pageId:origin.pageId,day:origin.day,batch:origin.batch,...entries.get(el.id)}}})), nextId);
}

// Search in visible space, then below existing content. Never displace old ink.
export function fragmentPosition(bounds, existingBounds, viewport) {
  const width=bounds[2]-bounds[0],height=bounds[3]-bounds[1],gap=28;
  const fits=(x,y)=>!existingBounds.some(b=>x<b[2]+gap&&x+width+gap>b[0]&&y<b[3]+gap&&y+height+gap>b[1]);
  const candidates=[viewport[0],...existingBounds.map(b=>b[2]+gap)].filter(x=>x>=viewport[0]&&x+width<=viewport[2]).sort((a,b)=>a-b);
  const rows=[viewport[1],...existingBounds.map(b=>b[3]+gap)].filter(y=>y>=viewport[1]&&y+height<=viewport[3]).sort((a,b)=>a-b);
  for(const y of rows.slice(0,100))for(const x of candidates.slice(0,100))if(fits(x,y))return {x:x-bounds[0],y:y-bounds[1]};
  return {x:viewport[0]-bounds[0],y:Math.max(viewport[1],...existingBounds.map(b=>b[3]+gap))-bounds[1]};
}

export function insertBoardFragment(document, pageId, elements, offset, {fresh=false,nextId=()=>crypto.randomUUID()}={}) {
  const current=validateBoard(document);
  if(!current.pages.some(page=>page.id===pageId))throw new Error('놓을 페이지를 다시 확인해 주세요.');
  if(fresh&&current.pages.length>=BOARD_PAGE_LIMIT)throw new Error('페이지가 20개예요. 현재 판에 놓기를 이용해 주세요.');
  const placed=elements.map(el=>({...el,x:el.x+offset.x,y:el.y+offset.y}));
  const id=fresh?nextId():pageId;
  const pages=fresh?[...current.pages,{id,elements:placed,camera:{scrollX:0,scrollY:0,zoom:{value:1}}}]:current.pages.map(page=>page.id===id?{...page,elements:[...page.elements,...placed]}:page);
  const result=validateBoard({...current,pages,activePage:id});
  return {document:result,pageId:id,elements:placed};
}
