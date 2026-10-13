'use client';
// 서재 「대화」 묶음(v2-Z Z-R1 ③). 대화는 한 턴마다 문단이 붙는 내 비공개 자료다 — 서재 목록에 그대로 두되
// (휴지통·폴더·즐겨찾기가 지금처럼 동작), 여기 따로 모아 「대화로」 바로 돌아가게 한다.
import {useState} from 'react';
import {langNameKo} from '@/lib/constants';
import {CONVERSATION_SHELF_PREVIEW,conversationHref,conversationShelfMeta} from '@/lib/conversation/conversationLibrary';
import LibraryReaderLink from '@/components/web/LibraryReaderLink';
import {LibraryCover} from './LibraryRow';

export default function ConversationShelf({query}){
 const [more,setMore]=useState(false);
 const rows=query.data||[];
 if(!rows.length)return null;
 const shown=more?rows:rows.slice(0,CONVERSATION_SHELF_PREVIEW);
 return <section className="shelf-conversations" aria-labelledby="shelf-conversations-title">
  <div className="shelf-section-heading"><h2 id="shelf-conversations-title">대화 <span className="shelf-count">{rows.length}</span></h2>{rows.length>CONVERSATION_SHELF_PREVIEW&&<button className="shelf-conversations-toggle" aria-expanded={more} onClick={()=>setMore(!more)}>{more?'접기':'대화 모두 보기'}</button>}</div>
  <ul className="shelf-rows">{shown.map(row=><li key={row.id} className="shelf-row"><div className="shelf-row-main"><LibraryReaderLink className="shelf-row-link" href={conversationHref(row.id)}><LibraryCover row={{language:row.language,conversation:true}}/><div className="shelf-row-copy"><h3>{row.title}</h3><small>{conversationShelfMeta(row,{languageName:langNameKo})}</small></div></LibraryReaderLink></div></li>)}</ul>
 </section>;
}
