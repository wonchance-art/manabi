'use client';
import Link from 'next/link';
import { classLanguage } from '../../lib/classroomModel';
import './classroom.css';

export function ClassroomShell({ lang='Japanese', children, board=false }) {
  return <div className={`classroom-shell${board?' classroom-shell--board':''}`} data-language={lang}><div className="classroom-page">{children}</div></div>;
}
export function ClassroomState({title,children,retry}) {
  return <ClassroomShell><section className="classroom-state"><span className="classroom-eyebrow">MANABI / CLASS</span><h1>{title}</h1>{children}{retry&&<button className="classroom-button" onClick={retry}>다시 불러오기</button>}</section></ClassroomShell>;
}
export function ClassCover({team,small=false}) {
  const lang=classLanguage(team.lang);
  return <div className={`classroom-cover${small?' classroom-cover--small':''}`} aria-hidden="true" data-language={team.lang}><span>manabi / class</span><b lang={lang.code}>{lang.glyph}</b><span>{lang.label} · {team.name}</span></div>;
}
export function ClassEntryDisplay({entry,lang,hidden=false}) {
  return <div className="classroom-expression">
    {entry ? <>
      {entry.reading&&<p className="classroom-reading" lang={classLanguage(lang).code}>{entry.reading}</p>}
      <p className="classroom-word" lang={classLanguage(lang).code}>{entry.text}</p>
      {hidden?<p className="classroom-meaning classroom-meaning--hidden">뜻을 떠올려 보세요</p>:<p className={`classroom-meaning${entry.primary?'':' classroom-meaning--empty'}`}>{entry.primary || (entry.analyzed?'대표 뜻을 직접 적어 주세요':'뜻 준비 중')}</p>}
    </>:<><p className="classroom-word">첫 표현을 기다려요.</p><p className="classroom-meaning classroom-meaning--empty">수업 진행 화면에서 입력하면 이곳에 나타납니다.</p></>}
  </div>;
}
export function ClassBack({team}) { return <Link className="classroom-back" href={team?`/class/${team}`:'/class'}>← {team?'수업 홈':'수업'}</Link>; }
