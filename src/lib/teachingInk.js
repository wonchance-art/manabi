import {boardInsertion} from './teachingBoard';

export const inkResultKey=(capture,index)=>`${capture.pageId}:${capture.fingerprint}:${index}`;

export function inkRows(expressions) {
  return expressions.map((value,index)=>({...value,index,text:value.original,meaning:'',selected:false,placed:false}));
}

// Candidate selection is separate from confirmation; no first AI guess wins.
export function editInkRow(row,patch) {
  const next={...row,...patch};
  if(!next.text.trim()||!next.meaning.trim())next.selected=false;
  return next;
}

export function inkValues(rows,language) {
  return rows.filter(row=>row.selected&&!row.placed&&row.text.trim()&&row.meaning.trim()).map(row=>({
    index:row.index,text:row.text.trim(),reading:['Japanese','Chinese'].includes(language)?row.reading:'',
    meaning:row.meaning.trim(),language,source:{kind:'manual'},lookupSource:'Gemini · 필기에서 확인',
  }));
}

// Reserve the reading panel and the canvas controls. Never move existing ink.
export function planInkPlacement(elements,state,sizes,{fresh=false,panelWidth=0}={}) {
  const zoom=state?.zoom?.value||1;
  const usable={...state,width:Math.max(240,(state.width||720)-panelWidth)};
  const bottom=-(state.scrollY||0)+((state.height||800)-80)/zoom;
  const right=-(state.scrollX||0)+(usable.width-28)/zoom;
  const working=fresh?[]:[...elements],positions=[];
  for(const size of sizes){
    const position=boardInsertion(working,usable,size.width,size.height);
    if(!fresh&&(position.y+size.height>bottom||position.x+size.width>right))return null;
    positions.push(position);working.push({...position,...size});
  }
  return positions;
}
