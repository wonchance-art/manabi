'use client';
import Link from 'next/link';
import {useEffect} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {useAuth} from '@/lib/AuthContext';
import LazyMaterialsPage from '@/components/web/LazyMaterialsPage';
import LibraryShelf from '@/components/library/LibraryShelf';
import {useRestoreScroll} from '@/lib/useRestoreScroll';
import '@/components/library/library.css';
export default function LibraryPage(){
 const params=useSearchParams(),router=useRouter();
 const publicView=params.get('tab')==='public';
 useEffect(()=>{if(publicView){const query=new URLSearchParams(params.toString());query.delete('tab');query.set('view','reading');router.replace(`/discover?${query}`);}},[publicView,params,router]);
 useRestoreScroll(params.get('restoreY'));
 const {user,loading}=useAuth();
 if(publicView)return <p className="manabi-page" role="status">공개 읽을거리로 이동하고 있어요…</p>;
 if(params.get('tools')==='1'||params.get('sort')==='fit')return <div className="manabi-page"><Link className="manabi-link" href="/materials">← 내 서재</Link><LazyMaterialsPage libraryView="allOwned"/></div>;
 return <div className="manabi-page library-room">{loading?<p role="status">서재를 열고 있어요…</p>:user?<LibraryShelf key={user.id} user={user}/>:<section className="shelf-guest"><h1>내 서재</h1><p>글·파일·링크를 계정에 보관하고 이어 읽으세요.</p><Link className="manabi-button" href="/auth?from=/materials">로그인</Link><Link className="manabi-link" href="/discover">서가에서 읽어 보기</Link></section>}</div>;
}
