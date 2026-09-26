'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {bookHref,editableFields,validateManuscript,withField} from '@/lib/textbook/contract';
import './books.css';
const api='/api/admin/books/japanese-n5';
const names={title:'제목',subtitle:'부제',goal:'학습 목표',scene:'장면',words:'준비 단어',ja:'일본어',ko:'한국어',body:'설명',note:'도움말',lead:'도입',prompt:'질문',answer:'정답',why:'해설',formula:'문형',label:'표제',examples:'예문',patterns:'핵심 표현',study_pages:'표현 설명',practice_pages:'확인 활동',review_pages:'누적 복습',dialog:'대화',oral:'말하기',reading:'읽기 본문',meaning:'뜻',reading_question:'읽기 질문',reading_answer:'읽기 정답',reading_why:'읽기 해설',writing_prompt:'내 문장 질문',writing_sample:'내 문장 예시',checks:'확인 문제',cue:'제시문',options:'선택지',rows:'표',tasks:'문항',kanji:'한자 읽기',preparation:'준비 안내',prerequisite:'앞에서 배운 것',next:'다음 과 연결',culture:'문화 설명',culture_title:'문화 제목',spelling:'표기',readings:'읽는 법',text:'본문',items:'항목',parts:'부분',help:'도움말',closing:'마무리',translation:'번역'};
const label=path=>path.map(k=>typeof k==='number'?`${k+1}번`:names[k]||(/^[\u3040-\u9fff]+$/.test(k)?k:'내용')).join(' · ');
function download(book,name='japanese-n5-manuscript.json'){const url=URL.createObjectURL(new Blob([JSON.stringify(book,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export default function BookEditor(){
  const [data,setData]=useState(null),[book,setBook]=useState(null),[group,setGroup]=useState('lesson:0'),[search,setSearch]=useState(''),[limit,setLimit]=useState(80),[pending,setPending]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[dirty,setDirty]=useState(false);
  const busy=useRef(false),loadId=useRef(0);
  const [backupReady,setBackupReady]=useState(false),[replacement,setReplacement]=useState(null);
  async function load(edition){
    const id=++loadId.current;setPending(true);setError('');
    try{const res=await fetch(api+(edition?`?edition=${edition}`:''),{cache:'no-store'});const json=await res.json();if(!res.ok)throw Error(json.error);
      if(id!==loadId.current)return;
      setData(json);setBook(json.draft?.manuscript||json.base);setDirty(false);setBackupReady(false);setReplacement(null);setGroup('lesson:0');
    }catch(e){if(id===loadId.current)setError(e.message)}finally{if(id===loadId.current)setPending(false)}
  }
  function startCandidate(){
    if(dirty||(data.draft&&!backupReady))return;
    setBook(structuredClone(data.base));setDirty(true);setReplacement(data.draft?.content_hash||null);
    setMessage('검수 원고를 편집창에 불러왔어요. 초안 저장을 누르기 전까지 저장된 초안은 그대로입니다.');
  }
  useEffect(()=>{load()},[]);
  useEffect(()=>{if(!dirty)return;const guard=e=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard)},[dirty]);
  const section=useMemo(()=>{if(!book)return null;if(group.startsWith('lesson:')){const n=Number(group.split(':')[1]);return {value:book.lessons[n],path:['lessons',n]}}return {value:book[group],path:[group]}},[book,group]);
  const fields=useMemo(()=>section?editableFields(section.value,section.path).filter(f=>!search||f.value.includes(search)||label(f.path).includes(search)):[],[section,search]);
  async function act(action,editionId=data?.candidate.editionId){if(busy.current)return;busy.current=true;setPending(true);setError('');setMessage('');try{
    const body={action,editionId,...(action==='save'?{manuscript:book,...(replacement?{replaceDraftHash:replacement}:{})}:{}),expectedDraftVersion:data.draft?.version??null,expectedReleaseVersion:data.release?.version??null};
    const res=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await res.json();if(!res.ok)throw Error(result.error);
    if(action==='save'){setData(d=>({...d,draft:result.draft}));setDirty(false);setReplacement(null);setBackupReady(false);setMessage('비공개 초안을 저장했어요. 공개 교재는 발행할 때 바뀝니다.')}else{setMessage(action==='restore'?'선택한 판본으로 돌아갔어요.':'검수한 판본을 발행했어요.');await load(data.candidate.editionId)}
  }catch(e){setError(e.message)}finally{busy.current=false;setPending(false)}}
  async function importFile(file){if(!file)return;try{if(file.size>8*1024*1024)throw Error('원고는 8MB 이내로 불러와 주세요.');const value=JSON.parse(await file.text());const invalid=validateManuscript(value,data.base);if(invalid)throw Error(invalid);setBook(value);setDirty(true);setMessage('원고를 불러왔어요. 저장하기 전에는 초안에 반영되지 않아요.');setError('')}catch(e){setError(e.message)}}
  const compatible=!!data&&!validateManuscript(book,data.base);
  const differentDraft=!!data?.draft&&data.draft.content_hash!==data.candidate.contentHash;
  const ready=!!data&&!dirty&&(!data.draft||data.draft.content_hash===data.candidate.contentHash);
  return <div className="book-editor"><header className="book-toolbar"><div><Link href="/admin/textbooks?lang=Japanese">교재 관리자</Link><h1>일본어 N5 · 한 권 편집</h1><p>과별 내용과 번역을 편집하고, 검수한 교재를 한 판본으로 발행해요.</p></div>{data&&<Link className="btn btn--ghost" target="_blank" href={bookHref(data.candidate.editionId)}>검수용 교재 열기</Link>}</header>
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    {!data?<><p>편집 저장소를 불러오는 중입니다. 연결 설정이 끝나야 초안을 저장할 수 있어요.</p><button className="btn btn--ghost" type="button" onClick={()=>load()}>다시 불러오기</button></>:<>
      <div className="book-editor__state"><strong>{dirty?'저장하지 않은 변경이 있어요.':data.draft?'비공개 초안이 저장되어 있어요.':'검수한 원고에서 시작해요.'}</strong><p>{data.candidate.pdfEnabled===false?'42과 · 웹 교재':`${data.candidate.pages}쪽`} · {ready?'현재 원고와 검수용 출력본이 일치해요.':'초안을 저장하고 교재를 다시 제작·검수하면 발행할 수 있어요.'}</p><p>미리보기는 마지막으로 검수한 출력본입니다. 수정한 초안은 원고 파일로 내보내 제작 과정에 전달해 주세요.</p></div>
      <section className="book-editor__candidate" aria-label="검수 후보 선택">
        <label>검수할 판본<select value={data.candidate.editionId} disabled={pending||dirty} onChange={e=>load(e.target.value)}>{data.candidates.map((item,i)=><option key={item.editionId} value={item.editionId}>{i===0?'최신 검수 후보':'이전 판본'} · {item.editionId.slice(0,8)} · {item.pages}쪽{data.release?.edition_id===item.editionId?' · 현재 공개 중':''}</option>)}</select></label>
        <p>현재 공개 중: {data.release?.edition_id?.slice(0,8)||'아직 없음'}. 후보 선택만으로 공개 교재나 저장된 초안은 바뀌지 않아요.</p>
        {dirty&&<p>입력 중인 내용을 저장하거나 내려받은 뒤, 최신 초안 불러오기로 편집을 마쳐야 다른 후보를 선택할 수 있어요.</p>}
        {differentDraft&&<div className="book-editor__state"><strong>저장된 초안과 이 후보의 내용이 달라요.</strong><p>{compatible?'저장된 초안을 계속 편집할 수 있어요. 후보 원고로 바꾸려면 먼저 초안을 내려받아 보관해 주세요.':'과·문항 구조가 달라 기존 초안을 이 후보로 바로 저장할 수 없어요. 초안은 유지되며, 이전 판본을 선택해 계속 편집할 수 있어요.'}</p><div className="book-editor__actions"><button type="button" className="btn btn--ghost" disabled={pending} onClick={()=>{download(data.draft.manuscript,`japanese-n5-draft-v${data.draft.version}.json`);setBackupReady(true)}}>저장된 초안 내려받기</button><button type="button" className="btn btn--ghost" disabled={pending||dirty||!backupReady} onClick={startCandidate}>검수 원고로 편집 시작</button></div></div>}
      </section>
      <div className="book-editor__tools"><label>편집할 부분<select value={group} disabled={pending} onChange={e=>{setGroup(e.target.value);setLimit(80)}}>{book.lessons.map((l,i)=><option key={l.id} value={`lesson:${i}`}>{String(l.number).padStart(2,'0')}과 · {l.title}</option>)}{[['title','책 제목'],['review','표지·책 소개'],['frontMatter','책 사용법·문자 준비'],['cultures','문화 읽기'],['lexicon','단어 노트'],['grammarIndex','문형 다시 꺼내기'],['kanjiIndex','한자 읽기'],['referenceIntro','부록 안내'],['colophon','판권·출처']].map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>내용 찾기<input value={search} onChange={e=>{setSearch(e.target.value);setLimit(80)}} placeholder="일본어·한국어 검색" /></label></div>
      <div className="book-editor__actions"><button className="btn btn--primary" type="button" disabled={pending||!dirty||!compatible} onClick={()=>act('save')}>{pending?'처리 중…':'초안 저장'}</button><button className="btn btn--ghost" type="button" onClick={()=>download(book)}>원고 내려받기</button><label className="btn btn--ghost">원고 불러오기<input type="file" accept="application/json,.json" hidden disabled={pending} onChange={e=>{importFile(e.target.files?.[0]);e.target.value=''}} /></label><button className="btn btn--ghost" type="button" disabled={pending} onClick={()=>{if(!dirty||window.confirm('저장하지 않은 변경을 내려받았나요? 최신 초안으로 화면을 바꿉니다.'))load(data.candidate.editionId)}}>최신 초안 불러오기</button></div>
      <div className="book-editor__fields">{fields.slice(0,limit).map(f=><label className="book-editor__field" key={JSON.stringify(f.path)}><span>{label(f.path.slice(section.path.length))||'책 제목'}</span><textarea value={f.value} disabled={pending} maxLength={12000} rows={f.value.length>180?6:3} onChange={e=>{setBook(withField(book,f.path,e.target.value));setDirty(true)}} /></label>)}</div>
      {fields.length>limit&&<button className="btn btn--ghost" type="button" onClick={()=>setLimit(n=>n+80)}>다음 편집 항목 보기 ({limit}/{fields.length})</button>}
      <section className="book-editor__history"><h2>발행</h2><p>발행하면 모든 독자가 이 판본을 보게 됩니다. 이전 판본의 복습 출처는 계속 열 수 있어요.</p><button className="btn btn--primary" type="button" disabled={pending||!ready||data.release?.edition_id===data.candidate.editionId} onClick={()=>act('publish')}>검수한 판본 발행</button><h3>발행 기록</h3><ul>{data.history.map(h=><li key={h.edition_id}><Link href={bookHref(h.edition_id)} target="_blank">{new Date(h.published_at).toLocaleString('ko-KR')} 판본</Link>{h.edition_id===data.release?.edition_id?<strong>현재 공개 중</strong>:<button className="btn btn--ghost btn--sm" disabled={pending} type="button" onClick={()=>act('restore',h.edition_id)}>이 판본으로 복원</button>}</li>)}</ul>{!data.history.length&&<p>아직 발행한 판본이 없어요.</p>}</section>
    </>}
  </div>;
}
