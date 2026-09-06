'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { bookResume } from '@/lib/webNavigation';
import { bookHref } from '@/lib/textbook/contract';
import { langNameKo } from '@/lib/constants';
import { libraryView, readingLibraryRows } from '@/lib/libraryDiscovery';
import useReadingProgress from '@/components/books/useReadingProgress';
import MaterialsPage from '@/views/MaterialsPage';
import './library-discovery.css';

function QueryState({ query, label }) {
  if (query.isPending) return <p className="library-query-state" role="status">{label} 확인 중…</p>;
  if (query.isError) return <div className="library-query-state" role="alert">{label}를 불러오지 못했어요. <button type="button" onClick={() => query.refetch()}>다시 불러오기</button></div>;
  return null;
}

function ReadingShelf({ book, user }) {
  const local = useReadingProgress(book?.edition);
  const resume = bookResume(book, local.progress, local.hasProgress);
  const reading = useQuery({
    queryKey: ['library-reading-v2', user?.id], enabled: !!user, staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('reading_progress')
        .select('material_id, last_token_idx, is_completed, updated_at, reading_materials(id, title, visibility, metadata:processed_json->metadata, status:processed_json->>status)')
        .eq('user_id', user.id).eq('is_completed', false).gt('last_token_idx', 0)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return readingLibraryRows(data || []);
    },
  });
  const pdfs = useQuery({
    queryKey: ['my-pdfs', user?.id], enabled: !!user, staleTime: 60000, refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase.from('uploaded_pdfs')
        .select('id, title, page_count, created_at, thumbnail_path, last_page_read')
        .eq('owner_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const openPdfs = (pdfs.data || []).filter(pdf => pdf.last_page_read > 0);
  return <div className="library-reading">
    <section className="library-book-mark" aria-label="교재 읽던 위치">
      <span className="library-book-mark__glyph" lang="ja" aria-hidden="true">読</span>
      <div><p className="manabi-eyebrow">ON YOUR DESK / 교재</p>
        <h2>{!book ? '교재 정보를 불러오지 못했어요.' : !local.ready ? '읽던 과를 확인하고 있어요…' : resume?.started ? `${String(resume.lesson.number).padStart(2, '0')}과 · ${resume.lesson.title}` : '첫 문장에서 시작하는 일본어.'}</h2>
        <p>{local.ready && resume?.started ? `일본어 N5 · ${resume.completed} / ${resume.total}과 학습 · 이 브라우저의 기록` : '교재와 내가 가져온 글, 각자의 읽던 자리에서 이어가요.'}</p>
        {!local.storageAvailable && <p role="status">이 브라우저에서는 교재 위치를 저장할 수 없어요.</p>}
      </div>
      <Link className="manabi-link" href={local.ready && resume?.started ? bookHref(book.edition, resume.page) : '/lessons'}>{local.ready && resume?.started ? '교재 이어 읽기 ↗' : '교재 책장 ↗'}</Link>
    </section>
    <div className="library-section-title"><div><p className="manabi-eyebrow">PAGES IN PROGRESS</p><h2>펼쳐 둔 페이지</h2></div><Link className="manabi-link" href="/materials?view=owned">내 자료 전체 ↗</Link></div>
    {!user ? <div className="library-empty"><h3>읽던 곳을 서재에 남겨요.</h3><p>로그인하면 가져온 글과 PDF를 이어 읽을 수 있어요.</p><Link className="manabi-button" href="/auth">로그인하기 ↗</Link><Link className="manabi-link" href="/discover">새로운 읽을거리 찾기 ↗</Link></div> : <>
      <QueryState query={reading} label="글의 읽던 위치" />
      {!reading.isError && (reading.data || []).map(row => {
        const material = row.reading_materials;
        return <Link key={material.id} className="library-reading-row" href={`/viewer/${material.id}`}>
          <span className="library-format">TEXT</span><div><small>{[material.metadata?.language ? langNameKo(material.metadata.language) : '언어 미지정', material.visibility === 'public' ? '공개 자료' : '비공개'].filter(Boolean).join(' · ')}</small><h3>{material.title || '제목 없는 자료'}</h3><p>저장된 문장 위치에서 이어 읽기</p></div><span aria-hidden="true">↗</span>
        </Link>;
      })}
      <QueryState query={pdfs} label="PDF의 읽던 위치" />
      {!pdfs.isError && openPdfs.map(pdf => <Link key={pdf.id} className="library-reading-row" href={`/pdf/${pdf.id}?page=${pdf.last_page_read}`}><span className="library-format library-format--pdf">PDF</span><div><small>내 PDF · 비공개</small><h3>{pdf.title || '제목 없는 PDF'}</h3><p>{pdf.last_page_read} / {pdf.page_count}쪽 · 저장된 읽기 위치</p></div><span aria-hidden="true">↗</span></Link>)}
      {reading.isSuccess && pdfs.isSuccess && !reading.data.length && !openPdfs.length && <div className="library-empty"><h3>다음으로 읽을 글을 골라 보세요.</h3><p>읽던 글과 PDF가 여기에 모입니다. 다 읽은 자료는 ‘내 자료’에서 다시 열 수 있어요.</p><Link className="manabi-link" href="/materials?view=owned">내 자료에서 고르기 ↗</Link><Link className="manabi-link" href="/discover">발견 둘러보기 ↗</Link></div>}
    </>}
    <div className="library-footer-links"><Link href="/study/library">지난 학습 문단 ↗</Link><Link href="/vocab">담은 표현 복습 ↗</Link><span>받아두기는 이 기기의 오프라인 보관입니다.</span></div>
  </div>;
}

export default function LibraryPage({ book }) {
  const params = useSearchParams();
  const view = libraryView(params);
  const { user, loading } = useAuth();
  return <div className="manabi-page library-room">
    <header className="manabi-page-heading"><div><p className="manabi-eyebrow">YOUR READING ROOM / 내 서재</p><h1>{view === 'public' ? '함께 읽는 글' : '내가 펼친 세계'}<span>.</span></h1></div><div className="library-header-actions"><Link className="manabi-link" href="/quick">빠른 분석 ↗</Link><Link className="manabi-button" href="/materials/add">자료 가져오기 +</Link></div></header>
    <nav className="library-view-tabs" aria-label="서재 분류">{[['reading', '읽는 중', '/materials'], ['owned', '내 자료', '/materials?view=owned'], ['notes', '내 노트', '/materials?view=notes'], ['public', '공개 읽을거리', '/materials?tab=public']].map(([id, label, href]) => <Link key={id} href={href} aria-current={view === id ? 'page' : undefined} scroll={false}>{label}</Link>)}</nav>
    {loading ? <p className="library-query-state" role="status">서재를 열고 있어요…</p> : view === 'reading' ? <ReadingShelf key={user?.id || 'guest'} book={book} user={user} /> : <MaterialsPage key={`${user?.id || 'guest'}:${view}`} libraryView={view} />}
  </div>;
}
