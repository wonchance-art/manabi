import CohortsPage from '@/views/CohortsPage';
import { buildRefManifest } from '@/content/refManifest';

export const metadata = {
  title: '클래스 | Anatomy Studio',
  description: '기수제 학습 클래스 — 같은 시기에 함께 진도를 맞추는 코호트 과정.',
};

export default function Page() {
  return <CohortsPage refManifest={buildRefManifest()} />;
}
