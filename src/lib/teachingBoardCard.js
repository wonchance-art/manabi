import {boardExpression, expressionOf} from './teachingBoard';

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

export function rotateCardPart(part,container,angle=0) {
  const cx=container.x+container.width/2,cy=container.y+container.height/2;
  const dx=part.x+part.width/2-cx,dy=part.y+part.height/2-cy;
  return {...part,x:cx+dx*Math.cos(angle)-dy*Math.sin(angle)-part.width/2,y:cy+dx*Math.sin(angle)+dy*Math.cos(angle)-part.height/2,angle};
}
