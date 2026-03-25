import Spinner from '@/components/Spinner';

export default function Loading() {
  return (
    <div className="page-container">
      <Spinner message="로딩 중..." />
    </div>
  );
}
