'use client';
import {useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/lib/supabase';
import {chapterCaption,fetchBookChapterPage} from '@/lib/libraryBookChapters';
import {invalidateLibrary} from '@/lib/libraryOperations';
import LibraryReaderLink from '@/components/web/LibraryReaderLink';
import LibraryChapterEditor from './LibraryChapterEditor';

export default function LibraryBookChapters({row,ownerId,disabled=false}) {
 const cache=useQueryClient();
 const addButton=useRef(null),chapterButtons=useRef(new Map());
 const [expanded,setExpanded]=useState(false),[count,setCount]=useState(20),[editor,setEditor]=useState(null),[menu,setMenu]=useState(null),[reveal,setReveal]=useState(null);
 const query=useQuery({queryKey:['library-book-chapters',ownerId,row.target_id,count,reveal],enabled:expanded,
  queryFn:()=>fetchBookChapterPage(supabase,row.target_id,count,reveal),staleTime:0});
 async function saved(id){
  setEditor(null);setMenu(null);setReveal(id);setExpanded(true);
  await Promise.all([invalidateLibrary(cache,ownerId),cache.invalidateQueries({queryKey:['library-book-chapters',ownerId,row.target_id]}),cache.invalidateQueries({queryKey:['book-chapters',row.target_id]}),cache.invalidateQueries({queryKey:['material']})]);
  requestAnimationFrame(()=>addButton.current?.focus({preventScroll:true}));
 }
 function closeEditor(){const opener=editor==='add'?addButton.current:chapterButtons.current.get(editor?.id);setEditor(null);requestAnimationFrame(()=>opener?.focus({preventScroll:true}));}
 return <div className="shelf-children shelf-book-chapters">
  <div className="shelf-chapter-heading"><button aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'목차 접기':'담긴 글 보기'} · {query.data?.total??row.child_count}편 <span aria-hidden="true">{expanded?'−':'+'}</span></button>{expanded&&query.isSuccess&&<button ref={addButton} disabled={disabled} onClick={()=>setEditor('add')}>+ 과 추가</button>}</div>
  {expanded&&<>
   {query.isPending&&<p role="status">목차를 불러오는 중…</p>}{query.isError&&<p role="alert">목차를 불러오지 못했어요. <button onClick={()=>query.refetch()}>다시 시도</button></p>}
   {query.data&&<ol>{query.data.items.map(chapter=><li key={chapter.id} className={reveal===chapter.id?'is-added':undefined}>
    <LibraryReaderLink href={`/viewer/${chapter.id}`}><span className="shelf-chapter-order">{chapter.order==null?'—':`${chapter.order}과`}</span><span className="shelf-chapter-title">{chapterCaption(chapter,query.data.title)}</span><span aria-hidden="true">↗</span></LibraryReaderLink>
    {chapter.order!=null&&<button ref={node=>{if(node)chapterButtons.current.set(chapter.id,node);else chapterButtons.current.delete(chapter.id);}} className="shelf-chapter-menu" aria-label={`${chapter.order}과 더보기`} disabled={disabled} aria-expanded={menu===chapter.id} onClick={()=>setMenu(menu===chapter.id?null:chapter.id)}>···</button>}
    {menu===chapter.id&&<div className="shelf-chapter-options"><button onClick={()=>{setEditor(chapter);setMenu(null);}}>과 번호 수정</button></div>}
   </li>)}</ol>}
   {query.data&&query.data.items.length<query.data.total&&<button disabled={query.isFetching} onClick={()=>setCount(query.data.items.length+20)}>목차 더 보기</button>}
   {reveal&&<span role="status" className="shelf-sr">목차에 반영했어요.</span>}
  </>}
  {editor&&<LibraryChapterEditor ownerId={ownerId} bookKey={row.target_id} title={row.title} nextOrder={query.data?.nextOrder||1} chapter={editor==='add'?null:editor} onClose={closeEditor} onSaved={saved}/>}
 </div>;
}
