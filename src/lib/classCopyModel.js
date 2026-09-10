import {preserveReanalysisTokens} from './reanalysisPreservation';

export function stableJson(value){
  if(Array.isArray(value))return '['+value.map(stableJson).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableJson(value[k])).join(',')+'}';
  return JSON.stringify(value??null);
}
export const COPY_CONTENT_FIELDS=["lesson_explanation_ko", "conversation_script", "direction", "source_pdf_id", "page_start", "page_end", "document_json"];
export const sameContent=(a,b)=>stableJson(a)===stableJson(b);
export function sharedSnapshot(material){
  const json=material?.processed_json||{},meta=json.metadata||{};
  const metadata={};
  for(const key of ['language','level','book','translations','classEntries','classMeanings','classReadings','viewerCorrections','source','edition','editionId','textbook','classSources'])if(meta[key]!==undefined)metadata[key]=meta[key];
  const clean={...json,metadata};delete clean.last_idx;
  const extra=Object.fromEntries(COPY_CONTENT_FIELDS.map(key=>[key,material?.[key]??(key==='direction'?'read':null)]));
  return structuredClone({...extra,title:material?.title||'',raw_text:material?.raw_text||'',processed_json:clean});
}
export function classCopyUpdatePlan(copy,base,source,corrections=[]){
  const next=sharedSnapshot(source),mine=sharedSnapshot(copy);
  const summary={added:Math.max(0,next.raw_text.split('\n').filter(Boolean).length-(base?.raw_text||'').split('\n').filter(Boolean).length),preserved:0,meanings:[]};
  if(base)for(const [id,token]of Object.entries(next.processed_json.dictionary||{})){
    const before=base.processed_json?.dictionary?.[id];
    if(before?.text===token.text&&!sameContent(before.meaning,token.meaning))summary.meanings.push({text:token.text,before:before.meaning||'',after:token.meaning||'',personal:!!copy.processed_json?.dictionary?.[id]&&!sameContent(copy.processed_json.dictionary[id].meaning,before.meaning)});
  }
  if(!base){return sameContent(mine,next)?{state:'current',summary}:{state:'blocked',reason:'예전에 받은 기준 내용이 없어 자동으로 합칠 수 없어요. 내 자료를 유지합니다.',summary};}
  if(sameContent(base,next))return {state:'current',summary};
  if(copy.raw_text!==base.raw_text)return {state:'blocked',reason:'내가 수정한 원문이 있어 자동으로 바꾸지 않았어요.',summary};
  if(next.raw_text!==base.raw_text&&!next.raw_text.startsWith(base.raw_text+'\n'))return {state:'blocked',reason:'기존 원문이 수정되거나 삭제됐어요. 저장한 위치를 보호하기 위해 내 자료를 유지합니다.',summary};
  // Only exact unchanged spans may retain IDs and corrections; no fuzzy matching of words.
  const fields=['meaning','furigana','reading','pos'];const patches=[];
  const old=copy.processed_json||{},baseline=base.processed_json||{};
  for(const id of old.sequence||[]){
    const token=old.dictionary?.[id],b=baseline.dictionary?.[id];
    if(!b||token?.text!==b.text){
      if(token?.pos!=='개행')return {state:'blocked',reason:'내 분석의 단어 구성이 달라 자동으로 합칠 수 없어요.',summary};
      continue;
    }
    const changed=fields.filter(k=>!sameContent(token?.[k],b?.[k]));
    if(changed.length){patches.push({token_id:id,after_value:Object.fromEntries(changed.map(k=>[k,token[k]]))});summary.preserved+=1;}
  }
  // Source corrections are part of the baseline, not personal overrides.
  const mineMeta={...old.metadata,viewerCorrections:{}};
  for(const correction of corrections){
    if(old.dictionary?.[correction.token_id])patches.push(correction);
  }
  let result;
  try{result=preserveReanalysisTokens({...copy,processed_json:{...old,metadata:mineMeta}},next.raw_text,next.processed_json,patches);}
  catch{return {state:'blocked',reason:'기존 단어 위치를 안전하게 연결하지 못했어요. 내 자료를 유지합니다.',summary};}
  // Saved vocabulary contexts use these lexical IDs. A changed segmentation must not
  // silently drop them, even when the text itself has not changed.
  for(const id of old.sequence||[]){
    const token=old.dictionary?.[id];
    if(token?.pos==='개행'||token?.failed)continue;
    if(result.dictionary?.[id]?.text!==token?.text)return {state:'blocked',reason:'단어의 분석 단위가 달라졌어요. 저장한 단어와 문맥을 보호하기 위해 내 자료를 유지합니다.',summary};
  }
  const sourceMeta=next.processed_json.metadata||{};
  const metadata={...old.metadata,...sourceMeta,viewerCorrections:result.metadata.viewerCorrections};
  for(const name of ['classMeanings','classReadings','translations']){
    const values=old.metadata?.[name]||{},before=baseline.metadata?.[name]||{},incoming=sourceMeta[name]||{};
    if(Array.isArray(values)){if(!sameContent(values,before))metadata[name]=values;continue;}
    const merged={...incoming};
    for(const key of Object.keys(values))if(!sameContent(values[key],before[key])){merged[key]=values[key];summary.preserved++;}
    if(Object.keys(merged).length)metadata[name]=merged;
  }
  const extra=Object.fromEntries(COPY_CONTENT_FIELDS.map(key=>[key,sameContent(copy[key]??null,base[key]??null)?next[key]:copy[key]??null]));
  return {state:'update',summary,material:{...extra,title:copy.title===base.title?next.title:copy.title,raw_text:next.raw_text,processed_json:{...result,metadata}}};
}
