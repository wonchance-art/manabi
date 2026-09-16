import {boardExpression, expressionOf} from './teachingBoard';
import {teachingWordLayout} from './teachingWordLayout';

// Native canvas text and shapes share one layer with ink. Group IDs are remapped
// by the editor on duplication; no child-to-parent ID links can become stale.
export function cardFields(anchor, elements) {
  const group = anchor?.groupIds?.[0];
  return group ? elements.filter(el => !el.isDeleted && el.type === 'text' && el.groupIds?.[0] === group && el.customData?.manabiField) : [];
}

export function readCard(anchor, elements) {
  const value = expressionOf(anchor);
  if (!value) return null;
  const result = {...value};
  if(value.layoutVersion===2){
    const fields=cardFields(anchor,elements);
    for(const role of ['text','reading','meaning']){
      const parts=fields.filter(el=>el.customData.manabiField===role).sort((a,b)=>a.customData.index-b.customData.index);
      if(parts.some(el=>el.text!==el.customData.displayText)){
        result[role]=parts.map(el=>el.text===el.customData.displayText?el.customData.value:el.originalText||el.text).join(role==='reading'&&value.language==='Chinese'?' ':role==='meaning'?'\n':'');
      }
    }
    if(result.text!==value.text){result.source={kind:'manual'};result.reading='';}
    try{return boardExpression(result,value.language);}catch{return null;}
  }
  for (const field of cardFields(anchor, elements)) {
    const role = field.customData.manabiField;
    if (['text','reading','meaning'].includes(role)) result[role] = field.text === field.customData.displayText ? field.customData.value : field.originalText || field.text;
  }
  if (result.text !== value.text) result.source = {kind:'manual'};
  try {return boardExpression(result, value.language);} catch {return null;}
}

export function wrapBoardText(text, maxUnits) {
  const lines=[];
  for(const paragraph of text.split('\n')) {
    let line='', units=0;
    for(const char of paragraph) {
      const size=/[\u0020-\u007e]/.test(char) ? .56 : 1;
      if(units+size>maxUnits && line) {lines.push(line);line='';units=0;}
      line+=char;units+=size;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

export function cardSkeleton(value, id, position, palette, width=320, scale=1) {
  if(value.layoutVersion===2)return wordCardSkeleton(value,id,position,palette,{maxWidth:width,scale});
  const groupIds=[id], inner=width-40*scale, parts=[];
  let y=position.y+24*scale;
  for(const [role,baseSize,color] of [['reading',22,palette.accent],['text',42,palette.ink],['meaning',24,palette.ink]]) {
    const fontSize=baseSize*scale;
    const original=value[role], displayText=wrapBoardText(original || ' ',inner/fontSize), height=displayText.split('\n').length*fontSize*1.4;
    parts.push({type:'text',id:`${id}-${role}`,x:position.x+width/2,y,width:inner,height,text:displayText,originalText:displayText,fontSize,fontFamily:2,lineHeight:1.4,textAlign:'center',autoResize:false,strokeColor:color,groupIds,
      opacity:role==='reading'&&!value.showReading || role==='meaning'&&!value.showMeaning ? 0 : 100,
      customData:{manabiField:role,value:original,displayText}});
    y+=height+(role==='reading'?6:12)*scale;
  }
  return [{type:'rectangle',id,...position,width,height:y-position.y+12*scale,strokeColor:palette.line,backgroundColor:palette.paper,fillStyle:'solid',strokeWidth:1,roughness:0,roundness:{type:3},groupIds,customData:{manabiExpression:value}},...parts];
}

export function wordCardSkeleton(value,id,position,palette,{maxWidth=620,scale=1,measure,compact=false}={}) {
  const layout=teachingWordLayout(value,{fontSize:42*scale,maxWidth,measure,compact});
  const pad=(value.appearance==='card'?16:2)*scale,groupIds=[id];
  return [{type:'rectangle',id,...position,width:layout.width+pad*2,height:layout.height+pad*2,
    strokeColor:value.appearance==='card'?palette.line:'transparent',backgroundColor:value.appearance==='card'?palette.paper:'transparent',
    fillStyle:'solid',strokeWidth:1,roughness:0,roundness:{type:3},groupIds,customData:{manabiExpression:value}},
  ...layout.parts.map((part,i)=>({type:'text',id:`${id}-${i}`,x:position.x+pad+part.x+(part.align==='center'?part.width/2:0),y:position.y+pad+part.y,
    width:part.width,height:part.height,text:part.text||' ',originalText:part.text||' ',fontSize:part.fontSize,fontFamily:2,lineHeight:1.25,textAlign:part.align,
    autoResize:false,strokeColor:part.role==='reading'?palette.accent:part.role==='hun'?palette.muted||palette.ink:palette.ink,groupIds,opacity:part.visible===false?0:100,
    customData:{manabiField:part.role,index:part.index,value:part.text,displayText:part.text||' '}}))];
}

export function expressionElements(anchor,elements){
  const group=anchor.groupIds?.[0];
  return elements.filter(el=>!el.isDeleted&&(el.id===anchor.id||el.groupIds?.[0]===group));
}

// Return translation deltas only: the editor applies them in one undoable change.
export function arrangeExpressionGroups(anchors,elements,direction='row',gap=24){
  const groups=anchors.map(anchor=>{const members=expressionElements(anchor,elements);return {members,left:Math.min(...members.map(el=>el.x)),top:Math.min(...members.map(el=>el.y)),right:Math.max(...members.map(el=>el.x+el.width)),bottom:Math.max(...members.map(el=>el.y+el.height))};});
  if(groups.length<2)return new Map();
  groups.sort((a,b)=>direction==='row'?a.left-b.left:a.top-b.top);
  let x=Math.min(...groups.map(g=>g.left)),y=Math.min(...groups.map(g=>g.top));const changes=new Map();
  for(const g of groups){for(const el of g.members)changes.set(el.id,{x:el.x+x-g.left,y:el.y+y-g.top});if(direction==='row')x+=g.right-g.left+gap;else y+=g.bottom-g.top+gap;}
  return changes;
}

export function rotateCardPart(part,container,angle=0) {
  const cx=container.x+container.width/2,cy=container.y+container.height/2;
  const dx=part.x+part.width/2-cx,dy=part.y+part.height/2-cy;
  return {...part,x:cx+dx*Math.cos(angle)-dy*Math.sin(angle)-part.width/2,y:cy+dx*Math.sin(angle)+dy*Math.cos(angle)-part.height/2,angle};
}

export function boardPageSummary(page) {
  const visible=page.elements.filter(el=>!el.isDeleted);
  const words=visible.filter(expressionOf).map(el=>readCard(el,visible)?.text).filter(Boolean);
  const text=words.length ? words.join(' · ') : visible.filter(el=>el.type==='text').map(el=>el.text).join(' · ');
  return {text:text.slice(0,160),count:visible.length,words:words.length,ink:visible.filter(el=>el.type==='freedraw').length};
}
