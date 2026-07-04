import { describe, it, expect } from 'vitest';
import {
  parseYouTubeId,
  parseTimedSubtitles,
  parsePlainTextCues,
  findActiveCueIndex,
  formatCueTime,
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
