'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {readTeachingBoard, saveTeachingBoard, preserveTeachingBoardRecovery} from './teachingBoardStore';
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

// Recovery is an explicit read-and-replace action. It never PUTs the original
// note, and a stable import key makes an uncertain archive POST safe to retry.
export function recoverStudyNote(run, request = requestNote, flush = () => {}) {
  if (run.recovering) return run.recovering;
  if (!run.alive || !run.value) return Promise.reject(new Error('노트를 다시 열어 주세요.'));
  const controller = new AbortController();
  run.recoveryController = controller;
  const call = (url, options) => request(url, {...options, signal: controller.signal});
  run.recovering = (async () => {
    await run.syncing?.catch(() => {});
    await run.localQueue.catch(() => {});
    const generation = run.generation;
    const unchanged = () => {
      flush();
      if (!run.alive) throw new Error('노트가 닫혔어요.');
      if (generation !== run.generation) throw new Error('확인하는 동안 내용이 바뀌었어요. 현재 초안을 유지했으니 다시 눌러 주세요.');
    };
    unchanged();
    // Check access before creating a private recovery copy under this session.
    let remote = await call(`/api/notes/${run.id}`);
    unchanged();
    if (run.dirty || run.blocked) {
      await preserveTeachingBoardRecovery(run.scope, localDocument(run.value, true), run.writer);
      unchanged();
      if (run.recoveryAttempt?.generation !== generation) {
        const snapshot = structuredClone(run.value);
        run.recoveryAttempt = {generation, body: {
          title: `${snapshot.title.slice(0, 190)} · 내 초안`,
          document: {...snapshot.document, key: crypto.randomUUID()},
        }};
      }
      const attempt = run.recoveryAttempt;
      if (!attempt.result) attempt.result = await call('/api/notes', {method: 'POST', body: JSON.stringify(attempt.body)});
      const copy = attempt.result;
      const sameOrigin = (copy?.document?.origin?.materialId || null) === (attempt.body.document.origin?.materialId || null);
      // The API may refresh the linked material title while preserving its ID.
      const comparable = copy?.document ? {...copy, document: {...copy.document, origin: attempt.body.document.origin}} : null;
      if (!/^\d+$/.test(String(copy?.id)) || !sameOrigin || !comparable || !sameStudyNote(comparable, attempt.body)) {
        throw new Error('초안 사본을 확인하지 못했어요. 현재 내용을 유지했으니 다시 시도해 주세요.');
      }
      run.recoveryId = String(attempt.result.id);
      unchanged();
      remote = await call(`/api/notes/${run.id}`);
      unchanged();
    }
    if (String(remote.id) !== run.id || remote.document?.key !== run.value.document.key) throw new Error('최신 노트의 정보를 확인하지 못했어요.');
    remote = {...remote, document: validateStudyNote(remote.document)};
    const install = run.localQueue.catch(() => {}).then(async () => {
      unchanged();
      const latest = await readTeachingBoard(run.scope);
      unchanged();
      if (latest?.revision !== run.localRevision && latest?.document.personalNote?.dirty) {
        await preserveTeachingBoardRecovery(run.scope, latest.document, crypto.randomUUID());
        unchanged();
      }
      const saved = await saveTeachingBoard(run.scope, latest?.revision || null, localDocument(remote, false), run.writer);
      run.localRevision = saved.revision;
      if (run.alive && generation !== run.generation) {
        await preserveTeachingBoardRecovery(run.scope, localDocument(run.value, true), run.writer);
      }
      unchanged();
      run.value = remote; run.dirty = false; run.blocked = false;
    });
    run.localQueue = install;
    await install;
    return {value: run.value, recoveryId: run.recoveryId || null};
  })().catch(error => {
    if (run.alive) run.blocked = true;
    throw error;
  }).finally(() => {run.recovering = null; run.recoveryController = null;});
  return run.recovering;
}

export default function useStudyNote(owner, id) {
  const [state, setState] = useState({ready: false, value: null, saving: false, error: '', conflict: false, recovering: false, recoveryId: null, epoch: 0});
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
    if (!run?.alive || !run.value || run.blocked || run.recovering) throw new Error('노트 저장 상태를 먼저 확인해 주세요.');
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
    const run = {alive: true, id: String(id), value: null, scope: noteScope(owner, id), writer: crypto.randomUUID(), generation: 0, localRevision: null, localQueue: Promise.resolve(), dirty: false, blocked: false};
    session.current = run;
    setState({ready: false, value: null, saving: false, error: '', conflict: false, recovering: false, recoveryId: null, epoch: 0});
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
    return () => { run.alive = false; run.recoveryController?.abort(); clearTimeout(timer.current); };
  }, [owner, id, persist, publish, sync]);

  const change = useCallback(patch => {
    const run = session.current;
    if (!run?.alive || !run.value) return;
    const next = {...run.value, ...patch};
    try { next.document = validateStudyNote(next.document); } catch (error) { publish(run, {error: error.message}); throw error; }
    run.value = next; run.dirty = true; run.generation++;
    publish(run, {value: next, saving: !run.blocked && !run.recovering});
    persist(run).catch(error => { if (error.code === 'board_conflict') run.blocked = true; publish(run, {error: error.message, saving: false, conflict: run.blocked}); });
    clearTimeout(timer.current); timer.current = setTimeout(() => sync().catch(() => {}), 1000);
  }, [persist, publish, sync]);
  useEffect(() => {
    const online = () => sync().catch(() => {});
    const protect = event => { if (session.current?.dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('online', online); window.addEventListener('beforeunload', protect);
    return () => { window.removeEventListener('online', online); window.removeEventListener('beforeunload', protect); };
  }, [sync]);
  const reload = useCallback(async (flush) => {
    const run = session.current;
    if (!run?.alive || !run.value) return;
    clearTimeout(timer.current);
    const existing = run.recovering;
    if (existing) return existing;
    publish(run, {recovering: true});
    try {
      const result = await recoverStudyNote(run, requestNote, flush);
      if (!run.alive) return;
      setState(previous => ({...previous, value: result.value, saving: false, error: '', conflict: false, recovering: false, recoveryId: result.recoveryId, epoch: previous.epoch + 1}));
      return result;
    } catch (error) {
      publish(run, {recovering: false, saving: false, conflict: run.blocked, recoveryId: run.recoveryId || null, error: error.message});
      throw error;
    }
  }, [publish]);
  const current = useCallback(() => session.current?.value, []);
  return {...state, change, sync, current, reload};
}
