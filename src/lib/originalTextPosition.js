// Positions use code points, so font size and viewport width do not change the anchor.
import {pagerFor} from './usePagedReader';
const cache=new WeakMap();
function textIndex(element){
 const text=element.textContent||'';let index=cache.get(element);
 if(index?.text===text&&index.nodes.every(item=>element.contains(item.node)))return index;
 const nodes=[];let count=0;const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode())){const offsets=[0];for(const char of node.textContent)offsets.push(offsets.at(-1)+char.length);nodes.push({node,offsets,start:count});count+=offsets.length-1;}
 index={text,nodes,count};cache.set(element,index);return index;
}
function characterRange(index,offset){
 if(!index.count)return null;
 const at=Math.min(Math.max(0,offset),index.count-1);
 const item=index.nodes.find(item=>at>=item.start&&at<item.start+item.offsets.length-1);if(!item)return null;
 const range=document.createRange();range.setStart(item.node,item.offsets[at-item.start]);range.setEnd(item.node,item.offsets[at-item.start+1]);return range;
}
export function visibleOriginalTextOffset(element){
 // 쪽 넘김 보기(READER-PAGED-001)에서는 세로 위치로 고를 수 없다(단마다 같은 높이) — 쪽 넘김 쪽이 기록한다.
 if(!element?.isConnected||pagerFor(element))return null;
 const bounds=element.getBoundingClientRect(),top=Math.max(104,bounds.top+1);
 if(bounds.bottom<=104||bounds.top>=innerHeight-24)return null;
 const index=textIndex(element);if(!index.count)return null;
 let low=0,high=index.count-1;
 while(low<high){const mid=Math.floor((low+high)/2),range=characterRange(index,mid),rect=range?.getBoundingClientRect();if(rect&&rect.bottom>top)high=mid;else low=mid+1;}
 return low;
}
export function restoreOriginalTextOffset(element,offset){
 if(!element?.isConnected||!Number.isSafeInteger(offset)||offset<0)return false;
 const index=textIndex(element);if(offset>index.count)return false;
 const range=characterRange(index,offset);if(!range)return false;
 const pager=pagerFor(element);
 if(pager){
  // 쪽 넘김: 그 글자가 있는 쪽을 열고, 쪽 상자가 화면 밖이면 상자를 화면으로 데려온다.
  pager.reveal(range);
  const pages=element.closest('[data-reader-pages]'),box=pages?.getBoundingClientRect();
  if(box&&(box.top<0||box.bottom>innerHeight))window.scrollBy({top:box.top-16,behavior:'instant'});
  return true;
 }
 const rect=range.getBoundingClientRect();window.scrollBy({top:rect.top-104,behavior:'instant'});return true;
}
/** 쪽 넘김 보기의 기준 글자 — 그 쪽의 첫 글자 위치(코드 포인트). pageOf(range)는 쪽 번호를 돌려준다. */
export function pagedOriginalTextOffset(element,pageOf,page){
 if(!element?.isConnected)return null;
 const index=textIndex(element);if(!index.count)return null;
 let low=0,high=index.count;
 while(low<high){const mid=(low+high)>>1,range=characterRange(index,mid),at=range?pageOf(range):Infinity;if((at??Infinity)<page)low=mid+1;else high=mid;}
 return Math.min(low,index.count-1);
}
export function originalTextRange(element,offset){
 if(!element?.isConnected||!Number.isSafeInteger(offset)||offset<0)return null;
 return characterRange(textIndex(element),offset);
}
