// Positions use code points, so font size and viewport width do not change the anchor.
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
 if(!element?.isConnected)return null;
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
 const rect=range.getBoundingClientRect();window.scrollBy({top:rect.top-104,behavior:'instant'});return true;
}
