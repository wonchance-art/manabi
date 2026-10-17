'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from './supabase';
import { failureMessage } from './errorMessage';

/**
 * 자료(viewer)의 댓글 조회/생성/삭제 훅
 */
/** `enabled` — 비공개 자료는 토론 상대가 없어 조회를 건너뛴다(뷰어 정돈 A안). 기본은 예전대로 켬. */
export function useMaterialComments({ materialId, user, toast, enabled = true }) {
  const commentsQuery = useQuery({
    queryKey: ['material-comments', materialId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_comments')
        .select('id, content, created_at, user_id, author:public_profiles(display_name)')
        .eq('material_id', materialId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!materialId && enabled,
  });

  const addMutation = useMutation({
    mutationFn: async (content) => {
      const { error } = await supabase
        .from('material_comments')
        .insert({ material_id: materialId, user_id: user.id, content });
      if (error) throw error;
    },
    onSuccess: () => commentsQuery.refetch(),
    onError: (err) => toast?.(failureMessage('댓글을 저장하지 못했어요.', err), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId) => {
      const { error } = await supabase
        .from('material_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => commentsQuery.refetch(),
    onError: (err) => toast?.(failureMessage('댓글을 삭제하지 못했어요.', err), 'error'),
  });

  return {
    comments: commentsQuery.data || [],
    refetch: commentsQuery.refetch,
    addMutation,
    deleteMutation,
  };
}
