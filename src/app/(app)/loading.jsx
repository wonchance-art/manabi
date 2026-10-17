import Spinner from '@/components/Spinner';

export default function Loading() {
  return (
    // 0.4초 안에 끝나는 대기(구간 골격 코드를 받는 짧은 틈)에서는 보이지 않는다 — 스피너 → 골격 → 화면 두 번 바뀜 방지(/ux-review 2026-10-17 KST).
    // CSS만으로 늦춘다(index.css .route-loading). 글은 처음부터 문서에 있어 화면 읽기는 그대로다(opacity만 0).
    <div className="page-container route-loading">
      <Spinner message="화면 불러오는 중…" />
    </div>
  );
}
