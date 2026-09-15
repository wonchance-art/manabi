import {BOARD_LANGUAGES} from './teachingBoard';

export function lookupInput(value) {
  if(!value||!BOARD_LANGUAGES.includes(value.language))throw new Error('언어를 확인해 주세요.');
  const text=typeof value.text==='string'?value.text.trim():'';
  if(!text||text.length>500)throw new Error('표현을 500자 이내로 입력해 주세요.');
  return {text,language:value.language,context:typeof value.context==='string'?value.context.slice(0,1000):''};
}
export function lookupSenses(value) {
  return (Array.isArray(value)?value:[]).map(item=>{
    const meaning=typeof item==='string'?item:typeof item?.meaning==='string'?item.meaning:typeof item?.definition==='string'?item.definition:'';
    return {meaning:meaning.trim().slice(0,500),pos:typeof item?.pos==='string'?item.pos.slice(0,40):'',example:typeof item?.example==='string'?item.example.slice(0,500):''};
  }).filter(item=>item.meaning).slice(0,6);
}
export function parseLookupAnswer(text) {
  const clean=String(text).trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
  const value=JSON.parse(clean),senses=lookupSenses(value.senses);
  if(!senses.length)throw new Error('뜻을 확인하지 못했어요.');
  return {reading:typeof value.reading==='string'?value.reading.slice(0,500):'',senses};
}
export const lookupSourceLabel = source => source==='ai'?'AI 설명':source==='user_verified'?'사용자 교정 자료':source==='gemini'?'저장된 AI 설명':source==='dictionary'?'공통 사전 자료':'저장된 설명';
