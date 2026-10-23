import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';
import { VOCAB_OFFLINE_TITLE, vocabOfflineLine } from '../../components/OfflineNotice';

// OFFLINE-SWEEP-001 P2 — 끊긴 채 연 /vocab(기기 사본)은 서로 어긋난 세 겹 대신 사본 안내 한 줄 + 복습 상태 한 장.
// 390 실측(2026-10-23 KST): 「저장해 둔 단어장을 보여드리고 있어요…」 + 「복습을 준비하지 못했어요. 연결을 확인하고…」 +
// 「표현을 불러오지 못했어요.」 — 표현은 보이는데 「못 불러왔다」고 했다.
const page = fs.readFileSync('src/views/VocabPage.jsx', 'utf8');

describe('/vocab 기기 사본 — 복습 상태 한 장', () => {
  it('문구: 제목은 복습을 막는 이유, 본문은 목록 위치 · 기록 보존(두 문장 이하)', () => {
    expect(VOCAB_OFFLINE_TITLE).toBe('복습은 연결되면 시작할 수 있어요');
    expect(vocabOfflineLine(3)).toBe('담은 표현은 아래에서 볼 수 있어요. 복습 기록은 그대로 남아 있어요.');
    expect(vocabOfflineLine(0)).toBe('복습 기록은 그대로 남아 있어요.');
  });
  it('사본일 때 실패 장 대신 이 장을 그리고, 실패 장(정본 조회 실패)은 그대로 남는다', () => {
    const branch = sliceBetween(page, ') : vocabError || !learningAvailable ? (', ') : tab === \'list\' ? (');
    expect(branch).toMatch(/\{isOffline\s*\n?[^]*?\? <section className="review-room-state" role="alert"><h2>\{VOCAB_OFFLINE_TITLE\}<\/h2><p>\{vocabOfflineLine\(vocab\.length\)\}<\/p>/);
    expect(branch).toContain('<h2>표현을 불러오지 못했어요.</h2>');
  });
  it('사본일 때 「복습을 준비하지 못했어요」 카드를 겹쳐 그리지 않는다 · 사본 안내 한 줄은 그대로', () => {
    expect(page).toContain("{admission.error && tab !== 'review' && !isOffline && <div role=\"alert\" className=\"card\">");
    expect(page).toContain('{isOffline && <OfflineNotice what="단어장" />}');
  });
  it('연결이 돌아오면 사본 화면이 정본을 다시 읽는다(online 이벤트 → refetch, 떠날 때 뗀다)', () => {
    const effect = sliceBetween(page, 'if (!isOffline) return undefined;', '}, [isOffline, refetchVocab]);');
    expect(effect).toContain("window.addEventListener('online', reread);");
    expect(effect).toContain("window.removeEventListener('online', reread)");
  });
});
