'use client';
// 더 알아보기 · 「일본어로는」 한 줄(뷰어 v2 AE-R3 PR ② — VIEWER-V2-ROUNDS-001 §2.1 더 알아보기 · 설계서 docs/manabi-viewer-v2-ae-r3.md §5).
// 일본어 대조 블록이 하던 일 중 「같은 단어의 일본어 표기」는 자형 열 日 줄이 맡고, 여기에는 나머지 둘만 남는다.
//   · 같은 뜻 다른 말(diff — 老师 → 先生 せんせい)과 동형이의어 경고(warn — 汽车 = 일본어로는 ‘기차’): 사전 행이 이 뜻에 맞는
//     일본어를 갖고 있으면 버튼 대신 내용(정본 §2.1 「이미 만든 결과가 있으면 내용」). 뜻별 매칭은 기존 japaneseReferenceForMeaning.
//   · 수기 동형이의어(jaWords.json warn — 回复 ↔ 回復 '회복')는 사전 행이 없어도(게스트) 경고로 보인다.
//   · 없으면 로그인 사용자에게 [✦ 일본어로는?] 요청 버튼 — 누를 때만 기존 클라 AI 조회(lookupJapaneseReference) 그대로.
// 「AI」 표시는 없다(오너 결정 2026-10-07 23:45 KST). 이 조각은 쓰지 않는다 — 요미 받기·빈 칸 저장은 PR ③.
// 호출부는 日 줄이 보이지 않을 때만 둔다(같은 표기를 두 번 보이지 않는다).
import {useContext,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {ViewerUiLocaleContext} from '../../lib/viewerLocaleContext';
import {t} from '../../lib/viewerMessages';
import {jaWarnFromTable,jaWordFromTable} from '../../lib/glyphColumn';
import {japaneseReferenceForMeaning,lookupJapaneseReference} from '../../lib/viewerJapaneseReference';

export default function ViewerJapaneseMore({userId,word,meaning,pos,dictEntry,jaTable,dictLoading=false}) {
  const uiLocale=useContext(ViewerUiLocaleContext);
  const vt=(key,values)=>t(uiLocale,key,values);
  const [requested,setRequested]=useState(false);
  // 확인된 같은 표기(JMdict)가 있으면 그것을, 없으면 간체 표제어를 「같은 글자」 기준으로 쓴다 — 사전 행이 같은 글자를 두고
  // diff라 적은 모순 행을 거르는 기존 규칙(japaneseCandidateConsistency)과 AI 조회의 자형 힌트. 글자 변환(toJaForm)은 쓰지 않는다.
  const hint=jaWordFromTable(word,jaTable)?.form||null;
  const dictionary=japaneseReferenceForMeaning(dictEntry,meaning,{pos,form:hint||word});
  const query=useQuery({
    queryKey:['viewer-japanese-reference',userId||'guest',word,meaning,hint],
    queryFn:({signal})=>lookupJapaneseReference({word,meaning,form:hint||undefined,signal}),
    enabled:requested&&!!userId&&!!meaning,
    staleTime:30*60*1000,gcTime:30*60*1000,retry:false,
  });
  const ref=query.data||dictionary;
  const curated=jaWarnFromTable(word,jaTable);
  // 수기 경고는 사전 행이 따로 경고를 갖지 않을 때만 붙인다(같은 표기를 같은 단어로 적은 사전 행도 바로잡는다).
  const curatedNote=curated&&!ref?.warn&&(!ref||ref.form===curated.form)
    ?<span className="reader-card-learn__ja-warn">{vt('일본어 {form}는 ‘{meaning}’',{form:curated.form,meaning:curated.meaning})}</span>:null;
  if(ref)return <p className="reader-card-learn__ja">
    <span className="reader-card-learn__ja-label">{vt('일본어로는')}</span>{' '}
    <strong lang="ja">{ref.form}</strong>
    {ref.yomi&&<>{' '}<span lang="ja" className="reader-card-learn__ja-yomi">{ref.yomi}</span></>}
    {ref.warn&&<span className="reader-card-learn__ja-warn">{' · '}{vt('같은 한자 표기는 일본어에서 ‘{meaning}’라는 뜻이에요.',{meaning:ref.warn})}</span>}
    {curatedNote&&<>{' · '}{curatedNote}</>}
  </p>;
  const warnLine=curatedNote?<p className="reader-card-learn__ja">{curatedNote}</p>:null;
  if(!userId||dictLoading||!meaning)return warnLine;
  if(query.isFetching)return <>{warnLine}<p role="status">{vt('일본어를 찾는 중…')}</p></>;
  return <>
    {warnLine}
    {query.isError&&<p role="status">{vt('대응어를 불러오지 못했어요.')}</p>}
    <button type="button" className="btn btn--ghost btn--sm reader-card-learn__ask" onClick={()=>{if(requested)query.refetch();else setRequested(true);}}>{vt('✦ 일본어로는?')}</button>
  </>;
}
