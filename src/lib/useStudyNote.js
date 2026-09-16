'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {readTeachingBoard, saveTeachingBoard} from './teachingBoardStore';
import {noteScope, validateStudyNote, sameStudyNote} from './studyNotes';

export async function requestNote(url, options) {
  const response = await fetch(url, {...options, cache: 'no-store', headers: {'Content-Type': 'application/json', ...options?.headers}});
  const value = await response.json();
  if (!response.ok) throw Object.assign(new Error(value.error || '노트를 저장하지 못했어요.'), {status: response.status, detail: value});
  return value;
}

// Reuse the board's transactional local revisions and recovery copies. The
// private envelope is scoped by account + stable note ID, never team/date.
function localDocument(value, dirty) {
  const {board, ...note} = value.document;
  return {...board, personalNote: {note, title: value.title, revision: value.revision, dirty}};
}
function fromLocal(row, id) {
  if (!row?.document?.personalNote) return null;
  const {personalNote, ...board} = row.document;
  return {id: String(id), title: personalNote.title, revision: personalNote.revision, document: validateStudyNote({...personalNote.note, board}), dirty: personalNote.dirty};
}

export default function useStudyNote(owner, id) {
  const [state, setState] = useState({ready: false, value: null, saving: false, error: '', conflict: false});
  const session = useRef(null), timer = useRef(null);
  const publish = useCallback((run, patch) => { if (run.alive) setState(previous => ({...previous, ...patch})); }, []);
  const persist = useCallback(async (run) => {
    const snapshot = run.value, dirty = run.dirty;
    run.localQueue = run.localQueue.catch(() => {}).then(async () => {
      const row = await saveTeachingBoard(run.scope, run.localRevision, localDocument(snapshot, dirty), run.writer);
      run.localRevision = row.revision;
    });
    await run.localQueue;
  }, []);
  const sync = useCallback(async () => {
    const run = session.current;
    if (!run?.alive || !run.value || run.blocked) throw new Error('노트 저장 상태를 먼저 확인해 주세요.');
    clearTimeout(timer.current);
    if (run.syncing) { await run.syncing; if (run.dirty) return sync(); return run.value; }
    if (!run.dirty) return run.value;
    const snapshot = run.value, generation = run.generation;
    publish(run, {saving: true, error: ''});
    run.syncing = (async () => {
      let result;
      try {
        result = await requestNote(`/api/notes/${id}`, {method: 'PUT', body: JSON.stringify({title: snapshot.title, document: snapshot.document, revision: run.value.revision})});
      } catch (error) {
        // A lost successful response is reconciled before any write retry.
        try {
          const remote = await requestNote(`/api/notes/${id}`);
          if (sameStudyNote(remote,snapshot)) result = remote;
          else if (remote.revision !== run.value.revision) throw Object.assign(new Error('다른 기기에서 수정한 노트가 있어요. 내 초안은 새 노트로 보관할 수 있습니다.'), {status: 409});
        } catch (check) { if (check.status === 409) error = check; }
        if (!result) throw error;
      }
      run.value = {...run.value, revision: result.revision, ...(generation === run.generation ? {title:result.title} : {})};
      if (generation === run.generation) run.dirty = false;
      await persist(run);
      publish(run, {value: run.value, saving: run.dirty, error: ''});
      return run.value;
    })().catch(error => {
      if (error.status === 409 || error.code === 'board_conflict') run.blocked = true;
      publish(run, {saving: false, conflict: run.blocked, error: error.message});
      throw error;
    }).finally(() => { run.syncing = null; });
    await run.syncing;
    if (run.dirty) return sync();
    return run.value;
  }, [id, persist, publish]);

  useEffect(() => {
    const run = {alive: true, value: null, scope: noteScope(owner, id), writer: crypto.randomUUID(), generation: 0, localRevision: null, localQueue: Promise.resolve(), dirty: false, blocked: false};
    session.current = run;
    setState({ready: false, value: null, saving: false, error: '', conflict: false});
    (async () => {
      let cached = null, localError = '';
      try { const row = await readTeachingBoard(run.scope); run.localRevision = row?.revision || null; cached = fromLocal(row, id); } catch { localError = '기기 초안 보관을 사용할 수 없어요. 창을 닫기 전에 계정 저장 상태를 확인하세요.'; }
      if(!run.alive)return;
      try {
        const remote = await requestNote(`/api/notes/${id}`);
        if(!run.alive)return;
        run.dirty = !!cached?.dirty && !sameStudyNote(cached,remote);
        run.value = run.dirty ? {...cached, id: remote.id} : remote;
        run.blocked = run.dirty && cached.revision !== remote.revision;
        publish(run, {ready: true, value: run.value, conflict: run.blocked, error: run.blocked ? '다른 기기의 수정과 내 초안이 겹쳤어요. 내 초안을 새 노트로 보관할 수 있습니다.' : localError});
        if (!run.blocked) { await persist(run); if (run.dirty && run.alive) sync().catch(() => {}); }
      } catch (error) {
        // Revoked/deleted notes must not be resurrected from an offline cache.
        if (cached && ![401,403,404].includes(error.status)) { run.value = cached; run.dirty = !!cached.dirty; publish(run, {ready: true, value: cached, error: '연결되지 않아 이 기기의 노트를 열었어요. 연결 후 계정에 저장하세요.'}); }
        else publish(run, {error: error.message});
      }
    })();
    return () => { run.alive = false; clearTimeout(timer.current); };
  }, [owner, id, persist, publish, sync]);

  const change = useCallback(patch => {
    const run = session.current;
    if (!run?.alive || !run.value) return;
    const next = {...run.value, ...patch};
    try { next.document = validateStudyNote(next.document); } catch (error) { publish(run, {error: error.message}); throw error; }
    run.value = next; run.dirty = true; run.generation++;
    publish(run, {value: next, saving: !run.blocked});
    persist(run).catch(error => { if (error.code === 'board_conflict') run.blocked = true; publish(run, {error: error.message, saving: false, conflict: run.blocked}); });
    clearTimeout(timer.current); timer.current = setTimeout(() => sync().catch(() => {}), 1000);
  }, [persist, publish, sync]);
  useEffect(() => {
    const online = () => sync().catch(() => {});
    const protect = event => { if (session.current?.dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('online', online); window.addEventListener('beforeunload', protect);
    return () => { window.removeEventListener('online', online); window.removeEventListener('beforeunload', protect); };
  }, [sync]);
  const current = useCallback(() => session.current?.value, []);
  return {...state, change, sync, current};
}
