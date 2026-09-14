'use client';
import {useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react';
import {Excalidraw, MainMenu, CaptureUpdateAction, convertToExcalidrawElements, newElementWith, getSceneVersion, getCommonBounds} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import {createPortal} from 'react-dom';
import BoardTools from './BoardTools';
import BoardPresentation from './BoardPresentation';
import {readBoardWorkspace,writeBoardWorkspace,boardSearch,normalizeBoardWorkspace} from '../../lib/teachingWorkspace';
import {studySelection} from '../../lib/classStudy';
import {supabase} from '../../lib/supabase';
import {boardScope, boardExpression, expressionOf, boardInsertion, replaceBoardPage, BOARD_PAGE_LIMIT, validateBoard} from '../../lib/teachingBoard';
import {useTeachingBoard} from '../../lib/useTeachingBoard';
import {cardSkeleton, cardFields, readCard, rotateCardPart} from '../../lib/teachingBoardCard';
import {isClassComposing} from '../../lib/classReaderDraft';
import {boardCameraForBounds} from '../../lib/teachingBoardViewport';

export default function TeachingBoardCanvas({owner, team, day, onRecord, getRecordState, onLayout, onClose, headerHost, navigation, onSession, onRatio, material, vocabularyIndex, actionsRef, onReady}) {
  const scope = useMemo(() => boardScope(owner, team.key, day), [owner, team.key, day]);
  const store = useTeachingBoard(scope), root = useRef(null), api = useRef(null), document = useRef(null), latest = useRef(null), timer = useRef(null), signature = useRef(''), armed=useRef(false), dirty=useRef(false);
  const [initialWorkspace]=useState(()=>readBoardWorkspace(scope));
  const [ratio,setRatio]=useState(initialWorkspace.ratio),[presenting,setPresenting]=useState(null),[activeTool,setActiveTool]=useState('selection'),[searching,setSearching]=useState(false);
  const inputRef=useRef(null),presentationActive=useRef(false);
  const [layout, setLayout] = useState(initialWorkspace.layout), [pageId, setPageId] = useState(null), [selected, setSelected] = useState([]), [panel, setPanel] = useState(false);
  const [input, setInput] = useState(initialWorkspace.input), [reading, setReading] = useState(initialWorkspace.reading), [meaning, setMeaning] = useState(initialWorkspace.meaning), [candidates, setCandidates] = useState([]), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null), [recording, setRecording] = useState(false), [toolsOpen,setToolsOpen] = useState(false);
  const attempt = useRef(0), composing = useRef(false), editVersion = useRef(0), boardSave = useRef(store.save);
  boardSave.current = store.save;
  useEffect(()=>{onLayout(layout);onRatio?.(ratio);},[layout,ratio,onLayout,onRatio]);
  useEffect(()=>{writeBoardWorkspace(scope,{...(editing?readBoardWorkspace(scope):{input,reading,meaning}),layout,ratio});},[scope,layout,ratio,input,reading,meaning,editing]);
  useEffect(()=>{if(!message)return;const timeout=setTimeout(()=>setMessage(''),6500);return()=>clearTimeout(timeout);},[message]);
  const library=useMemo(()=>[
    ...Object.entries(material?.processed_json?.dictionary||{}).filter(([,token])=>!['개행','기호','공백'].includes(token.pos)).map(([id,token])=>({...studySelection(material,{...token,id}),label:'교재'})),
    ...[...new Set(vocabularyIndex?.byKey?.values()||[])].filter(row=>row.language===team.lang).map(row=>({text:row.word_text,reading:row.furigana,meaning:row.meaning,source:{kind:'manual'},label:'내 단어'})),
  ],[material,vocabularyIndex,team.lang]);

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
      onReady?.(true);
      const style=getComputedStyle(root.current);
      value.updateScene({appState:{viewBackgroundColor:style.getPropertyValue('--reader-paper').trim(),currentItemStrokeColor:style.getPropertyValue('--reader-ink').trim()}});
    });
  },[onReady]);
  useEffect(()=>()=>onReady?.(false),[onReady]);
  const revealElements = useCallback((elements, fit = false) => {
    const active=api.current;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(!active || api.current!==active || !root.current || presentationActive.current)return;
      active.refresh();
      const surface=root.current.querySelector('.teaching-board-surface'), rect=surface.getBoundingClientRect();
      if(!rect.width || !rect.height)return;
      const toolbar=surface.querySelector('.App-toolbar:not(.App-bottom-bar .App-toolbar)')?.getBoundingClientRect();
      const footer=surface.querySelector('.App-bottom-bar .Island, .layer-ui__wrapper__footer')?.getBoundingClientRect();
      const misc=surface.querySelector('.mobile-misc-tools-container')?.getBoundingClientRect();
      const visible=elements.filter(el=>!el.isDeleted);
      if(!visible.length)return;
      // Mobile toolbars animate in from the edges. Reserve their settled size
      // even when getBoundingClientRect observes a partially translated bar.
      const insets={top:toolbar?.height?toolbar.height+Math.max(16,toolbar.top-rect.top):0,bottom:footer?.height?footer.height+Math.max(16,rect.bottom-footer.bottom):0,right:misc?.width?rect.right-misc.left:0};
      const camera=boardCameraForBounds(getCommonBounds(visible),active.getAppState(),{width:rect.width,height:rect.height},insets,fit);
      if(camera)active.updateScene({appState:camera,captureUpdate:CaptureUpdateAction.NEVER});
    }));
  },[]);
  useEffect(()=>{
    const surface=root.current?.querySelector('.teaching-board-surface');
    if(!surface)return;
    let previousSize=null;
    const revealSelected=()=>{
      const active=api.current;if(!active||presentationActive.current)return;
      const rect=surface.getBoundingClientRect();if(!rect.width||!rect.height)return;
      const resized=previousSize&&(Math.abs(previousSize.width-rect.width)>1||Math.abs(previousSize.height-rect.height)>1);
      previousSize={width:rect.width,height:rect.height};
      const state=active.getAppState(),elements=active.getSceneElements(),chosen=elements.filter(el=>state.selectedElementIds[el.id]);
      // A cleared selection must not leave a smaller pane looking empty. Keep
      // an existing camera on mount when its content is still visible.
      const content=elements.filter(el=>el.type==='text'&&el.opacity!==0);
      const visible=(content.length?content:elements).some(el=>{
        const x=(el.x+el.width/2+state.scrollX)*state.zoom.value,y=(el.y+el.height/2+state.scrollY)*state.zoom.value;
        return x>=16&&x<=rect.width-16&&y>=16&&y<=rect.height-72;
      });
      revealElements(chosen.length?chosen:resized||!visible?elements:[],!chosen.length);
    };
    const observer=new ResizeObserver(revealSelected),observed=new Set();
    const watchTools=()=>{
      const targets=new Set([surface,...surface.querySelectorAll('.App-toolbar, .App-bottom-bar .Island, .layer-ui__wrapper__footer')]);
      let changed=false;
      for(const el of observed)if(!targets.has(el)){observer.unobserve(el);observed.delete(el);changed=true;}
      for(const el of targets)if(!observed.has(el)){observer.observe(el);observed.add(el);changed=true;}
      if(changed)revealSelected();
    };
    // Excalidraw replaces its desktop footer with a taller mobile toolbar
    // after the outer resize. Observe that replacement as well as the paper.
    const tools=new MutationObserver(watchTools);tools.observe(surface,{childList:true,subtree:true});watchTools();
    return()=>{observer.disconnect();tools.disconnect();};
  },[pageId,revealElements]);
  const changeLayout = next => { setLayout(next); onLayout(next); requestAnimationFrame(() => api.current?.refresh()); };
  const changeScene = (elements, state) => {
    if (!pageId) return;
    latest.current = {id: pageId, elements, state};
    if(['image','embeddable','magicframe'].includes(state.activeTool.type)){api.current?.setActiveTool({type:'selection'});return;}
    setActiveTool(previous=>previous===state.activeTool.type?previous:state.activeTool.type);
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
  const addExpression = (value, preserveDraft=false) => {
    if (!api.current) return false;
    try {
      const payload = boardExpression(value, team.lang), elements = api.current.getSceneElementsIncludingDeleted();
      const id = crypto.randomUUID(), width = payload.text.length > 25 ? 440 : 320;
      const style=getComputedStyle(root.current), palette={paper:style.getPropertyValue('--reader-paper').trim(),ink:style.getPropertyValue('--reader-ink').trim(),line:style.getPropertyValue('--reader-line').trim(),accent:style.getPropertyValue('--reader-accent').trim()};
      const skeleton=cardSkeleton(payload,id,{x:0,y:0},palette,width);
      const position=boardInsertion(elements,api.current.getAppState(),width,skeleton[0].height);
      const card=convertToExcalidrawElements(cardSkeleton(payload,id,position,palette,width),{regenerateIds:false});
      update([...elements,...card],{appState:{selectedElementIds:Object.fromEntries(card.map(el=>[el.id,true])),selectedGroupIds:{[id]:true}}});
      api.current.setActiveTool({type:'selection'});
      revealElements(card);
      setMessage('판에 놓았어요. 자유롭게 옮기고 필기하세요.');
      if(!preserveDraft){attempt.current++;setBusy(false);setPanel(false);setSearching(false);setEditing(null);setInput('');setReading('');setMeaning('');}
      return true;
    } catch (error) { setMessage(error.message);return false; }
  };
  // The reader's existing word card can place an expression without consuming
  // the separate board-input draft or posting a student-facing class record.
  useImperativeHandle(actionsRef,()=>({place:value=>{
    if(!api.current)return false;
    armed.current=true;
    if(layout==='reader')changeLayout('split');
    return addExpression(value,true);
  }}));
  const anchor=selected.find(el=>expressionOf(el));
  const picked=anchor && selected.every(el=>el.groupIds?.includes(anchor.groupIds[0])) ? readCard(anchor,api.current?.getSceneElementsIncludingDeleted() || selected) : null;
  const recorded=picked ? getRecordState?.(picked) : null;
  const editSelected = () => { if (picked) { attempt.current++;editVersion.current++;setBusy(false); setEditing(anchor.id); setInput(picked.text); setReading(picked.reading); setMeaning(picked.meaning); setPanel(true); setCandidates([]); } };
  const applyExpression = event => {
    event.preventDefault(); if (isClassComposing(event, composing.current)) return;
    if (!editing) { addExpression({text:input, reading, meaning, source:{kind:'manual'}}); return; }
    const elements = api.current.getSceneElementsIncludingDeleted(), target = elements.find(el => el.id === editing && !el.isDeleted), previous = expressionOf(target);
    if (!previous) { setMessage('수정할 표현을 다시 선택해 주세요.'); return; }
    try {
      const next = boardExpression({...readCard(target,elements), text:input, reading, meaning, source:input.trim() === previous.text ? previous.source : {kind:'manual'}}, team.lang);
      reviseCard(target,next);
      cancelEdit();setMessage('이 판의 표현을 수정했어요.');
    } catch (error) { setMessage(error.message); }
  };
  const reviseCard = (target, value) => {
    const elements=api.current.getSceneElementsIncludingDeleted(), fields=cardFields(target,elements);
    const style=getComputedStyle(root.current), palette={paper:style.getPropertyValue('--reader-paper').trim(),ink:style.getPropertyValue('--reader-ink').trim(),line:style.getPropertyValue('--reader-line').trim(),accent:style.getPropertyValue('--reader-accent').trim()};
    const fresh=convertToExcalidrawElements(cardSkeleton(value,target.id,{x:target.x,y:target.y},palette,target.width,(fields.find(el=>el.customData.manabiField==='text')?.fontSize || 42)/42),{regenerateIds:false});
    const revised=elements.map(el=>{
      if(el.id===target.id) return newElementWith(el,{height:fresh[0].height,customData:{...el.customData,manabiExpression:value}});
      if(!fields.some(field=>field.id===el.id)) return el;
      const replacement=rotateCardPart(fresh.find(field=>field.customData?.manabiField===el.customData.manabiField),fresh[0],target.angle);
      return newElementWith(el,{x:replacement.x,y:replacement.y,angle:replacement.angle,text:replacement.text,originalText:replacement.originalText,fontSize:replacement.fontSize,width:replacement.width,height:replacement.height,customData:replacement.customData,opacity:replacement.opacity});
    });
    update(revised);revealElements(revised.filter(el=>el.groupIds?.[0]===target.groupIds?.[0]));
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
    const request = ++attempt.current, atEdit = editVersion.current;setPanel(true);setSearching(false);
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
  const cancelEdit=()=>{attempt.current++;setBusy(false);if(editing){const draft=readBoardWorkspace(scope);setInput(draft.input);setReading(draft.reading);setMeaning(draft.meaning);setEditing(null);}setPanel(false);setSearching(false);};
  const openInput = () => { if(layout==='reader')changeLayout('split');requestAnimationFrame(()=>inputRef.current?.focus()); };
  const chooseTool=type=>{api.current?.setActiveTool({type});setToolsOpen(false);};
  const styleSelection=(property,value)=>{
    const editor=api.current;if(!editor)return;
    const color=property==='strokeColor'?getComputedStyle(root.current).getPropertyValue(`--board-${value}`).trim():value;
    const key=property==='strokeColor'?'currentItemStrokeColor':'currentItemStrokeWidth';
    const ids=editor.getAppState().selectedElementIds;
    update(editor.getSceneElementsIncludingDeleted().map(el=>ids[el.id]?newElementWith(el,{[property]:color}):el),{appState:{[key]:color}});
  };
  const showBoard=()=>{commit();const all=api.current?.getSceneElements()||[];const elements=selected.length?selected:all;if(elements.length){presentationActive.current=true;setPresenting(structuredClone(elements));}};
  const resize=(event)=>{
    const rect=root.current?.closest('.viewer-layout')?.getBoundingClientRect();if(!rect)return;
    setRatio(normalizeBoardWorkspace({ratio:100*(event.clientX-rect.left)/rect.width}).ratio);
  };

  const changePage = id => {
    onReady?.(false);
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
  const recent=pages.flatMap(item=>item.elements.filter(el=>!el.isDeleted&&expressionOf(el)).map(el=>({...readCard(el,item.elements),label:'최근 판'}))).reverse();
  const results=searching&&!editing?boardSearch(input,[...recent,...library]):[];
  const workspaceHeader=<header className="teaching-board-header">{navigation}<nav aria-label="설명판 보기">{[['board','설명판'],['split','함께'],['reader','교재']].map(([value,label])=><button key={value} aria-pressed={layout===value} onClick={()=>changeLayout(value)}>{label}</button>)}</nav><div className="board-header-actions"><button onClick={showBoard} disabled={!(latest.current?.elements||page.elements).some(el=>!el.isDeleted)} className="board-present-button">보여주기</button><button className="board-header-input" onClick={openInput}>표현 입력</button><button onClick={onSession}>수업 기록</button><button onClick={()=>{commit();onClose();}} aria-label="설명판 닫기">×</button></div></header>;
  return <section ref={root} className="teaching-board" data-tools-open={toolsOpen} onPointerDownCapture={()=>{armed.current=true;}} onKeyDownCapture={()=>{armed.current=true;}} onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){cancelEdit();setToolsOpen(false);}}} aria-label="선생님 설명판">
    {headerHost?createPortal(workspaceHeader,headerHost):workspaceHeader}
    {layout==='split'&&<div className="board-divider" role="separator" tabIndex={0} aria-label="설명판 너비" aria-orientation="vertical" aria-valuemin={40} aria-valuemax={72} aria-valuenow={Math.round(ratio)} onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);resize(event);}} onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))resize(event);}} onPointerUp={event=>event.currentTarget.releasePointerCapture(event.pointerId)} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();setRatio(value=>event.key==='Home'?40:event.key==='End'?72:normalizeBoardWorkspace({ratio:value+(event.key==='ArrowLeft'?-2:2)}).ratio);}}}/>}
    <BoardTools active={activeTool} onTool={chooseTool} onStyle={styleSelection} open={toolsOpen} onToggle={()=>setToolsOpen(v=>!v)}/>
    <div className="teaching-board-surface">
      <Excalidraw key={pageId} excalidrawAPI={connectCanvas} initialData={{elements:page.elements,appState:{...page.camera,currentItemFontFamily:2,currentItemRoughness:0,currentItemStrokeWidth:2}}}
        onChange={changeScene} langCode="ko-KR" handleKeyboardGlobally={false} autoFocus={false}
        validateEmbeddable={false}
        onLinkOpen={(_,event) => event.preventDefault()} onPaste={data => {if(data.files?.length || data.elements?.some(el=>['image','iframe','embeddable'].includes(el.type))){setMessage('이 설명판에는 글자와 필기를 보관할 수 있어요.');return false;}return true;}}
        UIOptions={{canvasActions:{loadScene:false,export:false,saveToActiveFile:false,clearCanvas:false,changeViewBackgroundColor:false,toggleTheme:false},tools:{image:false}}}>
        <MainMenu><MainMenu.Item onSelect={backup}>설명판 백업</MainMenu.Item></MainMenu>
      </Excalidraw>
    </div>
    <div className="teaching-board-accessible">{(latest.current?.elements || page.elements).filter(el=>!el.isDeleted && expressionOf(el)).map(el=>{const value=readCard(el,latest.current?.elements || page.elements);return value && <p key={el.id} data-board-expression={el.id}>{value.text} · {value.showReading?value.reading:""} · {value.showMeaning?value.meaning:""}</p>;})}</div>
    {selected.length>0 && <div className="teaching-board-selection" aria-label="선택한 요소 도구"><button onClick={showBoard}>선택한 내용 보여주기</button>{picked && <><button onClick={editSelected}>내용 수정</button><button aria-pressed={!picked.showReading} onClick={() => toggle('showReading')}>읽기 {picked.showReading?'가리기':'보이기'}</button><button aria-pressed={!picked.showMeaning} onClick={() => toggle('showMeaning')}>뜻 {picked.showMeaning?'가리기':'보이기'}</button><button disabled={recording || !!recorded} onClick={record}>{recorded || (recording?'보관 중…':'오늘 표현에 추가')}</button></>}{selected.length>1 && !picked && <button onClick={group}>함께 묶기</button>}</div>}
    <div className="board-entry-dock">
    <form className="teaching-board-import" aria-label="표현 불러오기" onSubmit={applyExpression} onCompositionStart={() => {composing.current=true;}} onCompositionEnd={() => {composing.current=false;}} onKeyDown={event => {if(event.key==='Enter' && isClassComposing(event,composing.current))event.preventDefault();}}>
      {(panel||results.length>0)&&<div className="board-entry-details">
        {!!results.length&&<div className="board-search-results" aria-label="표현 검색 결과">{results.map((value,i)=><button key={i} type="button" onClick={()=>addExpression(value)}><span><b>{value.text}</b><small>{value.reading} {value.meaning}</small></span><small>{value.label} ＋</small></button>)}</div>}
        {panel&&<><div className="board-entry-detail-heading"><b>{editing?'표현 수정':'읽기와 뜻'}</b><button type="button" aria-label={editing?"수정 취소":"입력 상세 접기"} onClick={cancelEdit}>×</button></div>
        {!!candidates.length&&<div className="teaching-board-candidates" aria-label="한자 후보">{candidates.map(value=><button key={value.text} type="button" onClick={()=>{editVersion.current++;setInput(value.text);setReading(value.reading);lookup(value.text);}}>{value.text}<small>{value.meaning||`${value.level} · 뜻 확인 필요`}</small></button>)}</div>}
        <div className="teaching-board-import-fields"><label>읽기<input value={reading} maxLength={500} onChange={event=>{editVersion.current++;setReading(event.target.value);}}/></label><label>뜻<textarea aria-label="뜻" value={meaning} rows={2} maxLength={500} onChange={event=>{editVersion.current++;setMeaning(event.target.value);}}/></label></div></>}
      </div>}
      <div className="board-entry-line"><label className="board-entry-query"><span className="teaching-board-accessible">단어·표현</span><input ref={inputRef} value={input} maxLength={500} placeholder="표현 입력·찾기" onFocus={()=>setSearching(true)} onChange={event=>{attempt.current++;editVersion.current++;setBusy(false);setInput(event.target.value);setCandidates([]);setReading('');setMeaning('');setSearching(true);}}/></label><button type="button" onClick={()=>{setPanel(v=>!v);setSearching(false);}} aria-expanded={panel} aria-label="읽기와 뜻 입력">＋</button><button type="button" disabled={busy||!input.trim()} onClick={()=>lookup(input)}>{busy?'조회 중…':'사전 찾기'}</button><button type="submit" disabled={!input.trim()} className="board-add-button">{editing?'수정':'바로 놓기'}</button></div>
    </form></div>
    <footer className="teaching-board-footer"><nav aria-label="설명판 페이지">{pages.map((item,i)=><button key={item.id} aria-current={pageId===item.id?'page':undefined} onClick={()=>changePage(item.id)}>{i+1}</button>)}<button onClick={newPage} aria-label="새 판">＋</button></nav><button onClick={()=>revealElements(api.current?.getSceneElements()||[],true)}>전체 보기</button><details><summary>보관</summary><div className="teaching-board-backup-menu"><button onClick={backup}>내려받기</button>{store.recoveries?.map((row,i)=><button key={row.id} onClick={()=>recover(row)}>충돌본 {i+1} 불러오기</button>)}<label className="teaching-board-file">가져오기<input type="file" accept="application/json,.json" onChange={restore}/></label></div></details><small role="status">{store.error?'저장 확인 필요':store.saving?'보관 중…':'이 기기에 보관됨'}</small></footer>
    {(message||store.error)&&<p className="teaching-board-message" role="status">{store.error||message}{store.error&&<><button onClick={backup}>내 내용 백업</button><button onClick={()=>window.location.reload()}>최신 판 열기</button></>}</p>}
    {presenting&&<BoardPresentation elements={presenting} onClose={()=>{presentationActive.current=false;setPresenting(null);}}/>}
  </section>;
}
