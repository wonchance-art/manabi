'use client';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { parseTitle, findNextInSeries } from './seriesMeta';

const LEVEL_NEXT = { N5: 'N4', N4: 'N3', N3: 'N2', N2: 'N1', A1: 'A2', A2: 'B1', B1: 'B2', B2: 'C1' };

/**
 * 시리즈 자료 navigation hook.
 * @returns {{ prevLesson, nextLesson, seriesEndCard }}
 *   - prevLesson/nextLesson: 같은 (level, series)의 num-1 / num+1
 *   - seriesEndCard: nextLesson이 없을 때 다음 시리즈 또는 다음 레벨 진학 안내
 */
export function useSeriesNeighbors(materialId, materialTitle) {
  const { data: seriesNeighbors } = useQuery({
    queryKey: ['series-neighbors', materialId, materialTitle],
    queryFn: async () => {
      const meta = parseTitle(materialTitle || '');
      if (!meta.level || !meta.series || meta.num == null) return { prev: null, next: null, position: null };
      const { data } = await supabase
        .from('reading_materials')
        .select('id, title')
        .eq('visibility', 'public')
        .ilike('title', `[${meta.level} ${meta.series} #%`)
        .limit(50);
      const items = (data || []).map(m => ({ ...m, _meta: parseTitle(m.title) }));
      const prev = items
        .filter(x => x._meta.num != null && x._meta.num < meta.num)
        .sort((a, b) => b._meta.num - a._meta.num)[0] || null;
      const next = findNextInSeries(meta, data || []);
      const total = items.filter(x => x._meta.num != null).length;
      return {
        prev: prev ? { id: prev.id, title: prev.title } : null,
        next: next || null,
        position: { current: meta.num, total, level: meta.level, series: meta.series },
      };
    },
    enabled: !!materialTitle,
    staleTime: 1000 * 60 * 10,
  });
  const prevLesson = seriesNeighbors?.prev || null;
  const nextLesson = seriesNeighbors?.next || null;
  const seriesPosition = seriesNeighbors?.position || null;

  const { data: seriesEndCard } = useQuery({
    queryKey: ['series-end', materialId, materialTitle, nextLesson?.id ?? 'none'],
    queryFn: async () => {
      const meta = parseTitle(materialTitle || '');
      if (!meta.level || !meta.series || meta.num == null) return null;
      if (nextLesson) return null;

      const { data: same } = await supabase
        .from('reading_materials')
        .select('id, title')
        .eq('visibility', 'public')
        .ilike('title', `[${meta.level}%#%`)
        .limit(50);
      const otherSeries = (same || [])
        .map(m => ({ ...m, _meta: parseTitle(m.title) }))
        .filter(c => c._meta.series && c._meta.series !== meta.series && c._meta.num === 1)
        .sort((a, b) => (a._meta.series || '').localeCompare(b._meta.series || ''));
      if (otherSeries[0]) {
        return { type: 'series', level: meta.level, fromSeries: meta.series, material: { id: otherSeries[0].id, title: otherSeries[0].title } };
      }

      const nextLevel = LEVEL_NEXT[meta.level];
      if (!nextLevel) return { type: 'top', level: meta.level, fromSeries: meta.series };
      const { data: nl } = await supabase
        .from('reading_materials')
        .select('id, title')
        .eq('visibility', 'public')
        .ilike('title', `[${nextLevel}%#%`)
        .limit(50);
      const nlc = (nl || [])
        .map(m => ({ ...m, _meta: parseTitle(m.title) }))
        .filter(c => c._meta.num === 1)
        .sort((a, b) => (a._meta.series || '').localeCompare(b._meta.series || ''));
      if (nlc[0]) {
        return { type: 'level', level: meta.level, nextLevel, fromSeries: meta.series, material: { id: nlc[0].id, title: nlc[0].title } };
      }
      return { type: 'top', level: meta.level, fromSeries: meta.series };
    },
    enabled: !!materialTitle,
    staleTime: 1000 * 60 * 10,
  });

  return { prevLesson, nextLesson, seriesEndCard, seriesPosition };
}
