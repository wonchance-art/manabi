import { Suspense } from 'react';
import NewConversationPage from '@/views/NewConversationPage';

export const metadata = {
  title: '대화',
};

export default function Page() {
  return (
    <Suspense>
      <NewConversationPage />
    </Suspense>
  );
}
