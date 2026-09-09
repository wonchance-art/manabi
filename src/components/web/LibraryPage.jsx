'use client';
import Link from 'next/link';
import {useEffect} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {useAuth} from '@/lib/AuthContext';
import MaterialsPage from '@/views/MaterialsPage';
import LibraryShelf from '@/components/library/LibraryShelf';
import '@/components/library/library.css';
export default function LibraryPage(){
 const params=useSearchParams(),router=useRouter();
 const publicView=params.get('tab')==='public';
 useEffect(()=>{if(publicView){const query=new URLSearchParams(params.toString());query.delete('tab');query.set('view','reading');router.replace(`/discover?${query}`);}},[publicView,params,router]);
  const restoreY = params.get('restoreY');
  useEffect(() => {
    const y = Number(restoreY);
    if (restoreY === null || !Number.isFinite(y) || y < 0 || y > 1000000) return;
    let frame, done = false;
    const started = performance.now();
    const stop = () => { done = true; cancelAnimationFrame(frame); };
    const restore = () => {
      if (done) return;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      if (height >= y || performance.now() - started > 10000) {
        window.scrollTo({ top: Math.min(y, height), behavior: 'instant' });
        const url = new URL(window.location.href); url.searchParams.delete('restoreY');
        window.history.replaceState({ ...window.history.state }, '', url.pathname + url.search);
        stop();
      } else frame = requestAnimationFrame(restore);
    };
    frame = requestAnimationFrame(restore);
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('keydown', stop);
    return () => { stop(); window.removeEventListener('wheel', stop); window.removeEventListener('touchstart', stop); window.removeEventListener('keydown', stop); };
  }, [restoreY]);
 const {user,loading}=useAuth();
 if(publicView)return <p className="manabi-page" role="status">공개 읽을거리로 이동하고 있어요…</p>;
 if(params.get('tools')==='1'||params.get('sort')==='fit')return <div className="manabi-page"><Link className="manabi-link" href="/materials">← 내 서재</Link><MaterialsPage libraryView="allOwned"/></div>;
 return <div className="manabi-page library-room">{loading?<p role="status">서재를 열고 있어요…</p>:user?<LibraryShelf key={user.id} user={user}/>:<section className="shelf-guest"><h1>내 서재<span>.</span></h1><h2>읽고 싶은 것들을 한곳에.</h2><p>글과 파일, 링크를 담아 두고 읽던 곳에서 이어가세요.</p><Link className="manabi-button" href="/auth?from=/materials">로그인하고 서재 열기 ↗</Link><Link className="manabi-link" href="/discover">읽을거리 둘러보기 ↗</Link></section>}</div>;
}
