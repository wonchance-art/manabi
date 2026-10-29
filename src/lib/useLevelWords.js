'use client';
// 레벨 단어 화면 항목 묶음 받기(LEVEL-LIST-RSC-001) — 주소는 서버 페이지가 준다(levelWordsPayload.levelWordsUrl, 같은 주소를 문서 머리에서 preload).
// 같은 화면으로 돌아오면(뒤로 · 다른 레벨에서 다시) 메모리의 묶음을 첫 그림부터 쓴다 — 주소가 배포 판마다 달라 오래 둬도 낡지 않는다.
// 책장 타일이 누르는 순간 시작한 받기(warmLevelWords)가 있으면 그것을 이어받는다.
// 항목을 직접 받은 화면(시험 · 예전 호출)은 그것을 그대로 쓰고 받지 않는다.
import { useQuery } from '@tanstack/react-query';
import { requestLevelWords } from '@/lib/levelWordsPayload';

export function useLevelWords(url, initialGroups = null) {
  const query = useQuery({
    queryKey: ['level-words', url],
    queryFn: ({ signal }) => requestLevelWords(url, { signal }),
    enabled: !initialGroups && !!url,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: 2,
  });
  if (initialGroups) return { groups: initialGroups, failed: false, retry: () => {} };
  return { groups: query.data || null, failed: query.isError && !query.data, retry: () => { query.refetch(); } };
}
