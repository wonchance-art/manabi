'use client';
// `/class`의 학생 · 손님 화면 — 팀 목록 없이 받은 링크 · 최근 수업으로 들어간다. 오너 허브(ClassHubPage)와 경로 진입(ClassHub)이 함께 쓴다.
import { ClassroomShell, ClassroomLearnerHeader } from './ClassroomUI';
import ClassroomJoin from './ClassroomJoin';

export default function ClassHubLearner() {
  return <ClassroomShell><ClassroomLearnerHeader/><ClassroomJoin/></ClassroomShell>;
}
