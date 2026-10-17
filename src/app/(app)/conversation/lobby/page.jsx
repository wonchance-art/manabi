import { Suspense } from 'react';
import Loading from '@/app/(app)/loading';
import ConversationLobbyPage from '@/views/ConversationLobbyPage';

export const metadata = {
  title: '모두의 대화방',
};

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <ConversationLobbyPage />
    </Suspense>
  );
}
