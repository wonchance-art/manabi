'use client';
import { useEffect, useState, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { safeLibraryReturn } from '@/lib/libraryReturn';
import { passageOf, passageLocation, samePassageSource, domPassageRange } from '@/lib/sourcePassage';
import { langNameKo } from '@/lib/constants';

export function PassageSourceFocus({ material, sources }) {
  const [matched, setMatched] = useState(false);
  const scrolledTo = useRef(null);
  const passage = passageOf(material);
  useEffect(() => {
    setMatched(false);
    const item = sources.find(value => samePassageSource(value.source, passage));
    if (!item?.element?.isConnected || !passage?.quote) return;
    const range = domPassageRange(item.element, passage.quote);
    if (!range) return;
    const element = range.startContainer.parentElement;
    if (scrolledTo.current !== material.id) {
      element?.scrollIntoView({ block: 'center', behavior: 'instant' });
      scrolledTo.current = material.id;
    }
    if (typeof Highlight !== 'undefined' && CSS.highlights) {
      CSS.highlights.set('manabi-passage', new Highlight(range)); setMatched(true);
      return () => CSS.highlights.delete('manabi-passage');
    }
  }, [passage, sources, material.id]);
  if (!passage) return null;
  return <aside className="passage-return-notice" aria-label="학습 구간의 출처" role="status">
    <strong>{passageLocation(passage)}에서 고른 부분</strong>
    <p>{matched ? '원본에서 해당 구간을 표시했어요.' : passage.manual ? '직접 입력한 학습 구간이에요. 출처의 쪽·장까지 연결됩니다.' : '보관한 인용을 아래에 표시합니다. 원본의 글이나 판본이 달라 정확히 맞지 않으면 쪽·장과 이 인용으로 확인해 주세요.'}</p>
    {!matched && passage.quote && <blockquote>{passage.quote.exact}</blockquote>}
  </aside>;
}

export default function PassageSources({ material }) {
  const params = useSearchParams();
  const query = useInfiniteQuery({
    queryKey: ['passage-list', material.owner_id, String(material.id)], initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, count, error } = await supabase.from('reading_materials')
        .select('id,title,raw_text,language:processed_json->metadata->language,passage:processed_json->metadata->composer->passage,status:processed_json->>status', { count: 'exact' })
        .eq('owner_id', material.owner_id).eq('processed_json->metadata->composer->>parentId', String(material.id))
        .not('processed_json->metadata->composer->passage', 'is', null)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).range(pageParam, pageParam + 19);
      if (error) throw error;
      return { items: data || [], total: count || 0, offset: pageParam };
    },
    getNextPageParam: page => page.offset + page.items.length < page.total ? page.offset + 20 : undefined,
  });
  if (query.isPending) return <p role="status" className="passage-list-state">학습 구간을 확인하는 중…</p>;
  if (query.isError) return <p role="alert">학습 구간을 불러오지 못했어요. <button onClick={() => query.refetch()}>다시 확인</button></p>;
  const pages = query.data?.pages || [], total = pages[0]?.total || 0;
  if (!total) return null;
  const href = id => `/viewer/${id}?${new URLSearchParams({ study: '1', returnTo: safeLibraryReturn(params.get('returnTo')) })}`;
  return <details className="passage-sources"><summary>학습 구간 {total}</summary><ul>{pages.flatMap(page => page.items).map(item => <li key={item.id}><Link href={href(item.id)}>{passageLocation(item.passage)} · {Array.from(item.raw_text || '').slice(0, 75).join('')}{Array.from(item.raw_text || '').length > 75 ? '…' : ''}<small>{langNameKo(item.language)} · {item.status === 'completed' ? '표현 준비됨' : item.status === 'analyzing' ? '표현 준비 중' : '이어서 준비하기'} ↗</small></Link></li>)}</ul>{query.hasNextPage && <button disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>구간 더 보기</button>}</details>;
}
