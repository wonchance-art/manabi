import {studySelectionKey} from './classStudy';
import {classroomEntries} from './classroomModel';

export const wordRecordKey = value => JSON.stringify([studySelectionKey(value),String(value.meaning||'').trim()]);
export function savedWordRecord(note,value) {
  return classroomEntries(note).find(entry=>wordRecordKey({text:entry.text,meaning:entry.primary,source:note?.processed_json?.metadata?.classSources?.[entry.id]})===wordRecordKey(value));
}
export function pendingWordRecord(queue,value) {
  return queue.find(row=>wordRecordKey({text:row.text,meaning:row.seed?.meaning,source:row.seed?.source})===wordRecordKey(value));
}
export function wordRecordSummary(states) {
  if(!states.length||states.some(state=>!state))return null;
  if(states.includes('저장 확인 필요'))return '저장 확인 필요';
  return states.every(state=>state==='수업에 남김')?'수업에 남김':'저장 대기 중';
}
