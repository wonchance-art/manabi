import { Suspense } from 'react';
import Loading from '@/app/(app)/loading';
import NewConversationPage from '@/views/NewConversationPage';

export const metadata = {
  title: '대화',
};

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <NewConversationPage />
    </Suspense>
  );
}
