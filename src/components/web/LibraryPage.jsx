'use client';
import Link from 'next/link';
import {useEffect} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {useAuth} from '@/lib/AuthContext';
import LazyMaterialsPage from '@/components/web/LazyMaterialsPage';
import LibraryShelf from '@/components/library/LibraryShelf';
import {useRestoreScroll} from '@/lib/useRestoreScroll';
import {LibraryShelfSkeleton} from '@/components/library/LibrarySkeleton';
import '@/components/library/library.css';
// serverUserId = 서버가 쿠키 세션으로 확인하고 첫 화면 쿼리를 미리 받아 둔 계정(LIBRARY-PREFETCH-001, materials/page.jsx).
// 있으면 로그인 확인을 기다리지 않고 그 계정의 서재를 바로 그린다 — 서버 HTML과 브라우저 첫 그림이 같은 트리(#418 없음).
// 확인 결과가 같은 계정이면 key가 같아 그대로 이어지고, 다른 계정 · 로그아웃이면 그 결과를 따른다.
// sessionHint === false = 서버가 본 세션 쿠키가 없다 — 로그인 확인을 기다리지 않고 손님 서재(골격 없음, 배움 B1과 같은 판정).
// 서재 도구(?tools=1 · ?sort=fit)에도 같은 힌트를 넘긴다 — 로그인 고르기 줄 · 확인 중 골격을 서버부터(DISCOVER-CHIP-CLS-001 후속).
export default function LibraryPage({serverUserId=null,sessionHint}){
 const params=useSearchParams(),router=useRouter();
 const publicView=params.get('tab')==='public';
 useEffect(()=>{if(publicView){const query=new URLSearchParams(params.toString());query.delete('tab');query.set('view','reading');router.replace(`/discover?${query}`);}},[publicView,params,router]);
 useRestoreScroll(params.get('restoreY'));
 const {user,loading}=useAuth();
 const shelfUser=user||(loading&&serverUserId?{id:serverUserId}:null);
 if(publicView)return <p className="manabi-page" role="status">공개 읽을거리로 이동하고 있어요…</p>;
 if(params.get('tools')==='1'||params.get('sort')==='fit')return <div className="manabi-page"><Link className="manabi-link" href="/materials">← 내 서재</Link><LazyMaterialsPage libraryView="allOwned" sessionHint={sessionHint===true}/></div>;
 return <div className="manabi-page library-room">{loading&&!shelfUser&&sessionHint!==false?<LibraryShelfSkeleton/>:shelfUser?<LibraryShelf key={shelfUser.id} user={shelfUser} ssr={!!serverUserId}/>:<section className="shelf-guest"><h1>내 서재</h1><p>글·파일·링크를 계정에 보관하고 이어 읽으세요.</p><Link className="manabi-button" href="/auth?from=/materials">로그인</Link><Link className="manabi-link" href="/discover">서가에서 읽어 보기</Link></section>}</div>;
}
