'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {emptyBoard} from './teachingBoard';
import {readTeachingBoard, readTeachingBoardRecoveries, saveTeachingBoard} from './teachingBoardStore';

export function useTeachingBoard(scope) {
  const [state, setState] = useState({ready: false, error: '', saving: false, document: null});
  const current = useRef(null), generation = useRef(null);
  useEffect(() => {
    const run = {alive: true, scope, revision: null, writer: crypto.randomUUID(), chain: Promise.resolve(), dirty: false, blocked: false};
    generation.current = run;
    Promise.all([readTeachingBoard(scope),readTeachingBoardRecoveries(scope)]).then(([row,recoveries]) => {
      if (!run.alive) return;
      run.revision = row?.revision || null;
      current.current = row?.document || emptyBoard(crypto.randomUUID());
      run.document=current.current;
      setState({ready: true, error: '', saving: false, document: current.current, recoveries});
    }).catch(error => { if (run.alive) setState({ready: false, error: error.message, saving: false, document: null}); });
    return () => { run.alive = false; };
  }, [scope]);

  const save = useCallback(document => {
    const run = generation.current;
    if (!run || run.scope !== scope) return Promise.resolve();
    current.current = document;
    run.document=document;
    run.dirty = true;
    if(run.alive) setState(previous => ({...previous, document, saving: true}));
    run.chain = run.chain.catch(() => {}).then(async () => {
      if (!run.dirty) return;
      run.dirty = false;
      const snapshot = run.document;
      try {
        const result = await saveTeachingBoard(scope, run.revision, snapshot, run.writer);
        run.revision = result.revision;
        if (run.alive && !run.dirty) setState(previous => ({...previous, saving: false, error: ''}));
      } catch (error) {
        if (error.code === 'board_conflict') run.blocked = true;
        if (run.alive) setState(previous => ({...previous, saving: false, error: error.message}));
      }
    });
    return run.chain;
  }, [scope]);
  return {...state, save, snapshot: () => current.current, flush: () => generation.current?.chain};
}
