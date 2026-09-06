'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import SaveContextButton from '@/components/learning/SaveContextButton';
import MaterialChapterLinks from '@/components/learning/MaterialChapterLinks';
import {BOOK_ID,bookHref} from '@/lib/textbook/contract';
import './books.css';

export default function BookReader({edition,title,lessons,preview=false,pdfEnabled=true}) {
  const frame=useRef(null),detach=useRef(()=>{}),lastSelection=useRef(null);
  const [unit,setUnit]=useState('u01'),[selection,setSelection]=useState(null),[meaning,setMeaning]=useState(''),[expression,setExpression]=useState('');
  const [initialPage,setInitialPage]=useState(null);
  useEffect(()=>{setInitialPage(window.location.hash||'#cover')},[]);
  useEffect(()=>{
    // Fragment-only links and browser history do not remount the reader.
    // Keep the embedded manuscript on the page named by the outer address.
    const navigate=()=>{
      const win=frame.current?.contentWindow;
      const hash=window.location.hash||'#cover';
      if(win&&win.location.hash!==hash)win.location.hash=hash;
    };
    window.addEventListener('hashchange',navigate);
    window.addEventListener('popstate',navigate);
    return()=>{window.removeEventListener('hashchange',navigate);window.removeEventListener('popstate',navigate)};
  },[edition]);
  const asset=`/api/books/${BOOK_ID}/${edition}/asset?file=`;
  const attach=useCallback(()=>{
    detach.current();
    const win=frame.current?.contentWindow,doc=win?.document;
    if(!doc?.querySelector('meta[name="manuscript-revision"]'))return;
    frame.current.dataset.bridgeReady='true';
    function sync(){const hash=win.location.hash||'#cover';const match=hash.match(/u\d{2}/);if(match)setUnit(match[0]);const href=bookHref(edition,hash.slice(1));if(window.location.pathname+window.location.search+window.location.hash!==href)window.history.replaceState(window.history.state,'',href);}
    function select(){const s=win.getSelection();if(!s?.rangeCount||s.isCollapsed)return;const range=s.getRangeAt(0),node=range.commonAncestorContainer;const el=node.nodeType===1?node:node.parentElement;const block=el?.closest('[data-book-source]');if(!block)return;
      const clone=range.cloneContents();clone.querySelectorAll('rt').forEach(n=>n.remove());const quote=clone.textContent.trim();if(!quote||quote.length>4000)return;
      const key=`${block.id}:${quote}`;if(lastSelection.current===key)return;lastSelection.current=key;
      setSelection({pageId:block.id,quote});setExpression(quote.length<=160?quote:'');setMeaning('');
    }
    win.addEventListener('hashchange',sync);doc.addEventListener('mouseup',select);doc.addEventListener('keyup',select);doc.addEventListener('touchend',select);sync();
    detach.current=()=>{win.removeEventListener('hashchange',sync);doc.removeEventListener('mouseup',select);doc.removeEventListener('keyup',select);doc.removeEventListener('touchend',select);};
  },[edition]);
  useEffect(()=>{if(initialPage)attach();return()=>detach.current()},[initialPage,attach]);
  useEffect(()=>{const ready=event=>{if(event.origin===window.location.origin&&event.source===frame.current?.contentWindow&&event.data?.type==='manabi-book-ready'&&event.data.edition===edition)attach()};window.addEventListener('message',ready);return()=>window.removeEventListener('message',ready)},[attach,edition]);
  function go(id){setUnit(id);if(frame.current?.contentWindow)frame.current.contentWindow.location.hash=id;}
  const lesson=lessons.find(l=>l.id===unit);
  return <div className="book-workspace">
    <header className="book-toolbar"><div><Link href="/lessons">교재 목록</Link><h1>{title}</h1>{preview&&<p>관리자 미리보기 · 아직 발행되지 않았어요.</p>}</div>{pdfEnabled&&<a className="btn btn--ghost btn--sm" href={`${asset}output/pdf/manabi-japanese-n5-complete.pdf`} target="_blank" rel="noreferrer">PDF 열기</a>}</header>
    <div className="book-workspace__body">{initialPage?<iframe ref={frame} className="book-reader-frame" title="일본어 N5 교재" src={`${asset}index.html${initialPage}`} onLoad={attach} />:<p role="status">교재를 불러오는 중…</p>}
      <aside className="book-companion"><h2>공부를 이어가요</h2><label>지금 공부할 과<select value={unit} onChange={e=>go(e.target.value)}>{lessons.map(l=><option key={l.id} value={l.id}>{String(l.number).padStart(2,'0')} · {l.title}</option>)}</select></label>
        <p>본문에서 기억할 표현을 선택해 보세요. 복습할 때 같은 판본의 문장으로 돌아올 수 있어요.</p>
        {selection&&<section className="book-selection"><h3>선택한 문장</h3><blockquote lang="ja">{selection.quote}</blockquote><label>기억할 표현<input lang="ja" maxLength={160} value={expression} onChange={e=>setExpression(e.target.value)} /></label><label>한국어 뜻<input maxLength={1000} value={meaning} onChange={e=>setMeaning(e.target.value)} /></label>
          {!preview&&expression.trim()&&meaning.trim()?<SaveContextButton key={`${selection.pageId}:${selection.quote}:${expression}:${meaning}`} word={{word_text:expression,meaning,language:'Japanese'}} source={{kind:'textbook',bookId:BOOK_ID,editionId:edition,...selection}} />:<p>{preview?'발행한 뒤 복습에 담을 수 있어요.':'표현과 뜻을 채워 주세요.'}</p>}
          <button className="btn btn--ghost btn--sm" type="button" onClick={()=>{setSelection(null);lastSelection.current=null}}>선택 닫기</button>
        </section>}
        {!preview&&lesson&&<MaterialChapterLinks key={unit} lang="Japanese" slug={`n5-book-${unit}`} />}
        <Link href="/vocab">복습으로 이동</Link>
      </aside></div>
  </div>;
}
