import {classroomEntries} from './classroomModel';
import {sourceFromClassNote} from './classSource';
export function classHistoryEntries(note,chapterIds=[]) {
 const allowed=new Set(chapterIds.map(String)),sources=note?.processed_json?.metadata?.classSources||{};
 return classroomEntries(note).map(entry=>{const source=sources[entry.id],saved=sourceFromClassNote(note,entry.id);return {id:entry.id,text:entry.text,meaning:entry.primary,reading:entry.reading,
  source:source?.kind==='manual'?{kind:'manual'}:saved&&allowed.has(saved.materialId)?{kind:'textbook',...saved,tokenId:saved.tokenId||null}:null};});
}
export function filterClassHistory(notes,query='',onlyExtras=false){
 const search=query.trim().toLocaleLowerCase();
 return notes.map(note=>({...note,entries:(note.entries||[]).filter(e=>(!onlyExtras||e.source?.kind==='manual')&&(!search||[note.day,e.text,e.meaning,e.reading].join(' ').toLocaleLowerCase().includes(search)))})).filter(n=>n.entries.length||(!search&&!onlyExtras));
}
