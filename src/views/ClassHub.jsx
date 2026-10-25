'use client';

/**
 * `/class` 진입 — 학생 · 손님은 참여 화면(ClassHubLearner)만 받는다. 수업 만들기 · 공유 암호 · 팀 목록(ClassHubPage)은
 * 오너 전용이라 따로 묶어 관리자에게만 받는다(PERF P7 2026-10-26 KST). 그 묶음을 받는 동안은 로그인 확인 때와 같은
 * 「수업을 불러오고 있어요.」 화면을 그대로 이어 보여 준다 — 새 자리 표시 · 화면 밀림 없음.
 */
import dynamic from 'next/dynamic';
import { useAuth } from '../lib/AuthContext';
import { ClassroomState } from '../components/classroom/ClassroomUI';
import ClassHubLearner from '../components/classroom/ClassHubLearner';

const Loading = () => <ClassroomState title="수업을 불러오고 있어요."/>;
const ClassHubPage = dynamic(() => import('./ClassHubPage'), { loading: Loading });

export default function ClassHub() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <Loading/>;
  if (!isAdmin) return <ClassHubLearner/>;
  return <ClassHubPage/>;
}
