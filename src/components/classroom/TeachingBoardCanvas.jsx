'use client';
import {useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react';
import {Excalidraw, MainMenu, CaptureUpdateAction, convertToExcalidrawElements, newElementWith, getSceneVersion, getCommonBounds, exportToBlob} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import {createPortal} from 'react-dom';
import BoardTools from './BoardTools';
import BoardInkRecognition from './BoardInkRecognition';
import {inkResultKey,planInkPlacement} from '../../lib/teachingInk';
import {quickBoardToolAction} from '../../lib/teachingBoardTools';
import BoardHistory from './BoardHistory';
import BoardIcon, {BoardIconButton} from './BoardIcon';
import Link from 'next/link';
import BoardPresentation from './BoardPresentation';
import {lookupSourceLabel} from '../../lib/classroomLookup';
import {wordRecordSummary} from '../../lib/teachingWordRecord';
import TeachingWord, {WordDisplayControls, useWordAppearance} from './TeachingWord';
import {normalizeWordAppearance, annotatedLanguage} from '../../lib/teachingWordLayout';
import {readBoardWorkspace,writeBoardWorkspace,boardSearch,normalizeBoardWorkspace} from '../../lib/teachingWorkspace';
import {studySelection} from '../../lib/classStudy';
import {supabase} from '../../lib/supabase';
import {boardScope, boardExpression, expressionOf, boardInsertion, replaceBoardPage, BOARD_PAGE_LIMIT, validateBoard} from '../../lib/teachingBoard';
import {useTeachingBoard} from '../../lib/useTeachingBoard';
import {cardSkeleton, cardFields, readCard, rotateCardPart, wordCardSkeleton, expressionElements, arrangeExpressionGroups} from '../../lib/teachingBoardCard';
import {isClassComposing} from '../../lib/classReaderDraft';
import {boardCameraForBounds} from '../../lib/teachingBoardViewport';
import {recognitionElements,recognitionFingerprint,RECOGNITION_IMAGE_LIMIT} from '../../lib/noteRecognition';

export default function TeachingBoardCanvas(props) {
  const {owner, team, day} = props;
  const scope = useMemo(() => boardScope(owner, team.key, day), [owner, team.key, day]);
  const store = useTeachingBoard(scope);
  return <SharedBoardCanvas {...props} scope={scope} store={store}/>;
}

export function SharedBoardCanvas({owner, team, day, rootId, scope, store, personal, onRecord, getRecordState, onLayout, onClose, headerHost, navigation, sessionContent, recordCount=0, onRatio, material, vocabularyIndex, actionsRef, onReady}) {
  const root = useRef(null), api = useRef(null), document = useRef(null), latest = useRef(null), timer = useRef(null), signature = useRef(''), armed=useRef(false), dirty=useRef(false);
  const pendingFocus=useRef(null),focusScene=useRef(null);
  const [initialWorkspace]=useState(()=>readBoardWorkspace(scope,'board'));
  const [ratio,setRatio]=useState(initialWorkspace.ratio),[presenting,setPresenting]=useState(null),[activeTool,setActiveTool]=useState('selection'),[searching,setSearching]=useState(false);
  const inputRef=useRef(null),presentationActive=useRef(false),presentationTrigger=useRef(null),canvasPointers=useRef(new Set()),nativeEditing=useRef(null);
  const [layout, setLayout] = useState(personal ? 'board' : initialWorkspace.layout), [pageId, setPageId] = useState(null), [selected, setSelected] = useState([]), [panel, setPanel] = useState(false);
  const [input, setInput] = useState(initialWorkspace.input), [reading, setReading] = useState(initialWorkspace.reading), [meaning, setMeaning] = useState(initialWorkspace.meaning), [candidates, setCandidates] = useState([]), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null), [recording, setRecording] = useState(false), [menu,setMenu] = useState(null);
  const hud=useRef(null), menuTrigger=useRef(null);
  const [appearance,setAppearance]=useWordAppearance(owner,team.lang);
  const [keepAdding,setKeepAdding]=useState(false),[senses,setSenses]=useState([]);
  const [entrySource,setEntrySource]=useState({kind:'manual'}),[lookupSource,setLookupSource]=useState('');
  const [toolStyle,setToolStyle]=useState({color:'ink',width:2});
  const [hasContent,setHasContent]=useState(null);
  const [capturing,setCapturing]=useState(false),[inkCapture,setInkCapture]=useState(null);
  const captureBusy=useRef(false);
  const toolStyleRef=useRef(toolStyle);toolStyleRef.current=toolStyle;
  const attempt = useRef(0), composing = useRef(false), editVersion = useRef(0), boardSave = useRef(store.save);
  boardSave.current = store.save;
  useEffect(()=>{onLayout(layout);onRatio?.(ratio);},[layout,ratio,onLayout,onRatio]);
  useEffect(()=>{writeBoardWorkspace(scope,{...(editing?readBoardWorkspace(scope):{input,reading,meaning}),layout,ratio});},[scope,layout,ratio,input,reading,meaning,editing]);
  useEffect(()=>{if(!message)return;const timeout=setTimeout(()=>setMessage(''),6500);return()=>clearTimeout(timeout);},[message]);
  const closeMenu=useCallback((restoreFocus=false)=>{setMenu(null);if(restoreFocus)menuTrigger.current?.focus({preventScroll:true});},[]);
  const openMenu=(name,event)=>{if(event?.currentTarget.closest('.board-hud-rail, .board-selection-trigger'))menuTrigger.current=event.currentTarget;setMenu(value=>value===name?null:name);};
  useEffect(()=>{
    if(!menu)return;
    const frame=requestAnimationFrame(()=>{const body=hud.current?.querySelector('.board-popover:not([hidden]) .board-popover-body');const target=menu==='entry'?inputRef.current:body?.querySelector('input, button:not(:disabled), a');target?.focus({preventScroll:true});});
    const outside=event=>{if(!presentationActive.current&&!window.document.querySelector('dialog[open]')&&!hud.current?.contains(event.target))closeMenu();};
    window.document.addEventListener('pointerdown',outside);
    return()=>{cancelAnimationFrame(frame);window.document.removeEventListener('pointerdown',outside);};
  },[menu,closeMenu]);
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
      value.updateScene({appState:{viewBackgroundColor:style.getPropertyValue('--reader-paper').trim(),currentItemStrokeColor:style.getPropertyValue(`--board-${toolStyleRef.current.color}`).trim(),currentItemStrokeWidth:toolStyleRef.current.width},captureUpdate:CaptureUpdateAction.NEVER});
      if(pendingFocus.current)focusScene.current?.();
    });
  },[onReady]);
  useEffect(()=>()=>onReady?.(false),[onReady]);
  useEffect(()=>{
    const release=event=>canvasPointers.current.delete(event.pointerId),clear=()=>canvasPointers.current.clear();
    window.addEventListener('pointerup',release,true);window.addEventListener('pointercancel',release,true);window.addEventListener('blur',clear);
    return()=>{window.removeEventListener('pointerup',release,true);window.removeEventListener('pointercancel',release,true);window.removeEventListener('blur',clear);};
  },[]);
  const revealElements = useCallback((elements, fit = false) => {
    const active=api.current;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(!active || api.current!==active || !root.current || presentationActive.current || canvasPointers.current.size)return;
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
      const insets={top:Math.max(68,toolbar?.height?toolbar.height+Math.max(16,toolbar.top-rect.top):0),bottom:footer?.height?footer.height+Math.max(16,rect.bottom-footer.bottom):0,right:misc?.width?rect.right-misc.left:0};
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
      // Tool rows can disappear when a stroke starts. Reframing at that moment
      // moves the paper under the pen and changes the saved stroke coordinates.
      if(canvasPointers.current.size)return;
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
  const captureInk=async()=>{
    if(captureBusy.current||!api.current||!(personal?.onRecognize||(!personal&&rootId)))return;
    captureBusy.current=true;setCapturing(true);
    try{
      commit();
      const editor=api.current,id=document.current.activePage,ids=Object.keys(editor.getAppState().selectedElementIds).filter(key=>editor.getAppState().selectedElementIds[key]);
      const elements=recognitionElements({id,elements:editor.getSceneElements()},ids);
      const fingerprint=await recognitionFingerprint({id,elements},ids);
      // Only these elements are exported. No embedded scene, files, linked
      // material, or metadata accompanies the raster sent for recognition.
      const blob=await exportToBlob({elements:elements.map(el=>({...el,link:null,customData:undefined,containerId:null,boundElements:[],frameId:null})),appState:{exportBackground:true,viewBackgroundColor:'#ffffff',exportWithDarkMode:false,exportEmbedScene:false},files:{},maxWidthOrHeight:1600,exportPadding:24,mimeType:'image/png'});
      if(!blob||blob.size>RECOGNITION_IMAGE_LIMIT)throw new Error('필기가 너무 커요. 더 작은 부분을 선택해 주세요.');
      const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('필기 이미지를 만들지 못했어요.'));reader.readAsDataURL(blob);});
      if(api.current!==editor||document.current.activePage!==id||fingerprint!==await recognitionFingerprint({id,elements:editor.getSceneElements()},ids))throw new Error('필기가 바뀌었어요. 다시 선택해 주세요.');
      closeMenu();
      const capture={image,pageId:id,elementIds:ids,fingerprint};
      if(personal)personal.onRecognize(capture);else setInkCapture(capture);
    }catch(error){if(root.current)setMessage(error.message);}finally{captureBusy.current=false;if(root.current)setCapturing(false);}
  };
  const isCurrentInk=async capture=>{
    try{
      commit();
      const source=document.current?.pages.find(page=>page.id===capture.pageId);
      const version=getSceneVersion(recognitionElements(source,capture.elementIds));
      const fingerprint=await recognitionFingerprint(source,capture.elementIds);
      commit();
      const latestPage=document.current?.pages.find(page=>page.id===capture.pageId);
      return !!root.current&&fingerprint===capture.fingerprint&&getSceneVersion(recognitionElements(latestPage,capture.elementIds))===version;
    }catch{return false;}
  };
  const placeInk=async(values,capture,{fresh=false,panelWidth=0}={})=>{
    if(!await isCurrentInk(capture)||!api.current)throw new Error('선택한 필기가 바뀌었어요. 닫은 뒤 다시 선택해 주세요.');
    const editor=api.current,elements=editor.getSceneElementsIncludingDeleted(),state=editor.getAppState();
    const existing=values.map(value=>({value,match:document.current.pages.flatMap(page=>page.elements.filter(el=>!el.isDeleted&&expressionOf(el)&&el.customData?.manabiInk===inkResultKey(capture,value.index)).map(el=>({pageId:page.id,id:el.id})))[0]}));
    const pending=existing.filter(item=>!item.match).map(item=>item.value);
    if(!pending.length){const found=existing[0].match;pendingFocus.current={id:found.pageId,elementIds:[found.id]};if(found.pageId!==pageId)changePage(found.pageId,true);else focusScene.current();return {indices:values.map(v=>v.index),existing:true};}
    if(fresh&&document.current.pages.length>=BOARD_PAGE_LIMIT)throw new Error('판이 20개예요. 기존 판의 공간을 확보한 뒤 다시 놓아 주세요.');
    const wide=(root.current?.getBoundingClientRect().width||0)>=900;
    const usableWidth=Math.max(240,state.width-(wide?panelWidth+24:0));
    const width=Math.min(620,Math.max(240,usableWidth-56));
    const paletteValue=palette();
    const bundles=pending.map(value=>{
      const id=crypto.randomUUID(),payload=boardExpression({...appearance,...value,layoutVersion:2},team.lang);
      const skeleton=cardSkeleton(payload,id,{x:0,y:0},paletteValue,width);
      return {id,value,payload,skeleton};
    });
    const workingState=fresh?{...state,scrollX:0,scrollY:0,zoom:{value:1}}:state;
    const positions=planInkPlacement(elements,workingState,bundles.map(item=>item.skeleton[0]),{fresh,panelWidth:wide?panelWidth+24:0});
    if(!positions)return {needsPage:true};
    const cards=bundles.flatMap((item,index)=>{
      const skeleton=cardSkeleton(item.payload,item.id,positions[index],paletteValue,width);
      skeleton[0].customData={...skeleton[0].customData,manabiInk:inkResultKey(capture,item.value.index)};
      return convertToExcalidrawElements(skeleton,{regenerateIds:false});
    });
    armed.current=true;
    if(fresh){
      commit();const id=crypto.randomUUID();
      document.current={...document.current,pages:[...document.current.pages,{id,elements:cards,camera:{scrollX:0,scrollY:0,zoom:{value:1}}}]};
      pendingFocus.current={id,elementIds:cards.map(el=>el.id)};changePage(id,true);
    }else{
      update([...elements,...cards],{appState:{selectedElementIds:Object.fromEntries(cards.map(el=>[el.id,true])),selectedGroupIds:Object.fromEntries(bundles.map(item=>[item.id,true]))}});
      editor.setActiveTool({type:'selection'});commit();
    }
    return {indices:values.map(value=>value.index)};
  };
  focusScene.current=()=>{
    const editor=api.current,request=pendingFocus.current;if(!editor||!request||document.current?.activePage!==request.id)return;
    pendingFocus.current=null;
    const elements=editor.getSceneElements(),targets=elements.filter(el=>request.elementIds.includes(el.id));
    editor.updateScene({appState:{selectedElementIds:Object.fromEntries(targets.map(el=>[el.id,true]))},captureUpdate:CaptureUpdateAction.NEVER});
    revealElements(targets.length?targets:elements,true);
  };
  const changeScene = (elements, state) => {
    if (!pageId) return;
    latest.current = {id: pageId, elements, state};
    const finished=nativeEditing.current&&!state.editingTextElement?nativeEditing.current:null;
    nativeEditing.current=state.editingTextElement?.id||null;
    if(finished){
      const edited=elements.find(el=>el.id===finished&&!el.isDeleted);
      const target=edited&&elements.find(el=>expressionOf(el)?.layoutVersion===2&&el.groupIds?.[0]===edited.groupIds?.[0]);
      const value=target&&readCard(target,elements);
      if(value&&JSON.stringify(value)!==JSON.stringify(expressionOf(target))){
        queueMicrotask(()=>{if(api.current&&latest.current?.id===pageId)api.current.updateScene({elements:rebuildCard(target,value,api.current.getSceneElementsIncludingDeleted()),captureUpdate:CaptureUpdateAction.EVENTUALLY});});
      }
    }
    setHasContent(elements.some(el=>!el.isDeleted));
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
      const payload = boardExpression({...appearance,...value,layoutVersion:2}, value.language||team.lang), elements = api.current.getSceneElementsIncludingDeleted();
      const id = crypto.randomUUID(), width = Math.min(620,Math.max(300,(api.current.getAppState().width||720)-56));
      const style=getComputedStyle(root.current), palette={paper:style.getPropertyValue('--reader-paper').trim(),ink:style.getPropertyValue('--reader-ink').trim(),line:style.getPropertyValue('--reader-line').trim(),accent:style.getPropertyValue('--reader-accent').trim()};
      const skeleton=cardSkeleton(payload,id,{x:0,y:0},palette,width);
      const position=boardInsertion(elements,api.current.getAppState(),skeleton[0].width,skeleton[0].height);
      const card=convertToExcalidrawElements(cardSkeleton(payload,id,position,palette,width),{regenerateIds:false});
      update([...elements,...card],{appState:{selectedElementIds:Object.fromEntries(card.map(el=>[el.id,true])),selectedGroupIds:{[id]:true}}});
      api.current.setActiveTool({type:'selection'});
      // Keep the teacher's camera stable while placing several expressions.
      // Whole-board fit remains an explicit action.
      setMessage('판에 놓았어요. 자유롭게 옮기고 필기하세요.');
      if(!preserveDraft){attempt.current++;setBusy(false);setPanel(false);setSearching(false);setEditing(null);setInput('');setReading('');setMeaning('');setEntrySource({kind:'manual'});setLookupSource('');if(keepAdding){setSearching(true);requestAnimationFrame(()=>inputRef.current?.focus());}else closeMenu(true);}
      return true;
    } catch (error) { setMessage(error.message);return false; }
  };
  // The reader's existing word card can place an expression without consuming
  // the separate board-input draft or posting a student-facing class record.
  useImperativeHandle(actionsRef,()=>({flush:()=>{commit();return document.current;}, focus:(id,elementIds=[])=>{
    if (!document.current?.pages.some(page=>page.id===id)) return false;
    pendingFocus.current={id,elementIds};
    if(id!==pageId)changePage(id);else focusScene.current();
    return true;
  }, place:value=>{
    if(!api.current)return false;
    armed.current=true;
    if(layout==='reader')changeLayout('split');
    return addExpression(value,true);
  }}));
  const anchors=selected.filter(el=>expressionOf(el));
  const anchor=anchors[0];
  const picked=anchor && selected.every(el=>el.groupIds?.includes(anchor.groupIds[0])) ? readCard(anchor,api.current?.getSceneElementsIncludingDeleted() || selected) : null;
  const recorded=picked ? getRecordState?.(picked) : null;
  const editSelected = () => { if (picked) { attempt.current++;editVersion.current++;setBusy(false); setEditing(anchor.id); setInput(picked.text); setReading(picked.reading); setMeaning(picked.meaning); setPanel(true); setCandidates([]);setMenu('entry'); } };
  const applyExpression = event => {
    event.preventDefault(); if (isClassComposing(event, composing.current)) return;
    if (!editing) { addExpression({text:input, reading, meaning, source:entrySource,lookupSource}); return; }
    const elements = api.current.getSceneElementsIncludingDeleted(), target = elements.find(el => el.id === editing && !el.isDeleted), previous = expressionOf(target);
    if (!previous) { setMessage('수정할 표현을 다시 선택해 주세요.'); return; }
    try {
      const next = boardExpression({...readCard(target,elements), text:input, reading, meaning, source:input.trim() === previous.text ? previous.source : {kind:'manual'}}, team.lang);
      reviseCard(target,next);
      cancelEdit();closeMenu(true);setMessage('이 판의 표현을 수정했어요.');
    } catch (error) { setMessage(error.message); }
  };
  const palette=()=>{const style=getComputedStyle(root.current);return {paper:style.getPropertyValue('--reader-paper').trim(),ink:style.getPropertyValue('--reader-ink').trim(),muted:style.getPropertyValue('--reader-muted').trim(),line:style.getPropertyValue('--reader-line').trim(),accent:style.getPropertyValue('--reader-accent').trim()};};
  const rebuildCard=(target,value,elements,{compact=false}={})=>{
    const members=expressionElements(target,elements),fields=cardFields(target,elements);
    const scale=(fields.find(el=>el.customData.manabiField==='text')?.fontSize||42)/42;
    const id=crypto.randomUUID();
    const skeleton=value.layoutVersion===2?wordCardSkeleton(value,id,{x:target.x,y:target.y},palette(),{maxWidth:Math.min(620*scale,Math.max(target.width,300*scale)),scale,compact}):cardSkeleton(value,id,{x:target.x,y:target.y},palette(),target.width,scale);
    const fresh=convertToExcalidrawElements(skeleton,{regenerateIds:false});
    const container={...fresh[0],angle:target.angle};
    const children=fresh.slice(1).map(el=>({...rotateCardPart(el,container,target.angle),groupIds:target.groupIds}));
    const ids=new Set(members.map(el=>el.id));
    return [...elements.map(el=>el.id===target.id?newElementWith(el,{width:container.width,height:container.height,strokeColor:container.strokeColor,backgroundColor:container.backgroundColor,customData:{...el.customData,manabiExpression:value}}):ids.has(el.id)?newElementWith(el,{isDeleted:true}):el),...children];
  };
  const reviseCard=(target,value)=>update(rebuildCard(target,value,api.current.getSceneElementsIncludingDeleted()));
  const applyAppearance=next=>{
    setAppearance(next);
    const elements=api.current.getSceneElementsIncludingDeleted(),changes=new Map();
    for(const target of anchors){
      const value=readCard(target,elements),updated={...value,...normalizeWordAppearance(next)};
      // Legacy cards keep their layout until explicit conversion/compacting.
      if(value.layoutVersion!==2){delete updated.layoutVersion;delete updated.showHun;delete updated.appearance;}
      changes.set(target.id,{customData:{...target.customData,manabiExpression:updated},strokeColor:next.appearance==='card'?palette().line:'transparent',backgroundColor:next.appearance==='card'?palette().paper:'transparent'});
      for(const field of cardFields(target,elements)){
        const key={reading:'showReading',hun:'showHun',meaning:'showMeaning'}[field.customData.manabiField];
        if(key)changes.set(field.id,{opacity:next[key]===false?0:100});
      }
    }
    update(elements.map(el=>changes.has(el.id)?newElementWith(el,changes.get(el.id)):el));
  };
  const compactSelection=()=>{
    let elements=api.current.getSceneElementsIncludingDeleted();
    for(const target of anchors)elements=rebuildCard(target,{...readCard(target,elements),...normalizeWordAppearance(readCard(target,elements))},elements);
    update(elements);setMessage('선택한 표현의 여백을 줄였어요. 되돌리기로 복구할 수 있어요.');
  };
  const arrange=direction=>{
    const elements=api.current.getSceneElementsIncludingDeleted(),moves=arrangeExpressionGroups(anchors,elements,direction);
    update(elements.map(el=>moves.has(el.id)?newElementWith(el,moves.get(el.id)):el));
  };
  const group = () => {
    if (selected.length < 2) return;
    const id = crypto.randomUUID(), ids = new Set(selected.map(el => el.id));
    update(api.current.getSceneElementsIncludingDeleted().map(el => ids.has(el.id) ? newElementWith(el, {groupIds:[...el.groupIds, id]}) : el), {appState:{selectedGroupIds:{[id]:true}}});
    setMessage('표현과 필기를 함께 묶었어요.');
  };
  const lookup = async text => {
    const query=text.trim();if(!query)return;
    const request=++attempt.current,atEdit=editVersion.current;
    setPanel(true);setSearching(false);setBusy(true);setCandidates([]);setSenses([]);setMessage('');
    const local=boardSearch(query,library).find(value=>value.text===query&&value.meaning);
    if(local){setReading(local.reading||'');setMeaning(local.meaning);setEntrySource(local.source||{kind:'manual'});setLookupSource(local.label);setBusy(false);return;}
    if(personal){
      try{
        const response=await fetch(`/api/notes/dictionary?${new URLSearchParams({q:query,language:team.lang})}`,{cache:'no-store'}),data=await response.json();
        if(!response.ok)throw new Error(data.error);
        if(request!==attempt.current||atEdit!==editVersion.current)return;
        setCandidates(data.candidates||[]);setReading(data.reading||'');setSenses(data.senses||[]);setMeaning(data.senses?.[0]?.meaning||'');setLookupSource('내 사전');
        if(!data.senses?.length&&!data.candidates?.length)setMessage('저장된 사전 뜻이 없어요. 수업에서 적은 뜻을 입력해 주세요.');
      }catch(error){if(request===attempt.current)setMessage(error.message);}finally{if(request===attempt.current)setBusy(false);}return;
    }
    try{
      const {data:{session}}=await supabase.auth.getSession();
      const headers={'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token||''}`};
      const isKana=team.lang==='Japanese'&&/^[ぁ-ゖァ-ヶー]+$/.test(query);
      if(isKana){
        const response=await fetch(`/api/classroom/kana?q=${encodeURIComponent(query)}`,{headers});
        const data=await response.json();if(!response.ok)throw new Error();
        if(request!==attempt.current||atEdit!==editVersion.current)return;
        if(data.candidates?.length){setCandidates(data.candidates);setMessage('표기 후보를 고른 뒤 뜻을 확인하세요.');return;}
      }
      const response=await fetch('/api/classroom/lookup',{method:'POST',headers,body:JSON.stringify({text:query,language:team.lang})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      if(request!==attempt.current||atEdit!==editVersion.current)return;
      setReading(data.reading||'');setSenses(data.senses||[]);setMeaning(data.senses?.[0]?.meaning||'');setLookupSource(lookupSourceLabel(data.source));setEntrySource({kind:'manual'});
    }catch(error){if(request===attempt.current&&atEdit===editVersion.current)setMessage(error.message||'사전을 불러오지 못했어요. 입력한 그대로 놓을 수 있어요.');}
    finally{if(request===attempt.current)setBusy(false);}
  };
  const cancelEdit=()=>{attempt.current++;setBusy(false);if(editing){const draft=readBoardWorkspace(scope);setInput(draft.input);setReading(draft.reading);setMeaning(draft.meaning);setEditing(null);}setPanel(false);setSearching(false);};
  const openInput = event => { if(layout==='reader')changeLayout('board');openMenu('entry',event); };
  const chooseTool=type=>{if(layout==='reader')changeLayout('board');api.current?.setActiveTool({type});closeMenu(true);};
  const quickTool=(type,event)=>{
    const action=quickBoardToolAction(type,{activeTool,layout,menu});
    if(!action)return;
    if(action==='select'){menuTrigger.current=event.currentTarget;chooseTool(type);}
    else openMenu('tools',event);
  };
  const styleSelection=(property,value)=>{
    const editor=api.current;if(!editor)return;
    const color=property==='strokeColor'?getComputedStyle(root.current).getPropertyValue(`--board-${value}`).trim():value;
    const key=property==='strokeColor'?'currentItemStrokeColor':'currentItemStrokeWidth';
    setToolStyle(previous=>({...previous,[property==='strokeColor'?'color':'width']:value}));
    const ids=editor.getAppState().selectedElementIds;
    update(editor.getSceneElementsIncludingDeleted().map(el=>ids[el.id]?newElementWith(el,{[property]:color}):el),{appState:{[key]:color}});
  };
  const showInput=event=>{const value=boardExpression({...appearance,text:input,reading,meaning,source:entrySource},team.lang);presentationTrigger.current=event.currentTarget;presentationActive.current=true;setPresenting(convertToExcalidrawElements(wordCardSkeleton(value,crypto.randomUUID(),{x:0,y:0},palette()),{regenerateIds:false}));};
  const showBoard=event=>{commit();const all=api.current?.getSceneElements()||[];const elements=selected.length?selected:all;if(elements.length){presentationTrigger.current=event.currentTarget;presentationActive.current=true;setPresenting(structuredClone(elements));}};
  const resize=(event)=>{
    const rect=root.current?.closest('.viewer-layout')?.getBoundingClientRect();if(!rect)return;
    setRatio(normalizeBoardWorkspace({ratio:100*(event.clientX-rect.left)/rect.width}).ratio);
  };

  const changePage = (id,keepInk=false) => {
    if(!keepInk)setInkCapture(null);
    cancelEdit();
    if(layout==='reader')changeLayout('board');
    onReady?.(false);
    commit(); latest.current = null; signature.current = ''; armed.current=false; dirty.current=false; api.current = null;
    document.current = {...document.current, activePage:id}; store.save(document.current); setHasContent(null); setPageId(id); setSelected([]); setEditing(null); setPanel(false);
  };
  const newPage = () => {
    if (document.current.pages.length >= BOARD_PAGE_LIMIT) { setMessage('한 수업에서 20개 판까지 보관할 수 있어요.'); return; }
    commit(); const id = crypto.randomUUID();
    document.current = {...document.current, pages:[...document.current.pages, {id, elements:[], camera:{scrollX:0,scrollY:0,zoom:{value:1}}}]};
    changePage(id);
  };
  const backup = () => {
    commit();
    if(personal?.onBackup){personal.onBackup();return;}
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
  const record = async (values=null) => {
    if(recording)return;
    const list=values||anchors.map(el=>readCard(el,api.current.getSceneElementsIncludingDeleted())).filter(Boolean);
    if(!list.length)return;
    setRecording(true);let queued=0,failed=0;
    const seen=new Set();
    for(const value of list){
      const key=JSON.stringify([value.language,value.text,value.meaning,value.source]);
      if(seen.has(key)||getRecordState?.(value))continue;seen.add(key);
      try{await onRecord(value);queued++;}catch{failed++;}
    }
    setRecording(false);setMessage(failed?`${failed}개를 추가하지 못했어요. 수업 기록에서 확인하고 다시 시도해 주세요.`:queued?`${queued}개 표현 저장을 요청했어요. 수업 기록에서 완료 상태를 확인하세요.`:'이미 수업에 남긴 표현이에요.');
  };

  if (!store.ready || !pageId) return <div className="teaching-board-loading"><p role="status">{store.error || '보관된 설명판을 불러오고 있어요…'}</p><button onClick={onClose}>교재로 돌아가기</button></div>;
  const page = document.current.pages.find(item => item.id === pageId), pages = document.current.pages;
  const boardHasContent=hasContent??page.elements.some(el=>!el.isDeleted);
  const recent=pages.flatMap(item=>item.elements.filter(el=>!el.isDeleted&&expressionOf(el)).map(el=>({...readCard(el,item.elements),label:'최근 판'}))).reverse();
  const results=searching&&!editing?boardSearch(input,[...recent,...library]):[];
  const menuTitle={main:'전체 메뉴',tools:'필기 도구',entry:editing?'표현 수정':'표현 불러오기',book:'교재와 화면',pages:'설명판 페이지',selection:'선택한 요소',session:'수업 기록'};
  const menuButton=(name,icon,label,extra={})=><BoardIconButton key={name} icon={icon} label={label} aria-expanded={menu===name} aria-controls={`board-menu-${name}`} data-active={menu===name} onClick={event=>openMenu(name,event)} {...extra}/>;
  const popover=(name,children)=><section className={`board-popover board-popover--${name}`} id={`board-menu-${name}`} role="dialog" aria-label={menuTitle[name]} hidden={menu!==name}><div className="board-popover-heading"><b>{menuTitle[name]}</b><BoardIconButton icon="close" label="메뉴 닫기" onClick={()=>closeMenu(true)}/></div><div className="board-popover-body">{menu===name&&(message||store.error)&&<p className="board-menu-notice" role="status">{store.error||message}</p>}{children}</div></section>;
  const workspaceHeader=<div ref={hud} className="teaching-board-header board-hud" onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();if(menu==='entry'&&editing)cancelEdit();closeMenu(true);}}}>
    <nav className="board-hud-rail" aria-label="설명판 메뉴" onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...event.currentTarget.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(window.document.activeElement);buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length]?.focus();}}>
      {menuButton('main','menu','전체 메뉴',{'data-attention':!!store.error})}
      <div className="board-quick-tools" role="group" aria-label="빠른 필기 도구">{[['selection','선택'],['freedraw','펜'],['eraser','지우개']].map(([type,label])=><BoardIconButton key={type} icon={type} label={label} data-pen={type==='freedraw'} style={type==='freedraw'?{'--board-pen-color':`var(--board-${toolStyle.color})`}:undefined} hint={activeTool===type?`${label} · 다시 누르면 도구 설정`:label} aria-pressed={activeTool===type} data-settings={activeTool===type} aria-expanded={activeTool===type&&menu==='tools'} aria-controls="board-menu-tools" onClick={event=>quickTool(type,event)}/>)}</div>
      <BoardIconButton icon="add" label="표현 입력" aria-expanded={menu==='entry'} aria-controls="board-menu-entry" data-active={menu==='entry'} data-draft={!!input.trim()} onClick={openInput}/>
      {menuButton('book','book',personal?'노트 정보':'교재 메뉴')}
    </nav>
    <div className="board-today-trigger">{personal?<BoardIconButton icon="record" label="단어 정리" onClick={()=>{commit();closeMenu();personal.onOrganize();}}><span className="board-count" aria-label={`미완료 표현 ${personal.pendingCount||0}개`}>{personal.pendingCount||0}</span></BoardIconButton>:<BoardIconButton icon="record" label={`오늘 표현 ${recordCount}개`} aria-expanded={menu==='session'} aria-controls="board-menu-session" onClick={event=>{menuTrigger.current=event.currentTarget;setMenu(v=>v==='session'?null:'session');}}><span className="board-count">{recordCount}</span></BoardIconButton>}</div>
    <div className="board-hud-status" role="status" aria-label={store.error?'저장 확인 필요':store.saving?'보관 중…':personal?.saveLabel||'이 기기에 보관됨'} title={store.error?'저장 확인 필요':store.saving?'보관 중…':personal?.saveLabel||'이 기기에 보관됨'} data-error={!!store.error} data-saving={store.saving}><span/></div>
    {popover('main',<><section className="board-menu-section" aria-label="판과 도구"><span>판과 도구</span><div className="board-icon-grid">
      {menuButton('tools','freedraw','필기 도구 메뉴')}
      {menuButton('pages','pages','페이지 메뉴')}
      <BoardIconButton icon="present" label="보여주기" disabled={!boardHasContent} onClick={showBoard}/>
      <BoardIconButton icon="fit" label="전체 보기" onClick={()=>{if(layout==='reader')changeLayout('board');closeMenu(true);revealElements(api.current?.getSceneElements()||[],true);}}/>
    </div></section><section className="board-menu-section" aria-label="수업과 이동"><span>수업과 이동</span><div className="board-icon-grid">
      <Link href="/home" aria-label="웹앱 홈" title="웹앱 홈" data-label="웹앱 홈" onClick={commit} className="board-icon-button"><BoardIcon name="home"/></Link>
      {personal?<BoardIconButton icon="book" label="내 서재" onClick={personal.onLeave}/>:<Link href={`/class/${team.key}`} aria-label="팀 홈" title="팀 홈" data-label="팀 홈" onClick={commit} className="board-icon-button"><BoardIcon name="team"/></Link>}
      <BoardIconButton icon="record" label={personal?'단어 정리':'수업 기록'} onClick={()=>{if(personal){commit();closeMenu();personal.onOrganize();}else setMenu('session');}}/>
      <BoardIconButton icon="close" label="설명판 닫기" onClick={()=>{commit();onClose();}}/>
    </div></section><section className="board-menu-section" aria-label="백업"><span>백업</span><div className="board-icon-grid">
      <BoardIconButton icon="download" label="내려받기" onClick={backup}/>
      <label className="teaching-board-file board-icon-button" title="가져오기"><BoardIcon name="upload"/><input type="file" accept="application/json,.json" aria-label="가져오기" onChange={restore}/></label>
    </div></section><p className="board-menu-caption">{team.name} · {day}</p><p className="board-menu-caption">{store.error?'저장 확인 필요':store.saving?'보관 중…':personal?.saveLabel||'이 기기에 보관됨'}</p>
    {store.error&&<p className="board-menu-caption" role="status">{store.error}<button onClick={backup}>내 내용 백업</button><button onClick={()=>window.location.reload()}>최신 판 열기</button></p>}
    {store.recoveries?.map((row,i)=><button className="board-recovery-button" key={row.id} onClick={()=>recover(row)}>충돌본 {i+1} 불러오기</button>)}</>)}
    {popover('tools',<><BoardHistory canvasRoot={root} pageId={pageId} onAction={()=>closeMenu(true)}/><BoardTools active={activeTool} style={toolStyle} onTool={chooseTool} onStyle={styleSelection}/></>)}
    {popover('book',<>{!personal&&<nav className="board-icon-grid" aria-label="설명판 보기">{[['board','설명판','board'],['split','함께','split'],['reader','교재','book']].map(([value,label,icon])=><BoardIconButton key={value} icon={icon} label={label} aria-pressed={layout===value} onClick={()=>{changeLayout(value);closeMenu(true);}}/>)}</nav>}{navigation}</>)}
    {popover('pages',<nav className="board-page-grid" aria-label="설명판 페이지">{pages.map((item,i)=><button key={item.id} aria-label={`${i+1}번 판`} aria-current={pageId===item.id?'page':undefined} onClick={()=>{changePage(item.id);closeMenu(true);}}><BoardIcon name="board"/><span>{i+1}</span></button>)}<BoardIconButton icon="add" label="새 판" onClick={()=>{newPage();closeMenu(true);}}/></nav>)}
    {popover('selection',<>
      <div className="board-selection-summary">{anchors.length?`${anchors.length}개 표현 선택`: '필기 선택'}</div>
      {!!anchors.length&&<WordDisplayControls language={team.lang} value={picked||readCard(anchor,api.current?.getSceneElementsIncludingDeleted()||[])} onChange={applyAppearance} appearance/>}
      <div className="board-icon-grid" aria-label="선택한 요소 도구">
        <BoardIconButton icon="present" label="선택한 내용 보여주기" disabled={!selected.length} onClick={showBoard}/>
        {(personal?.onRecognize||(!personal&&rootId))&&<BoardIconButton icon="reading" label={capturing?'필기 준비 중…':'선택한 필기 인식'} disabled={capturing||!!inkCapture||!selected.length} onClick={captureInk}/>}
        {picked&&<BoardIconButton icon="edit" label="내용 수정" onClick={editSelected}/>}
        {!!anchors.length&&<><BoardIconButton icon="fit" label="여백 줄이기" onClick={compactSelection}/>{!personal&&<BoardIconButton icon="record" label={recorded||(recording?'저장 요청 중…':anchors.length>1?`선택한 ${anchors.length}개 수업에 남기기`:'수업에 남기기')} disabled={recording||!!recorded} onClick={()=>record()}/>}</>}
        {anchors.length>1&&<><BoardIconButton icon="row" label="나란히 정렬" onClick={()=>arrange('row')}/><BoardIconButton icon="column" label="세로로 정렬" onClick={()=>arrange('column')}/></>}
        {selected.length>1&&!picked&&<BoardIconButton icon="group" label="함께 묶기" onClick={group}/>}
      </div>
    </>)}
    {popover('session',sessionContent)}
    {popover('entry',<form className="teaching-board-import" aria-label="표현 불러오기" onSubmit={applyExpression} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}} onKeyDown={event=>{if(event.key==='Enter'&&isClassComposing(event,composing.current))event.preventDefault();}}>
      <div className="board-entry-line"><label className="board-entry-query"><span className="teaching-board-accessible">단어·표현</span><input ref={inputRef} value={input} maxLength={500} placeholder="표현 입력·찾기" onFocus={()=>setSearching(true)} onChange={event=>{attempt.current++;editVersion.current++;setBusy(false);setInput(event.target.value);setCandidates([]);setSenses([]);setReading('');setMeaning('');setEntrySource({kind:'manual'});setLookupSource('');setSearching(true);}}/></label><BoardIconButton icon="more" label="읽기와 뜻 입력" aria-expanded={panel} onClick={()=>{setPanel(v=>!v);setSearching(false);}}/></div>
      {!!results.length&&<div className="board-search-results" aria-label="표현 검색 결과">{results.map((value,i)=><button key={i} type="button" onClick={()=>{attempt.current++;setBusy(false);setInput(value.text);setReading(value.reading||'');setMeaning(value.meaning||'');setEntrySource(value.source||{kind:'manual'});setLookupSource(value.label||'');setPanel(true);setSearching(false);}}><span><b>{value.text}</b><small>{value.reading} {value.meaning}</small></span><small>{value.label} ＋</small></button>)}</div>}
      {input.trim()&&<div className="board-word-preview"><TeachingWord entry={{text:input,reading,meaning}} language={team.lang} display={appearance}/>{lookupSource&&<small>{lookupSource}</small>}</div>}
      <details className="board-display-options"><summary>표시</summary><WordDisplayControls language={team.lang} value={appearance} onChange={setAppearance} appearance/></details>
      {panel&&<div className="board-entry-details">
        {senses.length>1&&<div className="board-senses" role="group" aria-label="수업에서 쓸 뜻 선택">{senses.map((sense,i)=><button type="button" key={i} aria-pressed={meaning===sense.meaning} onClick={()=>{editVersion.current++;setMeaning(sense.meaning);}}>{sense.meaning}{sense.pos&&<small>{sense.pos}</small>}</button>)}</div>}
        {!!candidates.length&&<div className="teaching-board-candidates" aria-label="한자 후보">{candidates.map(value=><button key={value.text} type="button" onClick={()=>{editVersion.current++;setInput(value.text);setReading(value.reading);lookup(value.text);}}>{value.text}<small>{value.meaning||`${value.level} · 뜻 확인 필요`}</small></button>)}</div>}
        <div className="teaching-board-import-fields">{annotatedLanguage(team.lang)&&<label>읽기<input value={reading} maxLength={500} onChange={event=>{editVersion.current++;setReading(event.target.value);}}/></label>}<label>뜻<textarea aria-label="뜻" value={meaning} rows={2} maxLength={500} onChange={event=>{editVersion.current++;setMeaning(event.target.value);}}/></label></div>
      </div>}
      {!editing&&<label className="board-keep-adding"><input type="checkbox" checked={keepAdding} onChange={event=>setKeepAdding(event.target.checked)}/>계속 추가</label>}
      <div className="board-entry-actions"><BoardIconButton icon="search" label={busy?'조회 중…':'사전 찾기'} disabled={busy||!input.trim()} onClick={()=>lookup(input)}/>{!editing&&<BoardIconButton icon="present" label="크게 보기" disabled={!input.trim()} onClick={showInput}/>} {!editing&&!personal&&<BoardIconButton icon="record" label="수업에 남기기" disabled={!input.trim()||recording} onClick={()=>record([{text:input,reading,meaning,source:entrySource,language:team.lang}])}/>} {editing&&<BoardIconButton icon="close" label="수정 취소" onClick={()=>{cancelEdit();closeMenu(true);}}/>}<BoardIconButton type="submit" icon="check" label={editing?'수정':'바로 놓기'} disabled={!input.trim()} className="board-add-button"/></div>
    </form>)}
    {inkCapture&&!personal&&<BoardInkRecognition rootId={rootId} team={team} capture={inkCapture} isCurrent={isCurrentInk} onPlace={placeInk} onClose={()=>{setInkCapture(null);requestAnimationFrame(()=>hud.current?.querySelector('.board-selection-trigger button, .board-hud-rail button')?.focus({preventScroll:true}));}} appearance={appearance} onAppearance={setAppearance}/>}
    {layout!=='reader'&&selected.length>0&&<div className="board-selection-trigger">{menuButton('selection','edit','선택한 요소 편집')}</div>}
  </div>;
  return <section ref={root} className="teaching-board" data-menu={menu||''} onPointerDownCapture={event=>{armed.current=true;if(event.target.matches?.('canvas.interactive'))canvasPointers.current.add(event.pointerId);}} onKeyDownCapture={()=>{armed.current=true;}} onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){cancelEdit();closeMenu(true);}}} aria-label={personal?"개인 학습 노트":"선생님 설명판"}>
    {headerHost?createPortal(workspaceHeader,headerHost):workspaceHeader}
    {layout==='split'&&<div className="board-divider" role="separator" tabIndex={0} aria-label="설명판 너비" aria-orientation="vertical" aria-valuemin={40} aria-valuemax={72} aria-valuenow={Math.round(ratio)} onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);resize(event);}} onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))resize(event);}} onPointerUp={event=>event.currentTarget.releasePointerCapture(event.pointerId)} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();setRatio(value=>event.key==='Home'?40:event.key==='End'?72:normalizeBoardWorkspace({ratio:value+(event.key==='ArrowLeft'?-2:2)}).ratio);}}}/>}
    <div className="teaching-board-surface">
      <Excalidraw key={pageId} excalidrawAPI={connectCanvas} initialData={{elements:page.elements,appState:{...page.camera,currentItemFontFamily:2,currentItemRoughness:0,currentItemStrokeWidth:2}}}
        onChange={changeScene} langCode="ko-KR" handleKeyboardGlobally={false} autoFocus={false}
        validateEmbeddable={false}
        onLinkOpen={(_,event) => event.preventDefault()} onPaste={data => {if(data.files?.length || data.elements?.some(el=>['image','iframe','embeddable'].includes(el.type))){setMessage('이 설명판에는 글자와 필기를 보관할 수 있어요.');return false;}return true;}}
        UIOptions={{canvasActions:{loadScene:false,export:false,saveToActiveFile:false,clearCanvas:false,changeViewBackgroundColor:false,toggleTheme:false},tools:{image:false}}}>
        <MainMenu><MainMenu.Item onSelect={backup}>설명판 백업</MainMenu.Item></MainMenu>
      </Excalidraw>
    </div>
    {!boardHasContent&&<div className="board-empty-hint" aria-label="설명판 시작 안내"><div aria-hidden="true"><BoardIcon name="freedraw"/><BoardIcon name="add"/><BoardIcon name="book"/></div><p>펜으로 쓰거나, ＋로 표현을 놓아보세요.</p><span>{personal?'글자와 표현은 오른쪽 위에서 한 번에 정리할 수 있어요.':'교재에서 고른 표현도 바로 가져올 수 있어요.'}</span></div>}
    <div className="teaching-board-accessible">{(latest.current?.elements || page.elements).filter(el=>!el.isDeleted && expressionOf(el)).map(el=>{const value=readCard(el,latest.current?.elements || page.elements);return value && <p key={el.id} data-board-expression={el.id}>{value.text} · {value.showReading?value.reading:""} · {value.showMeaning?value.meaning:""}</p>;})}</div>
    {!menu&&(message||store.error)&&<p className="teaching-board-message" role="status">{store.error||message}{store.error&&<><button onClick={backup}>내 내용 백업</button><button onClick={()=>window.location.reload()}>최신 판 열기</button></>}</p>}
    {presenting&&<BoardPresentation elements={presenting} onRecord={personal?undefined:()=>record(presenting.filter(el=>expressionOf(el)).map(el=>readCard(el,presenting)))} recording={recording} recordState={wordRecordSummary(presenting.filter(el=>expressionOf(el)).map(el=>getRecordState?.(readCard(el,presenting))))} returnFocus={presentationTrigger.current} onClose={()=>{presentationActive.current=false;setPresenting(null);}}/>}
  </section>;
}
