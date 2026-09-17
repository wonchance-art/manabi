const text = value => typeof value === 'string' ? value.trim() : '';
const gloss = value => {
  const v = text(value);
  return v && v.length <= 100 && !/[<>\r\n]/.test(v) ? v : null;
};

export function contextMeaningKey({userId,materialId,tokenId,word,surface,meaning,pos,sentence}) {
  return ['viewer-context-meaning',1,userId||'guest',String(materialId||''),text(tokenId),
    text(word),text(surface),text(meaning),text(pos),text(sentence)];
}

export function dictionaryMeaningChoices(entry) {
  const result=[],seen=new Set();
  for (const row of Array.isArray(entry?.meanings)?entry.meanings:[]) {
    const meaning=gloss(row?.meaning),pos=text(row?.pos).slice(0,30);
    const key=JSON.stringify([meaning,pos]);
    if (!meaning || seen.has(key)) continue;
    seen.add(key);result.push({meaning,pos,source:'dictionary'});
  }
  return result.slice(0,16);
}

export function meaningChoiceCorrection(token, choice) {
  const meaning=gloss(choice?.meaning);
  if (!meaning || !['dictionary','context-ai'].includes(choice?.source) || meaning===text(token?.meaning)) return null;
  // A meaning choice never changes reading, lexical identity, saved vocabulary or SRS.
  return {meaning, ...(choice.source==='dictionary' && text(choice.pos)?{pos:text(choice.pos)}:{})};
}

export function normalizeContextMeaning(value) {
  const explanation=text(value?.explanation);
  if (!explanation || explanation.length>500 || /[<>]/.test(explanation)) return null;
  if (value?.candidate===null) return {explanation,candidate:null};
  const meaning=gloss(value?.candidate?.meaning);
  if (!meaning || !/\p{Script=Hangul}/u.test(meaning)) return null;
  return {explanation,candidate:{meaning,source:'context-ai'}};
}

export async function fetchContextMeaning({userId,materialId,tokenId,word,surface,meaning,pos,sentence,signal}) {
  if (!userId || !text(sentence)) throw Error('로그인 후 본문에서 단어를 골라 주세요.');
  const {supabase}=await import('./supabase');
  const {data:{session}}=await supabase.auth.getSession();
  if (!session?.access_token || session.user?.id!==userId) throw Error('로그인 상태가 바뀌었어요. 다시 확인해 주세요.');
  const response=await fetch('/api/explain',{
    method:'POST',signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
    body:JSON.stringify({language:'Chinese',materialId,tokenKey:tokenId,
      token:{meaningChoice:true,sentence,word,surface,currentMeaning:meaning,pos}}),
  });
  const value=await response.json().catch(()=>null);
  if (!response.ok) throw Error(value?.error?.message||'문맥 뜻을 불러오지 못했어요.');
  const result=normalizeContextMeaning(value);
  if (!result) throw Error('뜻 후보를 확인하지 못했어요. 다시 시도해 주세요.');
  return result;
}
