'use client';
import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {contextMeaningKey,dictionaryMeaningChoices,meaningChoiceCorrection,fetchContextMeaning} from '../../lib/viewerMeaningChoices';

export default function ViewerMeaningChoices(props) {
  const queryKey=contextMeaningKey(props);
  const identity=JSON.stringify([props.userId,props.materialId,props.tokenId,props.sentence]);
  return <MeaningPanel key={identity} {...props} queryKey={queryKey}/>;
}

function MeaningPanel(props) {
  const details=useRef(null),summary=useRef(null);
  const saved=()=>{
    if(!details.current) return;
    const restore=details.current.contains(document.activeElement)||document.activeElement===document.body;
    details.current.open=false;
    if(restore) summary.current?.focus({preventScroll:true});
  };
  return <details ref={details} className="reader-meaning" onKeyDown={event=>{
    if(event.key==='Escape'&&details.current?.open){event.preventDefault();event.stopPropagation();details.current.open=false;summary.current?.focus();}
  }}>
    <summary ref={summary}>다른 뜻 확인</summary>
    <MeaningChoices key={JSON.stringify(props.queryKey)} {...props} onSaved={saved}/>
  </details>;
}

function MeaningChoices({queryKey,userId,materialId,tokenId,word,surface,meaning,pos,sentence,dictEntry,dictLoading,dictError,onRetryDictionary,canApply,onApply,saving,onSaved}) {
  const [choice,setChoice]=useState(null),[error,setError]=useState(''),[pending,setPending]=useState(false);
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  // Queries are always manual, including refocus/reconnect and broad invalidation.
  const query=useQuery({queryKey,queryFn:({signal})=>fetchContextMeaning({userId,materialId,tokenId,word,surface,meaning,pos,sentence,signal}),
    enabled:false,retry:false,staleTime:30*60*1000,gcTime:30*60*1000});
  const options=dictionaryMeaningChoices(dictEntry);
  const correction=meaningChoiceCorrection({meaning},choice);
  const busy=saving||pending;
  const pick=option=>{if(!busy){setChoice(option);setError('');}};
  const apply=async()=>{
    if (!canApply || !correction || busy) return;
    setPending(true);setError('');
    try {
      await onApply(correction,{tokenId,expectedMeaning:meaning});
      if(alive.current)setChoice(null);
      onSaved();
    } catch { if(alive.current)setError('저장하지 못했어요. 고른 뜻을 유지했으니 다시 시도해 주세요.'); }
    finally { if(alive.current)setPending(false); }
  };
  const option=(item,label)=>canApply?<button type="button" key={item.meaning+item.pos} className="reader-meaning__option"
    aria-pressed={choice?.meaning===item.meaning&&choice?.source===item.source&&choice?.pos===item.pos} disabled={busy} onClick={()=>pick(item)}>
    <span>{item.meaning}</span><small>{label}{item.pos?` · ${item.pos}`:''}{item.meaning===meaning?' · 현재 뜻':''}</small>
  </button>:<p key={item.meaning+item.pos}><strong>{item.meaning}</strong><small> {label}{item.pos?` · ${item.pos}`:''}</small></p>;
  return <div className="reader-meaning__body">
      <p className="reader-meaning__caption">사전의 뜻 · 문장에 맞는지 확인해 주세요</p>
      {dictLoading?<p role="status">사전을 불러오는 중…</p>:dictError?<p role="alert">사전을 불러오지 못했어요. <button type="button" onClick={onRetryDictionary}>다시 불러오기</button></p>:options.length?options.map(item=>option(item,'사전')):<p>등록된 다른 뜻이 없어요. 직접 수정하거나 문맥 뜻을 확인할 수 있어요.</p>}
      {sentence&&<div className="reader-meaning__context">
        <blockquote lang="zh-Hans">{sentence}</blockquote>
        <button type="button" className="btn btn--ghost btn--sm" aria-disabled={query.isFetching||!userId||busy}
          onClick={()=>{if(!query.isFetching&&userId&&!busy)query.refetch();}}>
          {query.isFetching?'문맥 확인 중…':query.isError?'문맥 뜻 다시 확인':'이 문장의 뜻 확인'}
        </button>
        {!userId&&<p>로그인하면 문맥 뜻을 확인할 수 있어요.</p>}
        {query.isError&&<p role="alert">문맥 뜻을 불러오지 못했어요. 다시 시도해 주세요.</p>}
        {query.data&&<div role="status" className="reader-meaning__result">
          {query.data.candidate?option(query.data.candidate,'AI 문맥 후보'):<p>뜻을 하나로 고르기 어려워요. 문장과 사전의 뜻을 함께 확인해 주세요.</p>}
          <p>{query.data.explanation}</p>
        </div>}
      </div>}
      {canApply?<div className="reader-meaning__footer">
        {correction?<p><strong>{choice.meaning}</strong>으로 바꿉니다. 이 자료의 선택한 표현에만 저장돼요.</p>:<p>뜻을 골라도 저장하기 전에는 바뀌지 않아요.</p>}
        {error&&<p role="alert">{error}</p>}
        <button type="button" className="btn btn--primary btn--sm" disabled={!correction||busy} onClick={apply}>{busy?'저장 중…':'이 자료에만 저장'}</button>
      </div>:<p className="reader-meaning__caption">이 자료는 읽기 전용입니다. 뜻 후보를 비교할 수 있어요.</p>}
    </div>;
}
