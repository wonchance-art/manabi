// 단어장 데이터 레이어 — vocab 쿼리 + 데이터 뮤테이션(채점/삭제/일괄삭제/편집/CSV가져오기).
// 수동 추가는 모달 UI 상태와 묶여 있어 VocabPage에 남겨둔다.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { friendlyToastMessage } from './errorMessage';
import { fetchVocab, csvToVocabRows } from './vocabIO';

export function useVocabData() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: vocab = [], isLoading } = useQuery({
    queryKey: ['vocab', user?.id],
    queryFn: () => fetchVocab(user.id),
    enabled: !!user,
  });

  const scoreMutation = useMutation({
    mutationFn: async ({ id, nextStats }) => {
      const payload = { ...nextStats, last_reviewed_at: new Date().toISOString() };
      const { error } = await supabase
        .from('user_vocabulary')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });
    },
    onError: (err) => toast('업데이트 실패 — ' + friendlyToastMessage(err), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('user_vocabulary')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });
      toast('단어를 삭제했습니다.', 'info');
    },
    onError: (err) => toast('삭제 실패 — ' + friendlyToastMessage(err), 'error'),
  });

  // CSV 불러오기
  const csvImportMutation = useMutation({
    mutationFn: async (file) => {
      const text = await file.text();
      const rows = csvToVocabRows(text, user.id);
      if (rows.length === 0) throw new Error('유효한 행이 없습니다.');
      if (rows.length > 5000) throw new Error('한 번에 5000개까지만 가져올 수 있어요.');

      // 500개씩 배치 upsert
      let imported = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase
          .from('user_vocabulary')
          .upsert(chunk, { onConflict: 'user_id,word_text', ignoreDuplicates: true });
        if (error) throw error;
        imported += chunk.length;
      }
      return imported;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });
      toast(`${count}개 단어를 가져왔어요. (중복은 자동 스킵)`, 'success', 5000);
    },
    onError: (err) => toast('가져오기 실패 — ' + friendlyToastMessage(err), 'error'),
  });

  // 개별 단어 편집 (word_text/furigana/meaning/pos)
  const updateVocabMutation = useMutation({
    mutationFn: async ({ id, updates }) => {
      const allowed = {};
      if (typeof updates.word_text === 'string') allowed.word_text = updates.word_text.trim().slice(0, 200);
      if (typeof updates.furigana === 'string') allowed.furigana = updates.furigana.trim().slice(0, 200);
      if (typeof updates.meaning === 'string') allowed.meaning = updates.meaning.trim().slice(0, 500);
      if (typeof updates.pos === 'string') allowed.pos = updates.pos.trim().slice(0, 50);
      if (Object.keys(allowed).length === 0) throw new Error('변경할 내용이 없어요');
      const { error } = await supabase
        .from('user_vocabulary')
        .update(allowed)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });
      toast('단어를 수정했어요', 'success');
    },
    onError: (err) => toast('수정 실패 — ' + friendlyToastMessage(err), 'error'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      if (!ids?.length) return 0;
      const { error } = await supabase
        .from('user_vocabulary')
        .delete()
        .in('id', ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });
      toast(`${count}개 단어를 삭제했습니다.`, 'info');
    },
    onError: (err) => toast('일괄 삭제 실패: ' + err.message, 'error'),
  });

  return {
    vocab,
    isLoading,
    scoreMutation,
    deleteMutation,
    csvImportMutation,
    updateVocabMutation,
    bulkDeleteMutation,
  };
}
