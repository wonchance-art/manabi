import {kstDateString} from './growthStats';
import {validBoardDay} from './teachingBoardCloud';

export const BOARD_HISTORY_SIZE=30;
const invalid=message=>{throw Object.assign(new Error(message),{status:400});};
const validDay=day=>validBoardDay(day)&&day>='1900-01-01'&&day<='2200-12-31';
export function boardHistoryRange(from='',to='') {
  from=from||'';to=to||'';
  if(!!from!==!!to||from&&(!validDay(from)||!validDay(to)))invalid('시작일과 종료일을 확인해 주세요.');
  if(from>to)invalid('종료일은 시작일보다 빠를 수 없어요.');
  return {from,to};
}
export function boardHistoryPeriod(period,now=Date.now()) {
  if(period==='all')return boardHistoryRange();
  if(!['month','previous'].includes(period))invalid('기간을 확인해 주세요.');
  const [year,month]=kstDateString(now).split('-').map(Number),offset=period==='previous'?1:0;
  return boardHistoryRange(new Date(Date.UTC(year,month-1-offset,1)).toISOString().slice(0,10),new Date(Date.UTC(year,month-offset,0)).toISOString().slice(0,10));
}
export function boardHistoryRequest(root,options={}) {
  const range=boardHistoryRange(options.from,options.to);let before='';
  if(options.cursor){
    try {
      if(typeof options.cursor!=='string'||options.cursor.length>1000)throw Error();
      const c=JSON.parse(decodeURIComponent(options.cursor));
      if(c.v!==1||c.root!==String(root)||c.from!==range.from||c.to!==range.to||!validDay(c.day)||range.from&&(c.day<range.from||c.day>range.to))throw Error();
      before=c.day;
    }catch{invalid('이전 목록 위치를 확인하지 못했어요. 새로고침해 주세요.');}
  }
  return {root:String(root),...range,before};
}
export function boardHistoryPage(rows,scope) {
  const more=rows.length>BOARD_HISTORY_SIZE,items=rows.slice(0,BOARD_HISTORY_SIZE);
  const nextCursor=more?encodeURIComponent(JSON.stringify({v:1,root:scope.root,from:scope.from,to:scope.to,day:items.at(-1).day})):null;
  return {boards:items.map(b=>({id:b.id,day:b.day,updatedAt:b.updated_at,pages:b.manifest.pages.length})),nextCursor,truncated:more};
}
export function boardHistoryGroups(rows) {
  const groups=[];
  for(const row of rows){const month=row.day.slice(0,7);if(groups.at(-1)?.month!==month)groups.push({month,rows:[]});groups.at(-1).rows.push(row);}
  return groups;
}
