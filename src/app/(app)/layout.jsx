import Layout from '@/components/Layout';
import LanguageGate from '@/components/LanguageGate';

export default function AppLayout({ children }) {
  return (
    <LanguageGate>
      <Layout>{children}</Layout>
    </LanguageGate>
  );
}
