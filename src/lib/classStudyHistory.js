import {classroomEntries} from './classroomModel';
export function classHistoryEntries(note,chapterIds=[]) {
 const allowed=new Set(chapterIds.map(String)),sources=note?.processed_json?.metadata?.classSources||{};
 return classroomEntries(note).map(entry=>{const source=sources[entry.id];return {id:entry.id,text:entry.text,meaning:entry.primary,reading:entry.reading,
  source:source?.kind==='manual'?{kind:'manual'}:allowed.has(String(source?.materialId))?{kind:'textbook',materialId:String(source.materialId),tokenId:source.tokenId||null,quote:source.quote||entry.text}:null};});
}
export function filterClassHistory(notes,query='',onlyExtras=false){
 const search=query.trim().toLocaleLowerCase();
 return notes.map(note=>({...note,entries:(note.entries||[]).filter(e=>(!onlyExtras||e.source?.kind==='manual')&&(!search||[note.day,e.text,e.meaning,e.reading].join(' ').toLocaleLowerCase().includes(search)))})).filter(n=>n.entries.length||(!search&&!onlyExtras));
}
