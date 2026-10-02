'use client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { learningLanguageCapabilities } from './learningCapabilities';

// Account-scoped evidence from the authenticated deployed-contract endpoint.
export function useLearningCapabilities(language) {
  const { user } = useAuth();
  const korean = language === 'Korean';
  const query = useQuery({
    queryKey: ['learning-capabilities', user?.id],
    enabled: korean && !!user?.id,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/learning/capabilities', { signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Learning capabilities unavailable');
      return response.json();
    },
    staleTime: 0,
    retry: false,
  });
  const ready = !korean || (!!user?.id && query.isSuccess && !query.isError && !query.isFetching);
  return { ...learningLanguageCapabilities(language, ready ? query.data : null),
    isLoading: korean && !!user?.id && (query.isPending || query.isFetching),
    isError: korean && query.isError };
}
