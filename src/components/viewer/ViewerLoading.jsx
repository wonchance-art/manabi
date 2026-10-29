import Spinner from '@/components/Spinner';

// 뷰어의 첫 그림(자료 불러오는 중) — ViewerPage의 불러오기 갈래와 같은 마크업. 쪽(page.jsx)이 본문 싣기(VIEWER-SEED-001)를 기다리는
// 경계의 대기 그림으로도 쓴다 — 서버가 본문을 읽는 동안에도 첫 HTML은 지금과 같다.
export default function ViewerLoading() {
  return <div className="page-container"><Spinner message="자료 불러오는 중…" /></div>;
}
