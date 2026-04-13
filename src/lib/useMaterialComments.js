'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from './supabase';

/**
 * 자료(viewer)의 댓글 조회/생성/삭제 훅
 */
export function useMaterialComments({ materialId, user, toast }) {
  const commentsQuery = useQuery({
    queryKey: ['material-comments', materialId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_comments')
        .select('id, content, created_at, user_id, author:profiles(display_name)')
        .eq('material_id', materialId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!materialId,
  });

  const addMutation = useMutation({
    mutationFn: async (content) => {
      const { error } = await supabase
        .from('material_comments')
        .insert({ material_id: materialId, user_id: user.id, content });
      if (error) throw error;
    },
    onSuccess: () => commentsQuery.refetch(),
    onError: (err) => toast?.('댓글 저장 실패: ' + err.message, 'error'),
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
    onError: (err) => toast?.('삭제 실패: ' + err.message, 'error'),
  });

  return {
    comments: commentsQuery.data || [],
    refetch: commentsQuery.refetch,
    addMutation,
    deleteMutation,
  };
}
