'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { friendlyToastMessage } from './errorMessage';

/**
 * 문법 분석 결과를 grammar_notes 테이블에 저장.
 */
export function useGrammarNoteSave({ user, materialId, selectedText, explanation, toast }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('grammar_notes').insert({
        user_id: user.id,
        material_id: materialId,
        selected_text: selectedText,
        explanation,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grammar-notes', user?.id] });
      toast?.('📝 문법 노트에 저장됐어요!', 'success');
    },
    onError: (err) => toast?.('저장 실패 — ' + friendlyToastMessage(err), 'error'),
  });
}
