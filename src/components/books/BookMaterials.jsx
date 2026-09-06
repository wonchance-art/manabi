'use client';
import Link from 'next/link';
import { useState } from 'react';
import MaterialChapterLinks from '@/components/learning/MaterialChapterLinks';
import { bookHref } from '@/lib/textbook/contract';
import useReadingProgress from './useReadingProgress';

export default function BookMaterials({ book }) {
  const { progress } = useReadingProgress(book.edition);
  const [selected, setSelected] = useState(null);
  const unit = selected || progress.page.slice(0, 3);
  return <div className="manabi-page"><p className="manabi-breadcrumb"><Link href="/lessons">교재</Link><span>/</span><Link href={bookHref(book.edition)}>일본어 N5</Link><span>/</span>함께 읽기</p>
    <header className="manabi-page-heading"><div><p className="manabi-eyebrow">BEYOND THE BOOK</p><h1>책 밖으로 이어 읽기<span>.</span></h1></div></header><p className="manabi-muted manabi-small">짧은 문화 이야기에서 표현을 다시 만나고, 내 자료로 읽기를 이어가세요.</p>
    <div className="manabi-row"><Link className="manabi-button" href="/materials">내 자료 열기 ↗</Link><Link className="manabi-link" href={bookHref(book.edition, progress.page)}>읽던 교재로 돌아가기</Link></div>
    <div className="manabi-section-heading"><h2>일상 속 일본어</h2><span>문화 읽기</span></div><div className="manabi-culture-grid">{book.cultures.map((culture, index) => <Link className="manabi-culture-card" key={culture.id} href={bookHref(book.edition, culture.id)}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><small>CULTURE / {String(index + 1).padStart(2, '0')}</small><h2>{culture.title} ↗</h2><p>{culture.lead}</p></div></Link>)}</div>
    <section className="manabi-book-connect"><h2>이 과에 내 자료 연결하기</h2><p className="manabi-muted manabi-small">올려 둔 글이나 PDF를 과에 연결해 두면, 공부할 때 함께 꺼내 볼 수 있어요.</p><label>함께 읽을 과<select value={unit} onChange={event => setSelected(event.target.value)}>{book.lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{String(lesson.number).padStart(2, '0')}과 · {lesson.title}</option>)}</select></label><MaterialChapterLinks key={unit} lang="Japanese" slug={`n5-book-${unit}`} /></section>
  </div>;
}
