'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useParams,useRouter,useSearchParams} from 'next/navigation';
import {useQuery} from '@tanstack/react-query';
import {useAuth} from '../lib/AuthContext';
import {getTeam} from '../lib/classBoard';
import {fetchTeamRoot,fetchBookChapters} from '../lib/classTeamQueries';
import {canTeachClass,classDay,startingChapter,classWorkspaceHref} from '../lib/classWorkspace';
import {textbookThemeStyle} from '../lib/textbookTheme';
import {ClassroomState} from '../components/classroom/ClassroomUI';
import ClassroomReader from '../components/classroom/ClassroomReader';
import '../components/viewer/reader-controls.css';

export default function ClassLivePage() {
  const {team:key}=useParams(),params=useSearchParams(),{user,loading}=useAuth();
  const [day]=useState(()=>classDay(params.get('day')));
  const root=useQuery({queryKey:['class-root',user?.id,key],queryFn:()=>fetchTeamRoot(user.id,key),enabled:!!user?.id&&!!key});
  if(loading||root.isLoading)return <ClassroomState title="수업을 불러오고 있어요."/>;
  if(root.error)return <ClassroomState title="수업을 불러오지 못했어요." retry={root.refetch}/>;
  if(!user)return <ClassroomState title="선생님 계정으로 수업을 열어 주세요."><Link className="classroom-button" href={`/auth?from=${encodeURIComponent(`/class/${key}/live?day=${day}`)}`}>로그인</Link></ClassroomState>;
  if(!canTeachClass(user,root.data))return <ClassroomState title="이 수업의 선생님만 진행할 수 있어요."><Link className="classroom-button" href={`/class/${key}`}>수업 페이지</Link></ClassroomState>;
  return <ClassroomLaunch key={`${user.id}:${key}:${day}`} root={root.data} user={user} day={day}/>;
}
function ClassroomLaunch({root,user,day}) {
  const team=getTeam(root.processed_json.metadata),router=useRouter(),toolbar=useRef(null);
  const [active,setActive]=useState(false);
  const chapters=useQuery({queryKey:['class-book-chapters',user.id,team.bookKey],queryFn:()=>fetchBookChapters(team.bookKey),enabled:!!team.bookKey});
  const first=startingChapter(team,chapters.data||[]);
  useEffect(()=>{if(first)router.replace(classWorkspaceHref(first.id,team.key,day));},[first,team.key,day,router]);
  if(team.bookKey&&(chapters.isLoading||first))return <ClassroomState title="교재를 펼치고 있어요."/>;
  if(chapters.error)return <ClassroomState title="교재를 불러오지 못했어요." retry={chapters.refetch}/>;
  return <div className="viewer-layout classroom-launcher" data-class-study={active} data-language={team.lang} style={textbookThemeStyle(team.lang)}><main className="viewer-center"><div ref={toolbar} className="class-workspace-topbar"/><section className="classroom-empty"><h1>{team.name}</h1><p>단어·표현을 찾아 크게 보여주고, 오늘 배운 내용으로 남기세요.</p><Link href={`/class/${team.key}`}>팀 홈에서 교재 연결</Link></section></main><ClassroomReader toolbarTarget={toolbar} context={{team:team.key,day}} user={user} material={root} selection={null} fallback={null} onActive={setActive}/></div>;
}
