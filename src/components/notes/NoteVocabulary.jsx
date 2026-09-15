'use client';
import {useEffect, useRef, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {noteCandidatePayload} from '@/lib/studyNotes';
import {requestNote} from '@/lib/useStudyNote';
import BoardIcon from '@/components/classroom/BoardIcon';

export default function NoteVocabulary({saved, noteId, note, onChange, onFocus, onClose, sync}) {
  const queryClient = useQueryClient(), working = useRef(false);
  const alive = useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const [busy, setBusy] = useState(false), [lookupId, setLookupId] = useState(null), [choices, setChoices] = useState({}), [outcomes, setOutcomes] = useState({}), [notice, setNotice] = useState('');
  const [showExcluded, setShowExcluded] = useState(false);
  const rows = note.candidates.filter(row => showExcluded || !row.excluded);
  const selected = rows.filter(row => row.reviewed && !row.excluded && !row.vocabularyId && row.text.trim() && row.meaning.trim());
  const patch = (id, value) => onChange(current => current.map(row => row.id === id ? {...row, ...value} : row));
  function edit(id, value) { patch(id, {...value, reviewed: false, vocabularyId: undefined}); setOutcomes(current => ({...current, [id]: undefined})); }
  async function lookup(row) {
    setLookupId(row.id); setNotice('');
    try {
      const result = await requestNote(`/api/notes/dictionary?${new URLSearchParams({q: row.text, language: row.language})}`);
      if(!alive.current)return;
      setChoices(current => ({...current, [row.id]: {...result,query:row.text}}));
      // A delayed lookup must not overwrite an edit made while it was running.
      onChange(current=>current.map(item=>{
        if(item.id!==row.id||item.text!==row.text||item.reading!==row.reading||item.meaning!==row.meaning)return item;
        if(result.senses?.length===1&&!item.meaning)return {...item,meaning:result.senses[0].meaning,reading:item.reading||result.reading,reviewed:false};
        return !item.reading&&result.reading?{...item,reading:result.reading,reviewed:false}:item;
      }));
      if (!result.senses?.length && !result.candidates?.length) setNotice('저장된 사전 뜻이 없어요. 노트에서 배운 뜻을 적어 주세요.');
    } catch (error) { setNotice(error.message); } finally { setLookupId(null); }
  }
  async function saveRows(list, confirmation = {}) {
    if (working.current || !list.length) return;
    working.current = true; setBusy(true); setNotice('');
    let created = 0, linked = 0, failed = 0;
    try {
      // Persist the reviewed candidate first. The server resolves its text and
      // meaning from that private note, not a client-supplied vocabulary row.
      await sync();
      for (const row of list) {
        try {
          const result = await requestNote('/api/learning/vocabulary', {method: 'POST', body: JSON.stringify({...noteCandidatePayload(noteId, row), ...(confirmation[row.id] || {})})});
          result.created ? created++ : linked++;
          patch(row.id, {vocabularyId: result.vocabularyId});
          setOutcomes(current => ({...current, [row.id]: {ok: true, text: result.created ? '새로 담음' : '기존 단어에 문맥 연결'}}));
        } catch (error) { failed++; setOutcomes(current => ({...current, [row.id]: {...error.detail, error: error.message}})); }
      }
      await sync();
      setNotice(`새 단어 ${created}개 · 기존 단어 ${linked}개 연결${failed ? ` · 확인/재시도 ${failed}개` : ''}`);
      queryClient.invalidateQueries({predicate: query => /vocab|learning-summary/.test(String(query.queryKey[0]))});
    } catch (error) { setNotice(error.message); }
    finally { working.current = false; setBusy(false); }
  }
  const inkCount = note.board.pages.reduce((count, page) => count + page.elements.filter(el => !el.isDeleted && el.type === 'freedraw').length, 0);
  return <aside className="note-review" tabIndex={-1} aria-label="노트 단어 정리" aria-busy={busy} onKeyDown={event=>{if(event.key==='Escape'&&!event.nativeEvent.isComposing&&!busy){event.preventDefault();event.stopPropagation();onClose();}}}>
    <header><div><small>MY WORDS</small><h2>단어 정리<span>.</span></h2></div><button className="note-icon" aria-label="단어 정리 닫기" disabled={busy} onClick={onClose}><BoardIcon name="close"/></button></header>
    <p className="note-review-intro">표기와 뜻을 확인한 표현을 선택하세요. 필기 원본은 그대로 남아요.</p>
    <div className="note-review-actions"><button disabled={busy} onClick={()=>onChange(current=>current.map(row=>!row.excluded&&!row.vocabularyId&&row.text.trim()&&row.meaning.trim()?{...row,reviewed:true}:row))}>뜻 있는 항목 모두 선택</button><label><input type="checkbox" checked={showExcluded} onChange={event=>setShowExcluded(event.target.checked)}/>제외한 항목</label></div>
    <div className="note-review-scroll">
      {!rows.length&&<div className="note-review-empty"><h3>노트에서 표현을 모아 보세요.</h3><p>＋로 놓은 단어와 글자 도구로 적은 내용을 정리할 수 있어요. ‘표현 → 뜻’으로 적으면 한 줄씩 연결됩니다.</p></div>}
      {inkCount>0&&<p className="note-review-hint">펜으로 그린 손글씨는 아직 자동 인식하지 않습니다. 글자 도구의 입력창에서는 기기가 지원하는 필기 입력을 사용할 수 있어요.</p>}
      {saved.isError&&<p role="status">기존 단어 목록을 불러오지 못했어요. 저장할 때 중복을 다시 확인합니다. <button onClick={()=>saved.refetch()}>다시 확인</button></p>}
      {rows.map(row => {
        const outcome = outcomes[row.id], choicesForRow = choices[row.id]?.query===row.text?choices[row.id]:null;
        const existing = saved.data?.find(item => item.language === row.language && (item.word_text === (row.base || row.text) || item.base_form === (row.base || row.text)));
        return <article key={row.id} className="note-candidate" data-excluded={row.excluded} data-saved={!!row.vocabularyId}>
          <div className="note-candidate-top"><label className="note-check"><input aria-label={`${row.text} 선택`} type="checkbox" checked={row.reviewed && !row.excluded} disabled={busy||row.excluded||!!row.vocabularyId||!row.text.trim()||!row.meaning.trim()} onChange={event=>patch(row.id,{reviewed:event.target.checked})}/><span>{row.vocabularyId?'저장됨':existing?'이미 담은 표현':'새 표현'}</span></label><button className="note-origin" onClick={()=>onFocus(row)}>원래 필기 ↗</button></div>
          <div className="note-word-fields"><div>{['Japanese','Chinese'].includes(row.language)&&<input aria-label={`${row.text} 읽기`} className="note-reading" value={row.reading} disabled={busy} placeholder="읽기" maxLength={500} onChange={event=>edit(row.id,{reading:event.target.value})}/>}<input aria-label="표현 표기" className="note-spelling" lang={row.language==='Japanese'?'ja':row.language==='Chinese'?'zh':undefined} value={row.text} disabled={busy} maxLength={300} onChange={event=>edit(row.id,{text:event.target.value,base:''})}/></div><textarea aria-label={`${row.text} 뜻`} value={row.meaning} disabled={busy} maxLength={2000} placeholder="이 노트에서의 뜻" rows={2} onChange={event=>edit(row.id,{meaning:event.target.value})}/></div>
          <div className="note-candidate-tools"><button disabled={busy||lookupId!==null||!row.text.trim()} onClick={()=>lookup(row)}>{lookupId===row.id?'찾는 중…':row.language==='Japanese'?'한자·사전':'사전'}</button><button disabled={busy} onClick={()=>patch(row.id,{excluded:!row.excluded,reviewed:false})}>{row.excluded?'다시 포함':'제외'}</button><details><summary>원문·기본형</summary><p>{row.original}</p><label>기본형<input value={row.base} maxLength={300} placeholder={row.text} disabled={busy} onChange={event=>edit(row.id,{base:event.target.value})}/></label></details></div>
          {!!choicesForRow?.candidates?.length&&<div className="note-choices" aria-label={`${row.text} 한자 후보`}>{choicesForRow.candidates.map(candidate=><button key={candidate.text} disabled={busy} onClick={()=>{edit(row.id,{text:candidate.text,base:'',reading:candidate.reading,meaning:row.meaning||candidate.meaning||''});setChoices(current=>({...current,[row.id]:null}));}}><b>{candidate.text}</b><small>{candidate.meaning||'뜻 확인 필요'}</small></button>)}<button onClick={()=>setChoices(current=>({...current,[row.id]:null}))}>가나 그대로</button></div>}
          {choicesForRow?.senses?.length>1&&<div className="note-choices" aria-label="뜻 후보">{choicesForRow.senses.map((sense,index)=><button key={index} disabled={busy} onClick={()=>edit(row.id,{meaning:sense.meaning})}>{sense.meaning}</button>)}</div>}
          {outcome?.error&&<div className="note-row-error" role="status"><p>{outcome.error}</p>{outcome.code==='meaning_conflict'&&outcome.existing&&<><p>기존 뜻: {outcome.existing.meaning}</p><button disabled={busy} onClick={()=>saveRows([row],{[row.id]:{confirmId:outcome.existing.id,confirmMeaning:outcome.existing.meaning}})}>같은 뜻이에요 · 문맥만 연결</button></>}</div>}
          {outcome?.ok&&<p className="note-saved" role="status">{outcome.text}</p>}
        </article>;
      })}
    </div>
    <footer>{notice&&<p role="status">{notice}</p>}<button className="manabi-button" disabled={busy||!selected.length} onClick={()=>saveRows(selected)}>{busy?'선택한 표현 담는 중…':`선택한 ${selected.length}개 담기`}</button><small>기존 단어의 뜻과 복습 일정은 유지됩니다.</small></footer>
  </aside>;
}
