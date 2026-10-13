import Spinner from '@/components/Spinner';

export default function Loading() {
  return (
    <div className="page-container">
      <Spinner message="화면 불러오는 중…" />
    </div>
  );
}
