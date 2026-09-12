import { TEAM_KEY_RE, todayKey } from './classBoard';
import { makeClassAnchor, classSourceIdentity } from './classSource';

export function classStudyContext(params) {
  // The URL is context only. The component and RPC independently verify ownership.
  let team=params.get('class'),day=params.get('day');
  if(!team){
    const match=/^\/class\/([a-z0-9][a-z0-9-]{0,15})\/live(?:\?|$)/.exec(params.get('returnTo')||'');
    if(match){team=match[1];day=new URL(params.get('returnTo'),'https://manabi.invalid').searchParams.get('day');}
  }
  if(!TEAM_KEY_RE.test(team||''))return null;
  if(day&&(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day))return null;
  return {team,day:day||todayKey(),...(params.get('board')==='1'?{board:true}:{})};
}
export function classStudyHref(id,team,day,board=false) {
  const q=new URLSearchParams({class:team,day,returnTo:`/class/${team}/live?day=${day}`});
  if(board)q.set('board','1');
  return `/viewer/${id}?${q}`;
}
export function classStudyNeighborHref(neighbor,context) {
  // Local student copies must keep their team-page download/update destination.
  if(neighbor.href)return neighbor.href;
  return context?classStudyHref(neighbor.id,context.team,context.day,context.board):`/viewer/${neighbor.id}`;
}
export function studySelection(material,token,rangeText='',range=null) {
  const text=String(rangeText||token?.text||'').trim();
  if(!text)return null;
  const original=material?.processed_json?.dictionary?.[token?.id];
  const exact=!rangeText&&original?.text===text;
  const anchor=makeClassAnchor(material?.processed_json,range?.first||(exact?token.id:null),range?.last||(exact?token.id:null),text);
  return {text,meaning:exact?token.meaning||'':'',reading:exact?token.furigana||token.reading||'':'',
    source:{materialId:String(material.id),quote:text,...(exact?{tokenId:token.id}:{}),...(anchor?{anchor}:{})}};
}
export function studySelectionKey(selection) {
  const source=selection?.source||{kind:'manual'};
  const location=classSourceIdentity(source);
  if(location)return JSON.stringify([selection?.text||'',location]);
  return JSON.stringify([selection?.text||'',Object.keys(source).sort().map(key=>[key,source[key]])]);
}
export function findStudyEntry(note,selection) {
  if(!selection)return null;
  const meta=note?.processed_json?.metadata||{};
  return (meta.classEntries||[]).find(e=>{
    const source=meta.classSources?.[e.id],text=classSourceIdentity(source)?source.quote:e.text;
    return text===selection.text&&studySelectionKey({text,source})===studySelectionKey(selection);
  })||null;
}
export function buildStudySeed(selection,meaning,reading) {
  if(!selection?.text?.trim()||selection.text.length>5000)throw new Error('추가할 표현을 선택하거나 입력해 주세요.');
  return {meaning:String(meaning||'').trim().slice(0,500),reading:String(reading||'').trim().slice(0,500),source:selection.source||{kind:'manual'}};
}
