import { describe, it, expect } from 'vitest';
import {
  parseYouTubeId,
  parseTimedSubtitles,
  parsePlainTextCues,
  findActiveCueIndex,
  formatCueTime,
  segmentWords,
  matchTokenAt,
  hashText,
  groupTokensToUnits,
  layoutUnits,
} from '../listenSubtitles';

describe('parseYouTubeId', () => {
  it('watch?v= 형태', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('추가 쿼리 파라미터가 있어도 v= 추출', () => {
    expect(parseYouTubeId('https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=abc')).toBe('dQw4w9WgXcQ');
  });
  it('youtu.be 단축 URL', () => {
    expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe('dQw4w9WgXcQ');
  });
  it('shorts URL', () => {
    expect(parseYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('embed URL', () => {
    expect(parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('순수 11자 ID', () => {
    expect(parseYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('스킴 없는 도메인도 허용', () => {
    expect(parseYouTubeId('youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('YouTube가 아닌 URL은 null', () => {
    expect(parseYouTubeId('https://vimeo.com/12345678')).toBeNull();
  });
  it('빈 값·잘못된 값 방어', () => {
    expect(parseYouTubeId('')).toBeNull();
    expect(parseYouTubeId(null)).toBeNull();
    expect(parseYouTubeId('   ')).toBeNull();
    expect(parseYouTubeId('https://youtube.com/watch?v=short')).toBeNull();
  });
});

describe('parseTimedSubtitles — SRT', () => {
  const srt = `1
00:00:01,000 --> 00:00:04,000
こんにちは
世界

2
00:00:05,500 --> 00:00:07,250
<i>お元気ですか</i>
`;
  const cues = parseTimedSubtitles(srt);

  it('큐 개수', () => {
    expect(cues).toHaveLength(2);
  });
  it('타임스탬프 ms → 초 변환', () => {
    expect(cues[0].start).toBe(1);
    expect(cues[0].end).toBe(4);
    expect(cues[1].start).toBe(5.5);
    expect(cues[1].end).toBe(7.25);
  });
  it('멀티라인 큐는 공백으로 결합', () => {
    expect(cues[0].text).toBe('こんにちは 世界');
  });
  it('인라인 태그 제거', () => {
    expect(cues[1].text).toBe('お元気ですか');
  });
  it('timed 플래그', () => {
    expect(cues[0].timed).toBe(true);
  });
});

describe('parseTimedSubtitles — VTT', () => {
  const vtt = `WEBVTT

00:00.000 --> 00:02.000
Hello there

00:03.000 --> 00:05.000
General Kenobi
`;
  const cues = parseTimedSubtitles(vtt);

  it('VTT도 파싱 (mm:ss 형태)', () => {
    expect(cues).toHaveLength(2);
    expect(cues[0].start).toBe(0);
    expect(cues[0].end).toBe(2);
    expect(cues[0].text).toBe('Hello there');
    expect(cues[1].text).toBe('General Kenobi');
  });
});

describe('parseTimedSubtitles — 방어', () => {
  it('빈 문자열은 빈 배열', () => {
    expect(parseTimedSubtitles('')).toEqual([]);
    expect(parseTimedSubtitles('   ')).toEqual([]);
    expect(parseTimedSubtitles(null)).toEqual([]);
  });
  it('쓰레기 입력도 던지지 않고 빈 배열', () => {
    expect(Array.isArray(parseTimedSubtitles('not a subtitle file at all'))).toBe(true);
  });
});

describe('parsePlainTextCues', () => {
  it('줄 단위 분할 · 빈 줄 제거 · 싱크 없음', () => {
    const cues = parsePlainTextCues('첫째 줄\n\n  둘째 줄  \n셋째 줄');
    expect(cues).toHaveLength(3);
    expect(cues.map((c) => c.text)).toEqual(['첫째 줄', '둘째 줄', '셋째 줄']);
    expect(cues[0].start).toBeNull();
    expect(cues[0].timed).toBe(false);
  });
  it('빈 입력 방어', () => {
    expect(parsePlainTextCues('')).toEqual([]);
    expect(parsePlainTextCues(null)).toEqual([]);
  });
});

describe('findActiveCueIndex', () => {
  const cues = [
    { start: 1, end: 4 },
    { start: 5.5, end: 7.25 },
    { start: 10, end: 12 },
  ];
  it('구간 내부', () => {
    expect(findActiveCueIndex(cues, 2)).toBe(0);
    expect(findActiveCueIndex(cues, 6)).toBe(1);
  });
  it('첫 큐 이전은 -1', () => {
    expect(findActiveCueIndex(cues, 0.5)).toBe(-1);
  });
  it('큐 사이 공백 구간은 직전 큐 유지', () => {
    expect(findActiveCueIndex(cues, 4.5)).toBe(0);
    expect(findActiveCueIndex(cues, 8)).toBe(1);
  });
  it('마지막 큐 이후는 마지막 유지', () => {
    expect(findActiveCueIndex(cues, 100)).toBe(2);
  });
  it('타임리스 큐 목록은 항상 -1', () => {
    expect(findActiveCueIndex([{ start: null, end: null }], 5)).toBe(-1);
  });
  it('빈 배열·NaN 방어', () => {
    expect(findActiveCueIndex([], 5)).toBe(-1);
    expect(findActiveCueIndex(cues, NaN)).toBe(-1);
  });
});

describe('formatCueTime', () => {
  it('mm:ss', () => {
    expect(formatCueTime(0)).toBe('0:00');
    expect(formatCueTime(65)).toBe('1:05');
  });
  it('h:mm:ss', () => {
    expect(formatCueTime(3661)).toBe('1:01:01');
  });
  it('널·음수 방어', () => {
    expect(formatCueTime(null)).toBe('');
    expect(formatCueTime(-1)).toBe('');
  });
});

// ── 인라인 형태소 탭 ──
describe('segmentWords', () => {
  it('영어 문장을 단어/비단어 세그먼트로 분할(오프셋·isWord)', () => {
    const segs = segmentWords('I love cats.', 'en');
    // Intl.Segmenter는 Node에 내장 — 미지원이면 null(그 경우 이 검증은 스킵).
    if (segs === null) return;
    const words = segs.filter((s) => s.isWord).map((s) => s.text);
    expect(words).toContain('love');
    expect(words).toContain('cats');
    const love = segs.find((s) => s.text === 'love');
    expect(love.start).toBe('I love cats.'.indexOf('love'));
    // 마침표·공백은 비단어
    expect(segs.some((s) => s.text === '.' && !s.isWord)).toBe(true);
  });
  it('일본어 문장 분할 — 시작 오프셋이 원문 인덱스와 일치', () => {
    const text = '猫が好きです';
    const segs = segmentWords(text, 'ja');
    if (segs === null) return;
    // 각 세그먼트를 이어붙이면 원문 복원 + start 오프셋 정합
    expect(segs.map((s) => s.text).join('')).toBe(text);
    for (const s of segs) expect(text.slice(s.start, s.start + s.text.length)).toBe(s.text);
  });
  it('빈 문자열/비문자 방어', () => {
    expect(segmentWords('', 'ja')).toEqual([]);
    expect(segmentWords(null, 'ja')).toEqual([]);
  });
});

describe('matchTokenAt', () => {
  // analyze 토큰(부호 필터 후) — text만 필요. cueText 오프셋 맵을 순차 탐색으로 만든다.
  const jaTokens = [
    { tokenId: 't0', text: '猫', meaning: '고양이' },
    { tokenId: 't1', text: 'が', meaning: '이/가' },
    { tokenId: 't2', text: '好き', meaning: '좋아함' },
    { tokenId: 't3', text: 'です', meaning: '입니다' },
  ];
  const cue = '猫が好きです';

  it('세그먼트 시작 오프셋이 속한 토큰 반환', () => {
    // "好き"는 offset 3에서 시작 → t2
    expect(matchTokenAt(jaTokens, cue, 3, '好き').tokenId).toBe('t2');
    // "猫"는 offset 0 → t0
    expect(matchTokenAt(jaTokens, cue, 0, '猫').tokenId).toBe('t0');
  });

  it('세그먼트가 토큰 경계와 달라 토큰 중간에서 시작해도 그 토큰 반환', () => {
    // Intl.Segmenter가 "好きです"를 한 단어로 묶어 offset 3에서 시작 →
    // analyze는 好き(3)·です(5)로 쪼갬. offset 3은 t2(好き) 스팬 안 → t2.
    expect(matchTokenAt(jaTokens, cue, 3, '好きです').tokenId).toBe('t2');
    // 반대로 offset 5(です 시작)면 t3.
    expect(matchTokenAt(jaTokens, cue, 5, 'です').tokenId).toBe('t3');
  });

  it('공백 차이로 오프셋이 어긋나면 segText 포함 토큰으로 폴백', () => {
    // 영어: analyze 토큰엔 공백이 없지만 cueText엔 공백 → 순차 indexOf가 실제 오프셋을 복원.
    const enTokens = [
      { tokenId: 'e0', text: 'I' },
      { tokenId: 'e1', text: 'love' },
      { tokenId: 'e2', text: 'cats' },
    ];
    const enCue = 'I love cats';
    // "love" 세그먼트 offset 2 → e1
    expect(matchTokenAt(enTokens, enCue, 2, 'love').tokenId).toBe('e1');
    // 오프셋을 일부러 -1(불명)로 줘도 segText 폴백으로 e2
    expect(matchTokenAt(enTokens, enCue, -1, 'cats').tokenId).toBe('e2');
  });

  it('매칭 없으면 null', () => {
    expect(matchTokenAt(jaTokens, cue, 99, '犬')).toBeNull();
    expect(matchTokenAt([], cue, 0, '猫')).toBeNull();
    expect(matchTokenAt(null, cue, 0, '猫')).toBeNull();
  });
});

describe('hashText', () => {
  it('결정적 8자리 16진수', () => {
    expect(hashText('hello')).toBe(hashText('hello'));
    expect(/^[0-9a-f]{8}$/.test(hashText('猫が好き'))).toBe(true);
  });
  it('다른 입력은 다른 해시(대개)', () => {
    expect(hashText('a')).not.toBe(hashText('b'));
  });
});

describe('groupTokensToUnits — 일본어 어절 묶기', () => {
  it('思います → 1단위(思い[동사]+ます[조동사]), base 思う', () => {
    const tokens = [
      { text: '思い', base_form: '思う', pos: '동사', furigana: 'おもい' },
      { text: 'ます', base_form: 'ます', pos: '조동사', furigana: null },
    ];
    const units = groupTokensToUnits(tokens);
    expect(units).toHaveLength(1);
    expect(units[0].surface).toBe('思います');
    expect(units[0].base).toBe('思う');
    expect(units[0].furigana).toBe('おもいます');
    expect(units[0].tokens).toHaveLength(2);
  });

  it('届いたら → 1단위(届い[동사]+たら[조동사]), base 届く', () => {
    const tokens = [
      { text: '届い', base_form: '届く', pos: '동사', furigana: 'とどい' },
      { text: 'たら', base_form: 'た', pos: '조동사', furigana: null },
    ];
    const units = groupTokensToUnits(tokens);
    expect(units).toHaveLength(1);
    expect(units[0].surface).toBe('届いたら');
    expect(units[0].base).toBe('届く');
  });

  it('食べています → 1단위(食べ+て[접속조사]+い[補助動詞]+ます[조동사])', () => {
    const tokens = [
      { text: '食べ', base_form: '食べる', pos: '동사', furigana: 'たべ' },
      { text: 'て', base_form: 'て', pos: '조사', furigana: null },
      { text: 'い', base_form: 'いる', pos: '동사', furigana: null },
      { text: 'ます', base_form: 'ます', pos: '조동사', furigana: null },
    ];
    const units = groupTokensToUnits(tokens);
    expect(units).toHaveLength(1);
    expect(units[0].surface).toBe('食べています');
    expect(units[0].base).toBe('食べる');
  });

  it('猫が好きです → 3단위(猫 / が / 好きです)', () => {
    const tokens = [
      { text: '猫', base_form: '猫', pos: '명사', furigana: 'ねこ' },
      { text: 'が', base_form: 'が', pos: '조사', furigana: null },
      { text: '好き', base_form: '好き', pos: '명사', furigana: 'すき' },
      { text: 'です', base_form: 'です', pos: '조동사', furigana: null },
    ];
    const units = groupTokensToUnits(tokens);
    expect(units.map((u) => u.surface)).toEqual(['猫', 'が', '好きです']);
    expect(units[1].surface).toBe('が');       // 조사는 단독
    expect(units[2].base).toBe('好き');         // です는 好き에 붙되 base는 好き
  });

  it('격조사(を·に)는 用言 뒤여도 단독 단위', () => {
    const tokens = [
      { text: '本', base_form: '本', pos: '명사', furigana: null },
      { text: 'を', base_form: 'を', pos: '조사', furigana: null },
      { text: '読み', base_form: '読む', pos: '동사', furigana: 'よみ' },
      { text: 'ます', base_form: 'ます', pos: '조동사', furigana: null },
    ];
    const units = groupTokensToUnits(tokens);
    expect(units.map((u) => u.surface)).toEqual(['本', 'を', '読みます']);
  });

  it('빈 입력·비배열 방어', () => {
    expect(groupTokensToUnits([])).toEqual([]);
    expect(groupTokensToUnits(null)).toEqual([]);
  });
});

describe('groupTokensToUnits — 영어(identity + 구두점 분리)', () => {
  it('영어 문장은 단어별 단위, 구두점은 단독', () => {
    const tokens = [
      { text: 'I', base_form: 'i', pos: null, furigana: '' },
      { text: 'love', base_form: 'love', pos: null, furigana: '' },
      { text: 'cats', base_form: 'cat', pos: null, furigana: '' },
      { text: '.', base_form: '.', pos: '기호', furigana: '' },
    ];
    const units = groupTokensToUnits(tokens);
    expect(units.map((u) => u.surface)).toEqual(['I', 'love', 'cats', '.']);
    expect(units[2].base).toBe('cat');   // 저장은 base(lemma) 우선
    expect(units[0].furigana).toBeNull();
  });
});

describe('layoutUnits — 원문 공백 복원', () => {
  it('영어: 단위 사이 공백을 gap으로 복원', () => {
    const units = groupTokensToUnits([
      { text: 'I', base_form: 'i', pos: null, furigana: '' },
      { text: 'love', base_form: 'love', pos: null, furigana: '' },
      { text: 'cats', base_form: 'cat', pos: null, furigana: '' },
    ]);
    const pieces = layoutUnits(units, 'I love cats');
    // 재조립하면 원문과 동일
    expect(pieces.map((p) => p.text).join('')).toBe('I love cats');
    expect(pieces.filter((p) => p.type === 'unit').map((p) => p.text)).toEqual(['I', 'love', 'cats']);
    expect(pieces.some((p) => p.type === 'gap' && p.text === ' ')).toBe(true);
  });

  it('일본어: gap 없이 단위만', () => {
    const units = groupTokensToUnits([
      { text: '猫', base_form: '猫', pos: '명사', furigana: null },
      { text: 'が', base_form: 'が', pos: '조사', furigana: null },
    ]);
    const pieces = layoutUnits(units, '猫が');
    expect(pieces.map((p) => p.text).join('')).toBe('猫が');
    expect(pieces.every((p) => p.type === 'unit')).toBe(true);
  });

  it('빈 단위 방어', () => {
    expect(layoutUnits([], 'abc')).toEqual([]);
  });
});
