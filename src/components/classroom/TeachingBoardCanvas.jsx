'use client';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Excalidraw, MainMenu, CaptureUpdateAction, convertToExcalidrawElements, newElementWith, getSceneVersion} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import {supabase} from '../../lib/supabase';
import {boardScope, boardExpression, expressionOf, boardInsertion, replaceBoardPage, BOARD_PAGE_LIMIT, validateBoard} from '../../lib/teachingBoard';
import {useTeachingBoard} from '../../lib/useTeachingBoard';
import {cardSkeleton, cardFields, readCard, rotateCardPart} from '../../lib/teachingBoardCard';
import {isClassComposing} from '../../lib/classReaderDraft';

export default function TeachingBoardCanvas({owner, team, day, current, onRecord, getRecordState, onLayout, onClose}) {
  const scope = useMemo(() => boardScope(owner, team.key, day), [owner, team.key, day]);
  const store = useTeachingBoard(scope), root = useRef(null), api = useRef(null), document = useRef(null), latest = useRef(null), timer = useRef(null), signature = useRef(''), armed=useRef(false), dirty=useRef(false);
  const [layout, setLayout] = useState('split'), [pageId, setPageId] = useState(null), [selected, setSelected] = useState([]), [panel, setPanel] = useState(false);
  const [input, setInput] = useState(''), [reading, setReading] = useState(''), [meaning, setMeaning] = useState(''), [candidates, setCandidates] = useState([]), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null), [recording, setRecording] = useState(false), [toolsOpen,setToolsOpen] = useState(false);
  const attempt = useRef(0), composing = useRef(false), editVersion = useRef(0), boardSave = useRef(store.save);
  boardSave.current = store.save;
  useEffect(() => { if (store.ready && !document.current) { document.current = store.document; setPageId(store.document.activePage); } }, [store.ready, store.document]);
  useEffect(() => () => { attempt.current++; }, []);
  const commit = useCallback(() => {
    clearTimeout(timer.current);
    if (!dirty.current || !latest.current || !document.current) return;
    dirty.current=false;
    const {id, elements, state} = latest.current;
    document.current = replaceBoardPage(document.current, id, elements, state);
    boardSave.current(document.current);
  }, []);
  useEffect(() => {
    const hide = () => commit();
    window.addEventListener('pagehide', hide); documentVisibility(true);
    function documentVisibility(add) { window.document[add ? 'addEventListener' : 'removeEventListener']('visibilitychange', hide); }
    return () => { commit(); window.removeEventListener('pagehide', hide); documentVisibility(false); };
  }, [commit]);

  const connectCanvas=useCallback(value=>{
    api.current=value;
    requestAnimationFrame(()=>{
      if(api.current!==value || !root.current)return;
      const style=getComputedStyle(root.current);
      value.updateScene({appState:{viewBackgroundColor:style.getPropertyValue('--reader-paper').trim(),currentItemStrokeColor:style.getPropertyValue('--reader-ink').trim()}});
    });
  },[]);
  const changeLayout = next => { setLayout(next); onLayout(next); requestAnimationFrame(() => api.current?.refresh()); };
  const changeScene = (elements, state) => {
    if (!pageId) return;
    latest.current = {id: pageId, elements, state};
    const chosen = elements.filter(el => !el.isDeleted && state.selectedElementIds[el.id]);
    setSelected(previous => previous.length === chosen.length && previous.every((el, i) => el.id === chosen[i].id && el.version === chosen[i].version) ? previous : chosen);
    const next = `${pageId}:${getSceneVersion(elements)}:${state.scrollX}:${state.scrollY}:${state.zoom.value}`;
    if(!signature.current){signature.current=next;return;}
    if (signature.current === next) return;
    signature.current = next;
    if(!armed.current)return;
    dirty.current=true;
    clearTimeout(timer.current); timer.current = setTimeout(commit, 300);
  };
  const update = (elements, extra = {}) => api.current?.updateScene({elements, ...extra, captureUpdate: CaptureUpdateAction.IMMEDIATELY});
  const addExpression = value => {
    if (!api.current) return;
    try {
      const payload = boardExpression(value, team.lang), elements = api.current.getSceneElementsIncludingDeleted();
      const id = crypto.randomUUID(), width = payload.text.length > 25 ? 440 : 320;
      const style=getComputedStyle(root.current), palette={paper:style.getPropertyValue('--reader-paper').trim(),ink:style.getPropertyValue('--reader-ink').trim(),line:style.getPropertyValue('--reader-line').trim(),accent:style.getPropertyValue('--reader-accent').trim()};
      const skeleton=cardSkeleton(payload,id,{x:0,y:0},palette,width);
      const position=boardInsertion(elements,api.current.getAppState(),width,skeleton[0].height);
      const card=convertToExcalidrawElements(cardSkeleton(payload,id,position,palette,width),{regenerateIds:false});
      update([...elements,...card],{appState:{selectedElementIds:Object.fromEntries(card.map(el=>[el.id,true])),selectedGroupIds:{[id]:true}}});
      api.current.setActiveTool({type:'selection'});
      const active=api.current;
      requestAnimationFrame(()=>{
        if(api.current!==active || !root.current)return;
        const state=active.getAppState(),zoom=state.zoom.value;
        const surface=root.current.querySelector('.teaching-board-surface');
        // The selection strip may reduce the canvas after insertion. Measure
        // the settled surface so the newly added meaning is never below it.
        if(position.y+skeleton[0].height > -state.scrollY+(surface.clientHeight-80)/zoom || position.x+width > -state.scrollX+surface.clientWidth/zoom){
          active.refresh();requestAnimationFrame(()=>{if(api.current===active)active.scrollToContent(card,{fitToContent:skeleton[0].height>(surface.clientHeight-130)/zoom,animate:false});});
        }
      });
      setMessage('판에 놓았어요. 자유롭게 옮기고 필기하세요.');
      setPanel(false); setEditing(null);
    } catch (error) { setMessage(error.message); }
  };
  const anchor=selected.find(el=>expressionOf(el));
  const picked=anchor && selected.every(el=>el.groupIds?.includes(anchor.groupIds[0])) ? readCard(anchor,api.current?.getSceneElementsIncludingDeleted() || selected) : null;
  const recorded=picked ? getRecordState?.(picked) : null;
  const editSelected = () => { if (picked) { setEditing(anchor.id); setInput(picked.text); setReading(picked.reading); setMeaning(picked.meaning); setPanel(true); setCandidates([]); } };
  const applyExpression = event => {
    event.preventDefault(); if (isClassComposing(event, composing.current)) return;
    if (!editing) { addExpression({text:input, reading, meaning, source:{kind:'manual'}}); return; }
    const elements = api.current.getSceneElementsIncludingDeleted(), target = elements.find(el => el.id === editing && !el.isDeleted), previous = expressionOf(target);
    if (!previous) { setMessage('수정할 표현을 다시 선택해 주세요.'); return; }
    try {
      const next = boardExpression({...readCard(target,elements), text:input, reading, meaning, source:input.trim() === previous.text ? previous.source : {kind:'manual'}}, team.lang);
      reviseCard(target,next);
      setEditing(null); setPanel(false); setMessage('이 판의 표현을 수정했어요.');
    } catch (error) { setMessage(error.message); }
  };
  const reviseCard = (target, value) => {
    const elements=api.current.getSceneElementsIncludingDeleted(), fields=cardFields(target,elements);
    const style=getComputedStyle(root.current), palette={paper:style.getPropertyValue('--reader-paper').trim(),ink:style.getPropertyValue('--reader-ink').trim(),line:style.getPropertyValue('--reader-line').trim(),accent:style.getPropertyValue('--reader-accent').trim()};
    const fresh=convertToExcalidrawElements(cardSkeleton(value,target.id,{x:target.x,y:target.y},palette,target.width,(fields.find(el=>el.customData.manabiField==='text')?.fontSize || 42)/42),{regenerateIds:false});
    update(elements.map(el=>{
      if(el.id===target.id) return newElementWith(el,{height:fresh[0].height,customData:{...el.customData,manabiExpression:value}});
      if(!fields.some(field=>field.id===el.id)) return el;
      const replacement=rotateCardPart(fresh.find(field=>field.customData?.manabiField===el.customData.manabiField),fresh[0],target.angle);
      return newElementWith(el,{x:replacement.x,y:replacement.y,angle:replacement.angle,text:replacement.text,originalText:replacement.originalText,fontSize:replacement.fontSize,width:replacement.width,height:replacement.height,customData:replacement.customData,opacity:replacement.opacity});
    }));
  };
  const toggle = field => {
    if (!picked) return;
    const next={...picked,[field]:!picked[field]};
    update(api.current.getSceneElementsIncludingDeleted().map(el=>{
      if(el.id===anchor.id) return newElementWith(el,{customData:{...el.customData,manabiExpression:next}});
      if(el.groupIds?.[0]===anchor.groupIds[0] && el.customData?.manabiField===(field==='showReading'?'reading':'meaning')) return newElementWith(el,{opacity:next[field]?100:0});
      return el;
    }));
  };
  const group = () => {
    if (selected.length < 2) return;
    const id = crypto.randomUUID(), ids = new Set(selected.map(el => el.id));
    update(api.current.getSceneElementsIncludingDeleted().map(el => ids.has(el.id) ? newElementWith(el, {groupIds:[...el.groupIds, id]}) : el), {appState:{selectedGroupIds:{[id]:true}}});
    setMessage('표현과 필기를 함께 묶었어요.');
  };
  const lookup = async text => {
    const query = text.trim(); if (!query) return;
    const request = ++attempt.current, atEdit = editVersion.current;
    setBusy(true); setCandidates([]); setMessage('');
    try {
      const {data:{session}} = await supabase.auth.getSession();
      const [dictionary, kana] = await Promise.all([
        supabase.from('morpheme_dictionary').select('meanings,reading').eq('language',team.lang).eq('base_form',query).maybeSingle(),
        team.lang === 'Japanese' && /^[ぁ-ゖァ-ヶー]+$/.test(query) ? fetch(`/api/classroom/kana?q=${encodeURIComponent(query)}`, {headers:{Authorization:`Bearer ${session?.access_token || ''}`}}).then(async response => { if (!response.ok) throw new Error('가나 후보를 불러오지 못했어요.'); return response.json(); }) : Promise.resolve({candidates:[]}),
      ]);
      if (request !== attempt.current || atEdit !== editVersion.current) return;
      if (dictionary.error) throw dictionary.error;
      const found = dictionary.data;
      const choices=kana.candidates || [];
      if(choices.length){
        const result=await supabase.from('morpheme_dictionary').select('base_form,meanings').eq('language','Japanese').in('base_form',choices.map(item=>item.text));
        if(request!==attempt.current || atEdit!==editVersion.current)return;
        setCandidates(choices.map(item=>({...item,meaning:(result.data?.find(row=>row.base_form===item.text)?.meanings || []).map(part=>typeof part==='string'?part:part.meaning || part.definition || '').filter(Boolean).join(' · ')})));
      } else setCandidates([]);
      if (found) { setReading(found.reading || ''); setMeaning((found.meanings || []).map(item => typeof item === 'string' ? item : item.meaning || item.definition || '').filter(Boolean).join(' · ').slice(0,500)); }
      else setMessage(kana.candidates?.length ? '표기 후보를 골라 주세요. 뜻은 조회하거나 직접 적을 수 있어요.' : '저장된 뜻이 없어요. 입력한 그대로 놓거나 뜻을 직접 적어 주세요.');
    } catch { if (request === attempt.current) setMessage('사전을 불러오지 못했어요. 입력한 그대로 놓을 수 있어요.'); }
    finally { if (request === attempt.current) setBusy(false); }
  };
  const openInput = () => { attempt.current++; setBusy(false); setEditing(null); setInput(''); setReading(''); setMeaning(''); setCandidates([]); setPanel(value => !value); };
  const changePage = id => {
    commit(); latest.current = null; signature.current = ''; armed.current=false; dirty.current=false; api.current = null;
    document.current = {...document.current, activePage:id}; store.save(document.current); setPageId(id); setSelected([]); setEditing(null); setPanel(false);
  };
  const newPage = () => {
    if (document.current.pages.length >= BOARD_PAGE_LIMIT) { setMessage('한 수업에서 20개 판까지 보관할 수 있어요.'); return; }
    commit(); const id = crypto.randomUUID();
    document.current = {...document.current, pages:[...document.current.pages, {id, elements:[], camera:{scrollX:0,scrollY:0,zoom:{value:1}}}]};
    changePage(id);
  };
  const backup = () => {
    commit();
    const blob = new Blob([JSON.stringify({format:'manabi-teaching-board', document:document.current})], {type:'application/json'});
    const url = URL.createObjectURL(blob), anchor = window.document.createElement('a'); anchor.href=url; anchor.download=`manabi-board-${day}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const restore = async event => {
    const file=event.target.files?.[0]; event.target.value=''; if (!file) return;
    try {
      if(file.size > 6 * 1024 * 1024) throw new Error('백업 파일이 너무 커요.');
      const parsed = JSON.parse(await file.text());
      if(parsed.format !== 'manabi-teaching-board') throw new Error('manabi 설명판 백업 파일을 골라 주세요.');
      const incoming = validateBoard(parsed.document); commit();
      if(document.current.pages.length + incoming.pages.length > BOARD_PAGE_LIMIT) throw new Error('판이 20개를 넘어요.');
      const pages=incoming.pages.map(page => ({...page,id:crypto.randomUUID()}));
      document.current={...document.current,pages:[...document.current.pages,...pages]}; changePage(pages[0].id); setMessage('기존 판을 보존하고 백업을 새 판으로 가져왔어요.');
    } catch(error) { setMessage(error.message); }
  };
  const recover = row => {
    commit();
    if(document.current.pages.length+row.document.pages.length>BOARD_PAGE_LIMIT){setMessage('복구할 판을 더하면 20개를 넘어요. 먼저 백업해 주세요.');return;}
    const recovered=row.document.pages.map(page=>({...page,id:crypto.randomUUID()}));
    document.current={...document.current,pages:[...document.current.pages,...recovered]};changePage(recovered[0].id);setMessage('최신 판을 보존하고 충돌본을 새 판으로 불러왔어요.');
  };
  const record = async () => {
    if (!picked || recording) return;
    setRecording(true);
    try { await onRecord(picked); setMessage('수업 기록에서 저장 상태를 확인할 수 있어요.'); }
    catch (error) { setMessage(error.message || '수업 기록에 추가하지 못했어요. 판의 내용은 유지됩니다.'); }
    finally { setRecording(false); }
  };

  if (!store.ready || !pageId) return <div className="teaching-board-loading"><p role="status">{store.error || '보관된 설명판을 불러오고 있어요…'}</p><button onClick={onClose}>교재로 돌아가기</button></div>;
  const page = document.current.pages.find(item => item.id === pageId), pages = document.current.pages;
  return <section ref={root} className="teaching-board" data-tools-open={toolsOpen} onPointerDownCapture={()=>{armed.current=true;}} onKeyDownCapture={()=>{armed.current=true;}} onKeyDown={event=>event.stopPropagation()} aria-label="선생님 설명판" data-presenting={layout==='board'}>
    <header className="teaching-board-header"><div><strong>설명판</strong><small>{team.name} · {day}</small></div><nav aria-label="설명판 보기"><button aria-pressed={layout==='split'} onClick={() => changeLayout(layout==='split'?'board':'split')}>교재 {layout==='split'?'접기':'펼치기'}</button><button aria-pressed={layout==='reader'} onClick={() => changeLayout(layout==='reader'?'split':'reader')}>교재 크게</button><button onClick={openInput} aria-expanded={panel}>표현 추가</button><button aria-pressed={toolsOpen} onClick={()=>setToolsOpen(v=>!v)}>선·색</button><button onClick={() => { commit(); onClose(); }}>닫기</button></nav></header>
    {current?.text && <div className="teaching-board-source"><span>교재에서 선택 <b>{current.text}</b></span><button onClick={() => addExpression(current)}>판에 놓기</button></div>}
    {panel && <form className="teaching-board-import" aria-label="표현 불러오기" onSubmit={applyExpression} onCompositionStart={() => {composing.current=true;}} onCompositionEnd={() => {composing.current=false;}} onKeyDown={event => {if(event.key==='Enter' && isClassComposing(event,composing.current))event.preventDefault();}}>
      <div className="teaching-board-import-search"><label>단어·표현<input autoFocus value={input} maxLength={500} placeholder={team.lang==='Japanese'?'한자 또는 히라가나로 입력':'교재 밖의 표현도 입력하세요'} onChange={event => {attempt.current++;editVersion.current++;setBusy(false);setInput(event.target.value);setCandidates([]);setReading('');setMeaning('');}}/></label><button type="button" disabled={busy || !input.trim()} onClick={() => lookup(input)}>{busy?'조회 중…':'사전 찾기'}</button></div>
      {!!candidates.length && <div className="teaching-board-candidates" aria-label="한자 후보">{candidates.map(value => <button key={value.text} type="button" onClick={() => {editVersion.current++;setInput(value.text);setReading(value.reading);lookup(value.text);}}>{value.text}<small>{value.meaning || `${value.level} · 뜻 확인 필요`}</small></button>)}</div>}
      <div className="teaching-board-import-fields"><label>읽기<input value={reading} maxLength={500} onChange={event => {editVersion.current++;setReading(event.target.value);}}/></label><label>뜻<textarea aria-label="뜻" value={meaning} maxLength={500} rows={2} onChange={event => {editVersion.current++;setMeaning(event.target.value);}}/></label></div>
      <div><button disabled={!input.trim()}>{editing?'이 판에 반영':'입력한 표현 놓기'}</button><button type="button" onClick={() => {attempt.current++;setBusy(false);setPanel(false);}}>접기</button></div>
    </form>}
    <div className="teaching-board-surface" tabIndex={-1} onKeyDown={event => event.stopPropagation()}>
      <Excalidraw key={pageId} excalidrawAPI={connectCanvas} initialData={{elements:page.elements,appState:{...page.camera,currentItemFontFamily:2,currentItemRoughness:0,currentItemStrokeWidth:2}}}
        onChange={changeScene} onPointerUp={commit} handleKeyboardGlobally={false} autoFocus={false} langCode="ko-KR" theme="light" aiEnabled={false}
        validateEmbeddable={false}
        onLinkOpen={(_,event) => event.preventDefault()} onPaste={data => {if(data.files?.length || data.elements?.some(el=>['image','iframe','embeddable'].includes(el.type))){setMessage('이번 설명판에는 글자와 필기를 보관할 수 있어요.');return false;}return true;}}
        UIOptions={{canvasActions:{loadScene:false,export:false,saveToActiveFile:false,clearCanvas:false,changeViewBackgroundColor:false,toggleTheme:false},tools:{image:false}}}>
        <MainMenu><MainMenu.Item onSelect={backup}>설명판 백업</MainMenu.Item></MainMenu>
      </Excalidraw>
    </div>
    <div className="teaching-board-accessible">{(latest.current?.elements || page.elements).filter(el=>!el.isDeleted && expressionOf(el)).map(el=>{const value=readCard(el,latest.current?.elements || page.elements);return value && <p key={el.id} data-board-expression={el.id}>{value.text} · {value.showReading?value.reading:""} · {value.showMeaning?value.meaning:""}</p>;})}</div>
    {selected.length>0 && <div className="teaching-board-selection" aria-label="선택한 요소 도구"><span>{picked ? picked.text : `${selected.length}개 선택`}</span>{picked && <><button onClick={editSelected}>내용 수정</button><button aria-pressed={!picked.showReading} onClick={() => toggle('showReading')}>읽기 {picked.showReading?'가리기':'보이기'}</button><button aria-pressed={!picked.showMeaning} onClick={() => toggle('showMeaning')}>뜻 {picked.showMeaning?'가리기':'보이기'}</button><button disabled={recording || !!recorded} onClick={record}>{recorded || (recording?'보관 중…':'오늘 표현에 추가')}</button></>}{selected.length>1 && !picked && <button onClick={group}>함께 묶기</button>}</div>}
    <footer className="teaching-board-footer"><nav aria-label="설명판 페이지">{pages.map((item,i) => <button key={item.id} aria-current={pageId===item.id?'page':undefined} onClick={() => changePage(item.id)}>{i+1}</button>)}<button onClick={newPage}>+ 새 판</button></nav><button onClick={() => api.current?.scrollToContent(undefined,{fitToContent:true,animate:false})}>전체 보기</button><details><summary>백업</summary><div className="teaching-board-backup-menu"><button onClick={backup}>내려받기</button>{store.recoveries?.map((row,i)=><button key={row.id} onClick={()=>recover(row)}>충돌본 {i+1} 불러오기</button>)}<label className="teaching-board-file">가져오기<input type="file" accept="application/json,.json" onChange={restore}/></label></div></details><small role="status">{store.error ? '저장 확인 필요' : (store.saving?'기기에 보관 중…':'이 기기에 보관됨')}</small></footer>
    {(message || store.error) && <p className="teaching-board-message" role="status">{store.error || message}{store.error && <><button onClick={backup}>내 내용 백업</button><button onClick={()=>window.location.reload()}>최신 판 열기</button></>}</p>}
  </section>;
}
