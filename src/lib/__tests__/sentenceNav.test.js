import { describe, expect, it } from 'vitest';
import { pickableSentences, adjacentSentence, cleanLineText } from '../sentenceNav.js';

// 계약: 문장 이동(오너 승인 2026-08-19) — "문장"의 단위는 문장 막대(¦)와 동일해야 한다.
const rawLines = ['# 제목 문장', '第一句话。', '', '。', '第二句话。'];
const lineGroups = [
  { rawIdx: 0, tokenIds: ['id_0_0'] },
  { rawIdx: 1, tokenIds: ['id_1_0', 'id_1_1'] },
  { rawIdx: 3, tokenIds: ['id_3_0'] },  // 정리 후 1자(。) — 막대 임계 미달
  { rawIdx: 4, tokenIds: ['id_4_0'] },
];

describe('pickableSentences', () => {
  it('토큰 있는 줄 중 정리 텍스트 2자 이상만 — 막대(¦) 조건과 동일', () => {
    const s = pickableSentences(lineGroups, rawLines);
    expect(s.map((x) => x.rawIdx)).toEqual([0, 1, 4]);
    expect(s[0]).toEqual({ rawIdx: 0, text: '제목 문장', firstTokenId: 'id_0_0' });
  });

  it('헤딩 마커를 렌더와 같은 규칙으로 벗긴다', () => {
    expect(cleanLineText('## 소제목')).toBe('소제목');
    expect(cleanLineText('  본문  ')).toBe('본문');
  });

  it('빈 그룹·빈 입력 안전', () => {
    expect(pickableSentences([], rawLines)).toEqual([]);
    expect(pickableSentences(null, null)).toEqual([]);
    expect(pickableSentences([{ rawIdx: 0, tokenIds: [] }], rawLines)).toEqual([]);
  });
});

describe('adjacentSentence', () => {
  const s = pickableSentences(lineGroups, rawLines);

  it('아래/위 한 문장씩, 경계 밖은 null(순환 없음 — 버튼 비활성 근거)', () => {
    expect(adjacentSentence(s, 1, 1)?.rawIdx).toBe(4);
    expect(adjacentSentence(s, 1, -1)?.rawIdx).toBe(0);
    expect(adjacentSentence(s, 0, -1)).toBeNull();
    expect(adjacentSentence(s, 4, 1)).toBeNull();
  });

  it('지정 가능 목록을 건너뛴다 — 막대 없는 줄(rawIdx 3)로는 절대 안 간다', () => {
    expect(adjacentSentence(s, 1, 1)?.rawIdx).not.toBe(3);
  });

  it('현재 지정이 목록에 없으면 방향 기준 가장 가까운 문장으로 회복', () => {
    expect(adjacentSentence(s, 2, 1)?.rawIdx).toBe(4);
    expect(adjacentSentence(s, 2, -1)?.rawIdx).toBe(1);
    expect(adjacentSentence([], 1, 1)).toBeNull();
  });
});
