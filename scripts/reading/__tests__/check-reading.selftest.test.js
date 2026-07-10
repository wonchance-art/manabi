import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// 독해 검증기의 결함 자가 검출 — spawnSync로 --self-test 호출(exit 0 = 전종 검출).
// 기존 22종(G1·G4·G5·G6·Q·DR + 강화: P1-2 리터럴 하드게이트 3·P1-3 まだです 경계·P1-5 드릴 미커버·
// P2-10 중첩 지명·G7 강등·YLOCK 가나-온리 오염·오쿠리가나 くます·락 미등재·G4 どちらも·문항 id) +
// 4종(G4 v3 형태소: ① だ→まだ。copula ② たり 문장 제거 ③ そして→そしたら · P3-7 ④ YLOCK-gone
// 승격) = 26종. ①②③은 락 재생성으로 YLOCK을 침묵시켜 G4(형태소)가 단독 검출함을 증명한다.
// + 신유형(order/fill/produce, P4) 5종(order 순열 불일치·fill ［　］ 0개·produce 단독 커버로 인한
// Q-cover 실패·게이트 문항 "본문에서" 발문 Q-style·신유형 id 누락) = 31종.
// + order/fill 원소 스키마·Q-style 회상형 우회 5종(P2-4·P3-7: 빈 문자열 타일·비문자열 동일 객체
// 양배열·불량 accept·"본문을 보고"·줄바꿈 변형) = 36종.
// + Q-style 어휘 확장 2종(P3-9: "본문에 제시된 표현"·"본문 속 문장" — 열거 밖 동의어 우회) = 38종.
describe('check-reading --self-test', () => {
  it('픽스처 38종을 모두 검출한다', () => {
    const r = spawnSync('node', ['scripts/check-reading.mjs', '--self-test'], { cwd: ROOT, encoding: 'utf8' });
    expect(r.stdout).toContain('38/38 검출');
    expect(r.status).toBe(0);
  }, 30000);
});
