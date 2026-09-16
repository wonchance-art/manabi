import {splitRuby} from './splitRuby';
import {listHanjaHunEum} from './hanjaKo';
import ko from './data/hanjaKo.json';
import hun from './data/hanjaHun.json';

export const annotatedLanguage = language => ['Chinese','Japanese'].includes(language);
const han = /\p{Script=Han}/u;
export function wordSegments(text, reading, language) {
  if (!annotatedLanguage(language) || !reading) return [...text].map(plain=>({plain}));
  const parts=splitRuby(text,reading);
  // The legacy ruby fallback may repeat the whole reading over several runs.
  // Keep an uncertain reading over the whole expression instead of inventing alignment.
  if(parts.filter(part=>part.reading===reading).length>1 ||
      (language==='Chinese' && !parts.every(part=>part.pinyin)) ||
      (language==='Japanese' && han.test(text) && parts.map(part=>part.reading??part.plain).join('')!==reading)) return [{kanji:text,reading}];
  return parts;
}
const units = text => [...text].reduce((n,ch)=>n+(/[\u0020-\u007e]/.test(ch)?(/[il .,'!]/.test(ch)?.3:.6):1),0);
export const measureWordText = (text,size) => units(text)*size;
function wrap(text, width, size, measure) {
  const rows=[];
  for(const paragraph of String(text).split('\n')) {
    let row='';
    for(const ch of paragraph){if(row&&measure(row+ch,size)>width){rows.push(row);row='';}row+=ch;}
    rows.push(row);
  }
  return rows;
}

// One layout model for native editable canvas elements and DOM word previews.
// All annotations exist even when hidden; visibility never moves surrounding ink.
export function teachingWordLayout(value, {fontSize=42,maxWidth=620,measure=measureWordText,compact=false}={}) {
  const {text='',reading='',meaning='',language}=value, cjk=annotatedLanguage(language);
  const size=fontSize, readSize=language==='Japanese'?size*.5:Math.max(12,size*.34), hunSize=Math.max(12,size*.28), meaningSize=Math.max(18,size*.55);
  const labels=new Map(((cjk?listHanjaHunEum(text,ko,hun):[]) || []).map(v=>[v.ch,v.label]));
  const showReading=cjk&&value.showReading!==false, showHun=cjk&&value.showHun!==false, showMeaning=value.showMeaning!==false;
  let readBand=cjk&&reading&&(!compact||showReading)?readSize*1.35+3:0;
  const hunBand=labels.size&&(!compact||showHun)?hunSize*2.5:0;
  let rowHeight=readBand+size*1.25+hunBand;
  const gap=size*.4;
  let maxLeft=Math.max(size*1.8,(maxWidth-gap)*.51);
  const parts=[];let x=0,y=0,index=0,readingIndex=0,leftWidth=0;
  const add=(role,text,x,y,width,fontSize,extra={})=>parts.push({role,text,x,y,width,height:fontSize*1.25,fontSize,...extra});
  let groups=wordSegments(text,reading,language);
  const segmentSize=segment=>{
    const chars=[...(segment.kanji||segment.plain||'')];
    const widths=chars.map(ch=>Math.max(measure(ch,size),labels.has(ch)?Math.min(measure(labels.get(ch),hunSize),hunSize*4.5):0));
    return {chars,widths,total:Math.max(widths.reduce((a,b)=>a+b,0),segment.reading?measure(segment.reading,readSize):0)};
  };
  // Short words stay together when the meaning still has a readable right column.
  // Use the same geometry for hidden annotations, so nearby ink never shifts.
  const naturalWidth=groups.reduce((sum,segment)=>sum+segmentSize(segment).total,0);
  if(cjk&&[...text].length<=4&&naturalWidth<=maxWidth-gap-meaningSize*3)maxLeft=Math.max(maxLeft,naturalWidth);
  const groupedReading=groups.some(segment=>segment.reading&&(measure(segment.kanji,size)>maxLeft||measure(segment.reading,readSize)>maxLeft));
  if(groupedReading){
    const lines=wrap(reading,maxLeft,readSize,measure);
    leftWidth=Math.max(0,...lines.map(line=>measure(line,readSize)));
    if(!compact||showReading){lines.forEach((line,i)=>add('reading',line,0,i*readSize*1.25,maxLeft,readSize,{index:i,visible:showReading,align:'left'}));y=lines.length*readSize*1.25+4;}
    groups=[...text].map(plain=>({plain}));readBand=0;rowHeight=size*1.25+hunBand;
  }
  const lineStarts=new Set();
  if(cjk){
    groups=groups.flatMap(segment=>segment.reading?[segment]:[...(segment.kanji||segment.plain||'')].map(plain=>({plain})));
    const widths=groups.map(segment=>segmentSize(segment).total);
    const rows=[{indices:[],width:0}];
    widths.forEach((width,index)=>{if(rows.at(-1).indices.length&&rows.at(-1).width+width>maxLeft)rows.push({indices:[],width:0});rows.at(-1).indices.push(index);rows.at(-1).width+=width;});
    // Rebalance adjacent rows without changing their count or splitting ruby.
    // Working backwards also fixes 3+3+1, which a narrower fixed width cannot.
    for(let i=rows.length-1;i>0;i--){
      const before=rows[i-1],after=rows[i];
      while(before.indices.length>1){
        const index=before.indices.at(-1),width=widths[index];
        if(after.width+width>maxLeft||Math.abs(before.width-after.width)<=Math.abs(before.width-after.width-2*width))break;
        before.indices.pop();before.width-=width;after.indices.unshift(index);after.width+=width;
      }
    }
    rows.slice(1).forEach(row=>lineStarts.add(row.indices[0]));
  }
  for(const [segmentIndex,segment] of groups.entries()){
    const {chars,widths,total}=segmentSize(segment);
    const extra=Math.max(0,(total-widths.reduce((a,b)=>a+b,0))/Math.max(1,chars.length));
    if(x&&(lineStarts.has(segmentIndex)||x+total>maxLeft)){leftWidth=Math.max(leftWidth,x);x=0;y+=rowHeight+size*.28;}
    const groupStart=x;
    // A long inseparable ruby group gets its own row. Do not split its reading incorrectly.
    for(let i=0;i<chars.length;i++){
      const ch=chars[i],w=widths[i]+extra;
      if(!segment.reading&&x&&x+w>maxLeft){leftWidth=Math.max(leftWidth,x);x=0;y+=rowHeight+size*.28;}
      add('text',ch,x,y+readBand,w,size,{index:index++,align:'center'});
      const label=labels.get(ch);
      if(label&&han.test(ch)){
        const separator=label.lastIndexOf(' ');
        const lines=measure(label,hunSize)>w&&separator>0?[label.slice(0,separator),label.slice(separator+1)]:wrap(label,w,hunSize,measure);
        lines.forEach((line,lineIndex)=>add('hun',line,x,y+readBand+size*1.25+lineIndex*hunSize*1.2,w,hunSize,{index:index-1,visible:showHun,align:'center'}));
      }
      x+=w;
    }
    if(segment.reading)add('reading',segment.reading,groupStart,y,x-groupStart,readSize,{index:readingIndex++,visible:showReading,align:'center'});
    leftWidth=Math.max(leftWidth,x);
  }
  const remaining=Math.max(meaningSize*3,maxWidth-leftWidth-gap);
  const meaningWidth=Math.min(remaining,Math.max(meaningSize*2,measure(meaning||' ',meaningSize)));
  const meaningLines=wrap(meaning,meaningWidth,meaningSize,measure);
  const meaningTop=readBand+(size*1.25-meaningSize*1.25)/2;
  meaningLines.forEach((line,index)=>add('meaning',line,leftWidth+gap,meaningTop+index*meaningSize*1.4,meaningWidth,meaningSize,{index,visible:showMeaning,align:'left'}));
  const width=leftWidth+(meaning||!compact?gap+meaningWidth:0), height=Math.max(y+rowHeight,meaningTop+meaningLines.length*meaningSize*1.4);
  return {width:Math.max(size,width),height:Math.max(size,height),parts,showReading,showHun,showMeaning};
}

export function normalizeWordAppearance(input={}) {
  return {layoutVersion:2,appearance:input.appearance==='card'?'card':'plain',showReading:input.showReading!==false,showHun:input.showHun!==false,showMeaning:input.showMeaning!==false};
}
export function readWordAppearance(owner,language) {
  try{return normalizeWordAppearance(JSON.parse(localStorage.getItem(`teaching-word-display:${owner}:${language}`)||'{}'));}
  catch{return normalizeWordAppearance();}
}
export function writeWordAppearance(owner,language,value) {
  try{localStorage.setItem(`teaching-word-display:${owner}:${language}`,JSON.stringify(normalizeWordAppearance(value)));}catch{/* Current board still works when preference storage is unavailable. */}
}
