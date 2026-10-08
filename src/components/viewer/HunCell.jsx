// 표제어 글자 아래 훈음 루비 셀(VIEWER-V2-ROUNDS-001 §2.1 표제어 덩어리 · AE-R1 설계서 §2). 값은 hunRubyCells(R0+ 단일
// 조회 hanjaReadingsOf)가 만든다. 칸 폭은 CSS가 --hun-n(훈음 글꼴 em)로 벌리고, 넘치면 훈/음 두 줄(lines)이다.
// 흐름 배치만 쓴다 — 절대배치·잘라내기 0(겹침 0은 e2e viewer-hun-layout이 잰다).
export default function HunCell({ cell }) {
  if (!cell?.label || !cell.lines?.length) return null;
  return (
    <span className="word-fit__hun" lang="ko" data-label={cell.label} data-wrap={cell.wrap ? '1' : undefined}
      style={{ '--hun-n': cell.hunN }}>
      {cell.lines.map((line, i) => <span key={i} className="word-fit__hun-line">{line}</span>)}
    </span>
  );
}
