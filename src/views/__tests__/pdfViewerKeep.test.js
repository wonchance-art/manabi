import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 계약: v2-H R3 — PDF 뷰어 중복 정리 **유지 확정** (오너 "ㄱㄱ", 2026-08-31).
 *
 * H 설계의 R3은 「PDF 뷰어의 자체 단어 팝업·자체 vocab 저장을 없앨 것인가」를 오너
 * 결정으로 남겼고, Claude 권고는 **유지**였다. 그 결정을 여기 심는다.
 *
 * ── 왜 유지인가
 *
 * R1이 놓은 다리(`이 부분부터 읽기`)는 PDF 범위를 **자료로 만들어** 일반 뷰어로 보낸다.
 * 그때 읽는 것은 **추출된 텍스트**지 원본 지면이 아니다. 도표·레이아웃이 있는 교재
 * 지면을 **원본 그대로 보면서 단어만 훑는** 용도는 그 다리로 대체되지 않는다.
 * 없애면 그 용도가 사라지고, 얻는 것은 440줄짜리 화면에서 코드 몇十 줄뿐이다.
 *
 * ── 착수 실측이 「중복」의 실체를 다시 정의했다
 *
 * 설계는 이것을 「PDF 뷰어의 중복 기능」이라 불렀는데, 실측하면 중복은 **기능이 아니라
 * 저장 페이로드**다 — `user_vocabulary` upsert가 **6곳**에 흩어져 있고 PDF 뷰어는 그중
 * 하나일 뿐이다(ViewerPage · PdfViewerPage · QuickPage · StudySessionPage ·
 * NpcDialog · progressStore). 팝업을 지워도 나머지 5곳의 중복은 그대로 남는다.
 * 그 중복은 별건으로 #1077에 적립했다 — 여기서 고칠 것이 아니다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const pdf = () => read('src/views/PdfViewerPage.jsx');

describe('H R3 — PDF 뷰어의 고유 용도를 지킨다', () => {
  it('자체 단어 팝업이 살아 있다 — 원본 지면을 보며 단어를 훑는 길이다', () => {
    // 지우자는 제안이 다시 오면 이 계약이 먼저 잡고, 위 주석이 이유를 말한다.
    const src = pdf();
    expect(src).toContain('setWordDetail');
    expect(src).toContain('pdf-detail-popup');
  });

  it('자체 vocab 저장이 살아 있다 — 팝업만 남기고 저장을 떼면 반쪽이 된다', () => {
    expect(pdf()).toMatch(/from\('user_vocabulary'\)\s*\.upsert\(/);
  });

  it('R1의 다리는 그대로다 — 유지 결정이 다리를 대신하지 않는다', () => {
    // 둘은 대체 관계가 아니라 역할 분담이다(원본 열람·범위 고르기 ↔ 읽기·학습).
    // 다리는 문자열이 아니라 컴포넌트로 마운트돼 있다(`PdfReadBridge`) — 처음엔 카피를
    // 찾다 헛짚었다. 계약은 **실물**에 걸어야 한다.
    const src = pdf();
    expect(src, 'PDF → 자료 전환 입구가 사라지면 R1이 죽는다').toContain('<PdfReadBridge');
    expect(src).toContain("import PdfReadBridge");
  });
});

describe('H R3 — 중복의 실체는 저장 페이로드다', () => {
  it('user_vocabulary 저장이 여러 곳에 흩어져 있다 — 팝업을 지워도 안 줄어든다', () => {
    // 이 계약은 "중복을 없애라"가 아니라 **"팝업 제거가 중복 해소가 아니다"**를 고정한다.
    // 수치가 줄면(정본으로 수렴하면) 이 검사는 갱신 대상이지 위반이 아니다 — 그때는
    // 아래 주석과 #1077 적립 건을 함께 정리한다.
    const sites = [
      'src/views/ViewerPage.jsx',
      'src/views/PdfViewerPage.jsx',
      'src/views/QuickPage.jsx',
      'src/views/StudySessionPage.jsx',
      'src/components/world/NpcDialog.jsx',
    ].filter((f) => /from\('user_vocabulary'\)[\s\S]{0,40}upsert/.test(read(f)));
    expect(sites.length, 'PDF 뷰어는 6곳 중 하나일 뿐이다').toBeGreaterThanOrEqual(4);
    expect(sites).toContain('src/views/PdfViewerPage.jsx');
  });
});
