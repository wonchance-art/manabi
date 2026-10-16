'use client';
// 서재 「대화」 묶음(v2-Z Z-R1 ③). 대화는 한 턴마다 문단이 붙는 내 비공개 자료다 — 서재 목록에 그대로 두되
// (휴지통·폴더·즐겨찾기가 지금처럼 동작), 여기 따로 모아 「대화로」 바로 돌아가게 한다.
import Link from 'next/link';
import {useState} from 'react';
import {langNameKo} from '@/lib/constants';
import {CONVERSATION_SHELF_PREVIEW,conversationHref,conversationShelfMeta} from '@/lib/conversation/conversationLibrary';
import {useHeightSettle} from '@/lib/useHeightSettle';
import LibraryReaderLink from '@/components/web/LibraryReaderLink';
import {LibraryCover} from './LibraryRow';
import {ConversationShelfSkeleton} from './LibrarySkeleton';

export default function ConversationShelf({query}){
 const [more,setMore]=useState(false);
 // 받는 중엔 자리를 잡아 둔다(LOADING-SKELETON-001 후속 — 골격 없이 나타나 아래 목록을 111px 밀던 자리). 받은 뒤
 // 줄 수가 자리와 다르면(없음 · 2~3개) 높이를 0.2초에 옮긴다. 자리 · 실제 묶음이 같은 ref를 쓴다.
 const settle=useHeightSettle(query.isPending?'pending':'ready');
 const rows=query.data||[];
 if(query.isPending)return <div ref={settle}><ConversationShelfSkeleton/></div>;
 // 대화가 아직 없어도 입구는 둔다(Z-R2 「새 대화」). 조회 실패면 묶음만 숨는다 — 서재 목록은 그대로.
 if(query.isError)return null;
 if(!rows.length)return <div ref={settle}><section className="shelf-conversations" aria-labelledby="shelf-conversations-title"><div className="shelf-section-heading"><h2 id="shelf-conversations-title">대화</h2><Link className="shelf-conversations-new" href="/conversation/new?returnTo=%2Fmaterials">새 대화</Link></div><p className="shelf-muted">AI 튜터와 목표어로 이야기해요. 대화는 여기 비공개로 모여요.</p></section></div>;
 const shown=more?rows:rows.slice(0,CONVERSATION_SHELF_PREVIEW);
 return <div ref={settle}><section className="shelf-conversations" aria-labelledby="shelf-conversations-title">
  <div className="shelf-section-heading"><h2 id="shelf-conversations-title">대화 <span className="shelf-count">{rows.length}</span></h2><span className="shelf-conversations-tools"><Link className="shelf-conversations-new" href="/conversation/new?returnTo=%2Fmaterials">새 대화</Link>{rows.length>CONVERSATION_SHELF_PREVIEW&&<button className="shelf-conversations-toggle" aria-expanded={more} onClick={()=>setMore(!more)}>{more?'접기':'대화 모두 보기'}</button>}</span></div>
  <ul className="shelf-rows">{shown.map(row=><li key={row.id} className="shelf-row"><div className="shelf-row-main"><LibraryReaderLink className="shelf-row-link" href={conversationHref(row.id)}><LibraryCover row={{language:row.language,conversation:true}}/><div className="shelf-row-copy"><h3>{row.title}</h3><small>{conversationShelfMeta(row,{languageName:langNameKo})}</small></div></LibraryReaderLink></div></li>)}</ul>
 </section></div>;
}
