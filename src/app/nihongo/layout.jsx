// 일본어 30일(/nihongo) — (app) 레이아웃 밖이라 v2 셸 토큰이 닿지 않아 옛 갈색 팔레트가 남아 있었다(화면 벽 WALL-003, 2026-11-02 KST).
// 루트 404와 같은 방식으로 v2 셸 토큰을 직접 입는다(COLOR-V2-UNIFY-001) — 셸은 늘 밝은 화면이다.
import '@/components/books/reading-shell.css';
import '@/components/web/web-shell.css';

export default function NihongoLayout({ children }) {
  return <div className="manabi-app" style={{ minHeight: '100dvh' }}>{children}</div>;
}
