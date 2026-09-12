'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { readUnlock } from '../../lib/classClient';
import { fetchTeamRoot } from '../../lib/classTeamQueries';
import { classSourceRequest, cachedClassSource } from '../../lib/classHistoryNavigation';
import { resolveClassSource, sourceFromClassNote } from '../../lib/classSource';

export default function ClassSourceFocus({ material, user, params, onResolve, tokenRefs }) {
  const [state, setState] = useState(null), [retry, setRetry] = useState(0);
  const callback = useRef(onResolve);
  callback.current = onResolve;
  const request = classSourceRequest(params);
  const key = request ? `${request.team}:${request.note}:${request.entry}` : '';
  const legacyQuote = params.get('sourceQuote'), legacyToken = params.get('sourceToken');
  const hasRecord = params.has('sourceEntry');
  useEffect(() => {
    if (!key && !legacyQuote) { setState(hasRecord ? { message: '수업 기록에서 표현을 다시 열어 주세요.' } : null); return; }
    if (!material?.processed_json?.sequence?.length) return;
    let alive = true, frame;
    const controller = new AbortController();
    setState({ loading: true });
    (async () => {
      try {
        let source, ownBook = false;
        const root = key && !material.__local && user?.id && material.owner_id === user.id
          ? await fetchTeamRoot(user.id, request.team) : null;
        if (!key) source = { quote: legacyQuote, tokenId: legacyToken };
        else if (material.__local) {
          if (material.__team !== request.team) throw new Error('수업 자료를 다시 열어 주세요.');
          source = cachedClassSource(sessionStorage, request);
          if (!source) throw new Error('수업 기록에서 표현을 다시 열어 주세요.');
        } else if (root?.owner_id === user?.id && root) {
          // Owners use RLS directly and never need a student unlock token.
          if (!root?.processed_json?.metadata?.team?.bookKey || root.processed_json.metadata.team.bookKey !== material.processed_json.metadata?.book?.key) throw new Error('현재 수업 교재의 위치를 확인하지 못했어요.');
          const { data: note, error } = await supabase.from('reading_materials').select('id,raw_text,processed_json').eq('id', request.note).eq('owner_id', user.id).maybeSingle();
          if (error) throw new Error('수업 기록을 불러오지 못했어요.');
          if (note?.processed_json?.metadata?.team?.key !== request.team || note?.processed_json?.metadata?.team?.root) throw new Error('수업 기록을 확인하지 못했어요.');
          source = sourceFromClassNote(note, request.entry);
          ownBook = true;
        } else {
          const token = readUnlock(request.team)?.token;
          if (!token) throw new Error('수업 페이지에서 암호를 다시 입력해 주세요.');
          const response = await fetch(`/api/class/${request.team}/source?${new URLSearchParams({ sourceNote: request.note, sourceEntry: request.entry })}`, { signal: controller.signal, headers: { 'x-class-token': token }, cache: 'no-store' });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || '교재 위치를 불러오지 못했어요.');
          source = result.source;
        }
        if (!alive) return;
        const sourceId = material.__local || ownBook ? material.id : material.processed_json.metadata?.source_ref || material.id;
        if (key && (!source || String(source.materialId) !== String(sourceId))) throw new Error('이 자료에 해당하는 수업 위치를 확인하지 못했어요.');
        const target = resolveClassSource(material.processed_json, source);
        if (!target) {
          setState({ message: '정확한 위치를 찾지 못했어요. 교재 내용이 바뀌었거나 같은 표현이 여러 곳에 있습니다.', quote: source?.quote });
          return;
        }
        callback.current(target, source);
        setState(null);
        frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
          if (alive) tokenRefs.current[target.first]?.scrollIntoView({ block: 'center', behavior: 'instant' });
        }); });
      } catch (error) {
        if (alive && error.name !== 'AbortError') setState({ message: error.message, retry: !!key && !material.__local });
      }
    })();
    return () => { alive = false; controller.abort(); cancelAnimationFrame(frame); };
    // Re-resolve if the loaded text/segmentation changes. The callback itself
    // must not restart this navigation when the learner subsequently selects a word.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material?.id, material?.processed_json, material?.owner_id, user?.id, key, hasRecord, legacyQuote, legacyToken, retry]);
  if (!state) return null;
  return <div className="classroom-notice" role="status">{state.loading ? '수업에서 선택한 위치를 찾는 중…' : <>{state.message}{state.quote && <p>{state.quote}</p>}{state.retry && <button onClick={() => setRetry(value => value + 1)}>다시 찾기</button>}</>}</div>;
}
