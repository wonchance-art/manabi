'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { recentClassVisits,forgetClassVisit } from '../../lib/classClient';
import { classLinkPath } from '../../lib/classroomModel';
export default function ClassroomJoin(){
  const router=useRouter();const [link,setLink]=useState(''),[error,setError]=useState(''),[recent,setRecent]=useState([]);
  useEffect(()=>{setRecent(recentClassVisits());},[]);
  function open(event){event.preventDefault();const path=classLinkPath(link,window.location.origin);if(!path){setError('선생님께 받은 이 사이트의 수업 링크 또는 수업 주소를 입력해 주세요.');return;}router.push(path);}
  return <section className="classroom-join"><form onSubmit={open}><label htmlFor="class-link">선생님께 받은 수업 링크</label><div className="classroom-actions"><input id="class-link" value={link} onChange={e=>{setLink(e.target.value);setError('');}} placeholder="수업 링크 붙여 넣기" autoComplete="off"/><button className="classroom-button" disabled={!link.trim()}>열기 →</button></div>{error&&<p role="alert">{error}</p>}<p>계정 없이도 링크와 수업 암호로 읽을 수 있어요.</p></form>
  {recent.length>0&&<div className="classroom-note-list"><span className="classroom-eyebrow">이 기기에서 열었던 수업</span>{recent.map(t=><div key={t.key} className="classroom-note-row"><Link href={`/class/${t.key}`} style={{flex:1,color:'var(--text-primary)'}}>{t.name}</Link><button className="classroom-text-button" aria-label={`${t.name} 방문 기록 지우기`} onClick={()=>{forgetClassVisit(t.key);setRecent(recentClassVisits());}}>기록 지우기</button></div>)}<p>다시 열 때 수업 접근 권한을 확인합니다.</p></div>}</section>;
}
