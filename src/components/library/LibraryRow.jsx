'use client';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/lib/supabase';
import LibraryReaderLink from '@/components/web/LibraryReaderLink';
import {langNameKo} from '@/lib/constants';
import {libraryItemHref,libraryKey} from '@/lib/personalLibrary';
const marks={Japanese:'あ',Chinese:'你',English:'Aa',French:'é'};
export function LibraryCover({row}){
 const asset=row.assets?.find(item=>item.hash===row.context?.assetHash)||row.assets?.[0];
 return <span className="shelf-cover" data-language={row.language||'unknown'} aria-hidden="true"><small>{row.target_kind==='edition'?'N5':row.target_kind==='book'?'BOOK':row.target_kind==='pdf'?'PDF':asset?.kind?.toUpperCase()||'NOTE'}</small><b>{marks[row.language]||'m.'}</b><i/></span>;
}
export default function LibraryRow({row,ownerId,onMenu}){
 const [expanded,setExpanded]=useState(false),[count,setCount]=useState(20);
 const children=useQuery({queryKey:['library-children',ownerId,libraryKey(row),count],enabled:expanded,
  queryFn:async()=>{const pages=[];for(let offset=0;offset<count;offset+=20){const {data,error}=await supabase.rpc('personal_library_children',{p_kind:row.target_kind,p_id:row.target_id,p_offset:offset});if(error)throw error;pages.push(...data.items);if(pages.length>=data.total)return {items:pages,total:data.total};}return {items:pages,total:row.child_count};}});
 const meta=[row.language?langNameKo(row.language):'언어 미지정',row.assets?.length?`첨부 ${row.assets.length}개`:null,row.link_count?`링크 ${row.link_count}개`:null,row.target_kind==='book'?`${row.child_count}편`:null,!row.owned&&row.target_kind==='material'?'공개 글':null];
 return <li className="shelf-row" data-library-key={libraryKey(row)}><div className="shelf-row-main"><LibraryReaderLink className="shelf-row-link" href={libraryItemHref(row)}><LibraryCover row={row}/><div className="shelf-row-copy"><h3>{row.title||'제목 없는 자료'}</h3>{row.excerpt&&<p>{row.excerpt}</p>}<small>{meta.filter(Boolean).join(' · ')}{row.completed?' · 읽기 완료':''}</small>{row.failed&&<span className="shelf-row-failure">처리를 마치지 못했어요 · 자료에서 다시 시도</span>}</div></LibraryReaderLink><button className="shelf-row-menu" aria-label={`${row.title} 더보기`} onClick={()=>onMenu(row)}>···</button></div>
  {row.match_child&&row.target_kind!=='material'&&<LibraryReaderLink className="shelf-child-match" href={`/viewer/${row.match_child.id}`}>포함된 글: {row.match_child.title} ↗</LibraryReaderLink>}
  {(row.target_kind==='book'||row.target_kind==='pdf')&&row.child_count>0&&<div className="shelf-children"><button aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'목차 접기':'담긴 글 보기'} · {row.child_count}편 <span aria-hidden="true">{expanded?'−':'+'}</span></button>{expanded&&<>
   {children.isPending&&<p role="status">목차를 불러오고 있어요…</p>}{children.isError&&<p role="alert">목차를 불러오지 못했어요. <button onClick={()=>children.refetch()}>다시 시도</button></p>}
   {children.data&&<ol>{children.data.items.map(c=><li key={c.id}><LibraryReaderLink href={`/viewer/${c.id}`}>{c.title}<span aria-hidden="true">↗</span></LibraryReaderLink></li>)}</ol>}
   {children.data&&children.data.items.length<children.data.total&&<button onClick={()=>setCount(count+20)}>목차 더 보기</button>}
  </>}</div>}
 </li>;
}
