import { describe, it, expect } from 'vitest';
import {
  decodeEntities,
  parseCaptionData,
  selectCaptionTrack,
  withCaptionFormat,
  durationTextToSeconds,
  normalizeVideoNode,
  normalizeVideoList,
} from '../server/media.js';

// ─────────────────────────────────────────────────────────────
// 픽스처 주의: youtube.com 이그레스가 컨테이너에서 차단되므로 라이브 응답을
// 받아 확인하지 못했다. 아래 형태는 youtubei.js 소스(PlayerCaptionsTracklist,
// timedtext json3/xml 규약)와 공개 문서에 근거한 "대표 형태"이며, 실제 응답과
// 미세하게 다를 위험이 있다(오너가 Vercel 프리뷰에서 최종 검증).
// ─────────────────────────────────────────────────────────────

describe('decodeEntities', () => {
  it('기본 엔티티', () => {
    expect(decodeEntities('a &amp; b &lt;c&gt; &quot;d&quot;')).toBe('a & b <c> "d"');
  });
  it('숫자 엔티티', () => {
    expect(decodeEntities('it&#39;s')).toBe("it's");
  });
  it('YouTube 이중 인코딩 아포스트로피', () => {
    expect(decodeEntities('it&amp;#39;s')).toBe("it's");
  });
  it('16진 엔티티', () => {
    expect(decodeEntities('&#x1F600;')).toBe('😀');
  });
});

describe('parseCaptionData — JSON3', () => {
  const json3 = {
    wireMagic: 'pb3',
    events: [
      // window/append 아티팩트 (개행-only) → 스킵
      { tStartMs: 0, dDurationMs: 3000, aAppend: 1, segs: [{ utf8: '\n' }] },
      { tStartMs: 120, dDurationMs: 4880, segs: [{ utf8: 'Hello' }, { utf8: ' world' }] },
      { tStartMs: 5000, dDurationMs: 2000, segs: [{ utf8: "it&#39;s   fine" }] },
      // segs 없음 → 스킵
      { tStartMs: 7000, dDurationMs: 1000 },
    ],
  };

  it('객체 입력을 큐로 정규화', () => {
    const cues = parseCaptionData(json3);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ from: 0.12, to: 5, text: 'Hello world' });
  });
  it('엔티티 디코드 + 공백 정규화', () => {
    const cues = parseCaptionData(json3);
    expect(cues[1].text).toBe("it's fine");
    expect(cues[1].from).toBe(5);
    expect(cues[1].to).toBe(7);
  });
  it('JSON3 문자열도 파싱', () => {
    expect(parseCaptionData(JSON.stringify(json3))).toHaveLength(2);
  });
});

describe('parseCaptionData — 기본 XML(<transcript>)', () => {
  const xml =
    '<?xml version="1.0" encoding="utf-8" ?>' +
    '<transcript>' +
    '<text start="0" dur="1.54">Hello &amp;#39;world&amp;#39;</text>' +
    '<text start="1.54" dur="2.3">line <i>two</i></text>' +
    '<text start="4" dur="1"> </text>' + // 공백-only → 스킵
    '</transcript>';

  it('start/dur → from/to, 태그 제거, 이중 엔티티 디코드', () => {
    const cues = parseCaptionData(xml);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ from: 0, to: 1.54, text: "Hello 'world'" });
    expect(cues[1]).toEqual({ from: 1.54, to: 3.84, text: 'line two' });
  });
});

describe('parseCaptionData — srv3 XML(<timedtext><p>)', () => {
  const xml =
    '<timedtext format="3"><body>' +
    '<p t="0" d="1500"><s>Hola</s><s> mundo</s></p>' +
    '<p t="1500" d="2000">segunda</p>' +
    '<p t="3500" d="500"></p>' + // 빈 → 스킵
    '</body></timedtext>';

  it('t/d(ms) → 초, <s> 세그먼트 병합', () => {
    const cues = parseCaptionData(xml);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ from: 0, to: 1.5, text: 'Hola mundo' });
    expect(cues[1]).toEqual({ from: 1.5, to: 3.5, text: 'segunda' });
  });
});

describe('parseCaptionData — 방어', () => {
  it('빈/널 입력', () => {
    expect(parseCaptionData(null)).toEqual([]);
    expect(parseCaptionData('')).toEqual([]);
    expect(parseCaptionData('   ')).toEqual([]);
  });
  it('깨진 JSON', () => {
    expect(parseCaptionData('{not json')).toEqual([]);
  });
});

describe('selectCaptionTrack', () => {
  const tracks = [
    { base_url: 'u_en', language_code: 'en', kind: 'asr', name: { text: 'English (auto)' } },
    { base_url: 'u_ja', language_code: 'ja', name: { text: 'Japanese' } },
    { base_url: 'u_jaAsr', language_code: 'ja', kind: 'asr', name: { text: 'Japanese (auto)' } },
  ];

  it('요청 언어의 사람 자막 우선', () => {
    const { track } = selectCaptionTrack(tracks, 'ja');
    expect(track.base_url).toBe('u_ja');
  });
  it('사람 자막 없으면 같은 언어 ASR', () => {
    const only = [{ base_url: 'u_frAsr', language_code: 'fr', kind: 'asr', name: { text: 'FR' } }];
    expect(selectCaptionTrack(only, 'fr').track.base_url).toBe('u_frAsr');
  });
  it('언어 코드 접두 매칭(ja-JP)', () => {
    const t = [{ base_url: 'u', language_code: 'ja-JP', name: { text: 'JA' } }];
    expect(selectCaptionTrack(t, 'ja').track.base_url).toBe('u');
  });
  it('요청 언어 트랙 없으면 track=null + available 목록', () => {
    const { track, available } = selectCaptionTrack(tracks, 'ko');
    expect(track).toBeNull();
    expect(available).toHaveLength(3);
    expect(available[1]).toEqual({ code: 'ja', name: 'Japanese', kind: '' });
  });
  it('트랙이 아예 없으면 track=null', () => {
    expect(selectCaptionTrack([], 'ja').track).toBeNull();
    expect(selectCaptionTrack(undefined, 'ja').track).toBeNull();
  });
});

describe('withCaptionFormat', () => {
  it('파라미터 있는 base_url에 fmt 추가', () => {
    expect(withCaptionFormat('https://x/timedtext?v=1&lang=ja')).toBe(
      'https://x/timedtext?v=1&lang=ja&fmt=json3'
    );
  });
  it('기존 fmt 교체', () => {
    expect(withCaptionFormat('https://x/timedtext?fmt=srv3&lang=ja', 'json3')).toBe(
      'https://x/timedtext?fmt=json3&lang=ja'
    );
  });
});

describe('durationTextToSeconds', () => {
  it('mm:ss', () => expect(durationTextToSeconds('12:34')).toBe(754));
  it('h:mm:ss', () => expect(durationTextToSeconds('1:02:03')).toBe(3723));
  it('Text 객체', () => expect(durationTextToSeconds({ text: '0:45' })).toBe(45));
  it('빈/불량', () => {
    expect(durationTextToSeconds('')).toBeNull();
    expect(durationTextToSeconds('LIVE')).toBeNull();
  });
});

describe('normalizeVideoNode', () => {
  it('클래식 Video 노드', () => {
    const node = {
      video_id: 'abc12345678',
      title: { text: '日本語の動画' },
      author: { name: 'チャンネル' },
      duration: { seconds: 754, text: '12:34' },
      thumbnails: [
        { url: 'small.jpg', width: 120 },
        { url: 'big.jpg', width: 480 },
      ],
      has_captions: true,
    };
    expect(normalizeVideoNode(node)).toEqual({
      videoId: 'abc12345678',
      title: '日本語の動画',
      channel: 'チャンネル',
      durationSec: 754,
      thumbnailUrl: 'big.jpg',
      hasCaptions: true,
    });
  });

  it('length_text 폴백으로 duration 파싱', () => {
    const node = {
      video_id: 'xyz',
      title: { text: 'T' },
      author: { name: 'C' },
      length_text: { text: '3:00' },
      thumbnails: [{ url: 't.jpg' }],
    };
    const v = normalizeVideoNode(node);
    expect(v.durationSec).toBe(180);
    expect(v.hasCaptions).toBeNull();
  });

  it('LockupView(VIDEO) 노드', () => {
    const node = {
      content_type: 'VIDEO',
      content_id: 'lock1234567',
      metadata: {
        title: { text: '제목' },
        metadata: {
          metadata_rows: [
            { metadata_parts: [{ text: { text: '채널명' } }] },
          ],
        },
      },
      content_image: { image: [{ url: 'thumb.jpg', width: 480 }] },
    };
    const v = normalizeVideoNode(node);
    expect(v.videoId).toBe('lock1234567');
    expect(v.title).toBe('제목');
    expect(v.channel).toBe('채널명');
    expect(v.thumbnailUrl).toBe('thumb.jpg');
  });

  it('LockupView 비영상(PLAYLIST) → null', () => {
    expect(normalizeVideoNode({ content_type: 'PLAYLIST', content_id: 'p' })).toBeNull();
  });

  it('id/제목 없으면 null', () => {
    expect(normalizeVideoNode({ title: { text: 'x' } })).toBeNull();
    expect(normalizeVideoNode(null)).toBeNull();
  });
});

describe('normalizeVideoList', () => {
  it('중복 제거 + 상한 적용', () => {
    const nodes = [
      { video_id: 'a', title: { text: 'A' } },
      { video_id: 'a', title: { text: 'A dup' } },
      { content_type: 'CHANNEL', content_id: 'c' }, // 스킵
      { video_id: 'b', title: { text: 'B' } },
    ];
    const out = normalizeVideoList(nodes, 20);
    expect(out.map((v) => v.videoId)).toEqual(['a', 'b']);
  });
  it('limit', () => {
    const nodes = Array.from({ length: 30 }, (_, i) => ({ video_id: 'v' + i, title: { text: 't' } }));
    expect(normalizeVideoList(nodes, 20)).toHaveLength(20);
  });
});
