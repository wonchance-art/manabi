'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { friendlyToastMessage } from './errorMessage';

/**
 * 자료 제목 편집 hook (owner만).
 * @returns {{ titleEditing, setTitleEditing, titleDraft, setTitleDraft, updateTitleMutation }}
 */
export function useTitleEdit(materialId, toast) {
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const queryClient = useQueryClient();

  const updateTitleMutation = useMutation({
    mutationFn: async (newTitle) => {
      const title = newTitle.trim().slice(0, 200);
      if (!title) throw new Error('제목이 비어있어요');
      const { error } = await supabase
        .from('reading_materials')
        .update({ title })
        .eq('id', materialId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material', materialId] });
      setTitleEditing(false);
      toast?.('제목을 수정했어요', 'success');
    },
    onError: (err) => toast?.('제목 수정 실패 — ' + friendlyToastMessage(err), 'error'),
  });

  return { titleEditing, setTitleEditing, titleDraft, setTitleDraft, updateTitleMutation };
}
