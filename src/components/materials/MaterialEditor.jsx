'use client';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { documentError, readEditableMaterial } from '@/lib/materialDocument';
import { safeLibraryReturn } from '@/lib/libraryReturn';
import { ComposerForm } from './MaterialComposer';

export default function MaterialEditor() {
  const { id } = useParams();
  const params = useSearchParams();
  const returnTo = safeLibraryReturn(params.get('returnTo') || '/materials?view=owned');
  const { user, loading } = useAuth();
  const query = useQuery({ queryKey: ['material-edit', id, user?.id], enabled: !!user,
    queryFn: () => readEditableMaterial(supabase, id, user.id), retry: false, refetchOnWindowFocus: false, staleTime: 0 });
  if (loading || (user && (query.isPending || query.isFetching))) return <section className="composer-gate" role="status">수정할 자료를 불러오고 있어요…</section>;
  if (!user) return <section className="composer-gate"><h1>내 자료를 수정하려면</h1><Link className="manabi-button" href={`/auth?from=${encodeURIComponent(`/materials/${id}/edit`)}`}>로그인하고 수정하기 ↗</Link></section>;
  if (query.isError) return <section className="composer-gate" role="alert"><h1>자료를 열지 못했어요.</h1><p>{documentError(query.error) || '연결 상태를 확인한 후 다시 시도해 주세요.'}</p><button className="manabi-button" onClick={() => query.refetch()}>다시 불러오기</button><Link className="manabi-link" href="/materials?view=owned">내 서재로</Link></section>;
  if (!Object.hasOwn(query.data, 'document_json')) return <section className="composer-gate"><h1>수정 기능을 준비하고 있어요.</h1><p>{documentError(new Error('EDIT_SCHEMA_PENDING'))}</p><Link className="manabi-button" href={`/viewer/${id}`}>자료로 돌아가기</Link></section>;
  return <ComposerForm key={`${user.id}:${id}:${query.data.document_json?.revision || 'original'}`} ownerId={user.id} material={query.data} returnTo={returnTo} />;
}
