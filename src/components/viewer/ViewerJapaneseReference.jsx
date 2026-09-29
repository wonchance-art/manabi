'use client';
import {useQuery} from '@tanstack/react-query';
import {toJaForm} from '../../lib/hanjaKo';
import {japaneseReferenceForMeaning,japaneseReferenceKey,lookupJapaneseReference} from '../../lib/viewerJapaneseReference';

export default function ViewerJapaneseReference(props) {
  const {word,jaTable}=props;
  const glyphForm=jaTable?toJaForm(word,jaTable):null;
  const queryKey=japaneseReferenceKey({...props,form:glyphForm});
  // A new word/sense/POS/account needs its own explicit request. Remounting also
  // unsubscribes the old query, aborting it before a late result reaches this UI.
  return <ReferenceSelection key={JSON.stringify(queryKey)} {...props} glyphForm={glyphForm} queryKey={queryKey}/>;
}

function ReferenceSelection({userId,word,meaning,pos,dictEntry,loading,dictError,glyphForm,queryKey,formError,onRetryForm}) {
  const dictionary=japaneseReferenceForMeaning(dictEntry,meaning,{pos,form:glyphForm});
  const query=useQuery({
    queryKey,
    queryFn:({signal})=>lookupJapaneseReference({word,meaning,pos,form:glyphForm,signal}),
    enabled:false,
    staleTime:30*60*1000,gcTime:30*60*1000,retry:false,
  });
  const ref=query.data||dictionary;
  const same=!!ref&&ref.form===glyphForm;
  return <section className="reader-japanese" aria-label="일본어 대조">
    <div className="reader-japanese__row">
      <span className="reader-japanese__label" title="글자 모양을 일본식으로 옮긴 표기이며, 실제 일본어 단어와 다를 수 있어요.">{same?'일본어':'일본식 자형'}</span>
      {glyphForm?<span lang="ja" className="reader-japanese__form">{glyphForm}</span>:<span role="status">{formError?'자형을 불러오지 못했어요.':'불러오는 중…'}{formError&&onRetryForm&&<button type="button" className="btn btn--ghost btn--sm" onClick={onRetryForm}>자형 다시 불러오기</button>}</span>}
      {same&&query.data&&<small title="현재 한국어 뜻을 기준으로 찾은 AI 대응어">AI</small>}
      {same&&ref&&!query.data&&<small>기존 사전</small>}
    </div>
    {ref&&!same&&<div className="reader-japanese__row"><span className="reader-japanese__label">같은 뜻</span><strong lang="ja">{ref.form}</strong>{query.data?<small title="현재 한국어 뜻을 기준으로 찾은 AI 대응어">AI</small>:<small>기존 사전</small>}</div>}
    {ref?.warn&&<p className="reader-japanese__note">일본어 참고: {ref.warn}</p>}
    {(!dictionary||query.data||query.isError)&&<div className="reader-japanese__lookup">
      {userId?<button type="button" aria-disabled={query.isFetching||!glyphForm||!meaning||loading&&!dictError} onClick={()=>{if(!query.isFetching&&glyphForm&&meaning&&(!loading||dictError))query.refetch();}}>{query.isFetching?'일본어를 찾는 중…':query.isError?'일본어 다시 찾기':query.data?'일본어 다시 확인':'일본어 대응 찾기'}</button>:<span>로그인하면 일본어 대응어를 찾을 수 있어요.</span>}
      {query.isError&&<span role="status">대응어를 불러오지 못했어요.</span>}
    </div>}
  </section>;
}
