'use client';
import {useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {useQueryClient} from '@tanstack/react-query';
import {claimClassSaveIntent,finishClassSaveIntent} from '../../lib/classSaveIntent';
import {requestClassCopy,studentReaderHref} from '../../lib/classCopyClient';
import {supabase} from '../../lib/supabase';
import {buildVocabRow,VOCAB_UPSERT} from '../../lib/vocabIO';
import {tokenContext} from '../../lib/learningSources';
import {saveContext} from '../learning/SaveContextButton';

export default function ClassSaveResume({user}){
  const params=useSearchParams(),request=params.get('classSave'),router=useRouter(),client=useQueryClient();
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0),[conflict,setConflict]=useState(null),[confirm,setConfirm]=useState(null);
  useEffect(()=>{
    if(!user?.id||!request||!/^[a-f0-9-]{36}$/.test(request))return;
    let active=true,wordSaved=false;setBusy(true);setMessage('선택한 표현으로 돌아가고 있어요…');
    (async()=>{
      const intent=await claimClassSaveIntent(request,user.id);
      const state=await requestClassCopy(intent.team,intent.materialId,'open');
      if(!active)return;
      if(!state.copyId)throw new Error('기존 사본을 먼저 선택해 주세요. 수업 자료를 연 뒤 이 요청을 재시도할 수 있어요.');
      const {data:copy,error}=await supabase.from('reading_materials').select('raw_text,processed_json').eq('owner_id',user.id).eq('id',state.copyId).single();if(error)throw error;
      const word=intent.word,quote=word.sourceSentence||word.text;
      const token=copy.processed_json?.dictionary?.[intent.tokenId];
      const exactToken=token?.text===word.text&&tokenContext(copy.processed_json,intent.tokenId)?.quote===quote;
      if(!copy.raw_text.includes(quote)||!quote.includes(word.text))throw new Error('원문이 바뀌었어요. 내 자료에서 표현을 다시 선택해 주세요. 저장 요청은 보관되어 있어요.');
      const row=buildVocabRow({userId:user.id,surface:word.text,base:word.base,meaning:word.meaning,pos:word.pos,reading:word.reading,language:word.language,sourceSentence:quote,sourceMaterialId:state.copyId,grade:intent.grade});
      if(!active)return;
      const {error:saveError}=await supabase.from('user_vocabulary').upsert(row,VOCAB_UPSERT);if(saveError)throw saveError;wordSaved=true;
      // A changed meaning requires the same explicit confirmation as ordinary context saving.
      const source={kind:'reading',materialId:String(state.copyId),quote,surface:word.text,...(exactToken?{tokenId:intent.tokenId}:{})};
      await saveContext({word:row,source,...(confirm?{confirmId:confirm.id,confirmMeaning:confirm.meaning}:{})});
      await finishClassSaveIntent(request);
      if(!active)return;
      for(const key of ['vocab','vocab-words','vocabulary-contexts','class-claimed'])client.invalidateQueries({queryKey:[key,user.id]});
      const url=new URL(studentReaderHref(state.copyId,intent.team,intent.day),'https://manabi.invalid');
      if(exactToken)url.searchParams.set('sourceToken',intent.tokenId);
      url.searchParams.set('sourceText',quote.slice(0,1000));
      url.searchParams.set('classSaved','1');
      router.replace(url.pathname+url.search);setMessage('표현과 문맥을 저장했어요.');
    })().catch(error=>{if(active){setMessage(error.code==='meaning_conflict'?'단어는 보관되어 있어요. 기존 뜻과 같은 의미인지 확인해 주세요.':wordSaved?'단어는 저장됐지만 문맥 연결을 마치지 못했어요. 다시 시도해 주세요.':error.message||'저장을 마치지 못했어요. 다시 시도해 주세요.');if(error.code==='meaning_conflict')setConflict(error);}})
      .finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[user?.id,request,retry,confirm,router,client]);
  if(!user||!request)return null;
  return <div className="classroom-resume"><p role="status">{message}</p>{!busy&&<button onClick={()=>setRetry(n=>n+1)}>저장 재시도</button>}{conflict&&<div><p>기존 뜻: {conflict.existing?.meaning}</p><p>이번 뜻: {conflict.incomingMeaning}</p><button onClick={()=>{setConfirm(conflict.existing);setConflict(null);}}>같은 뜻이에요 · 문맥 연결</button></div>}</div>;
}
