import { describe, expect, it } from 'vitest';
import ZH_SEPARABLE from '../data/zhSeparable.json';
import { tokenizeZhLine } from '../tokenizeZh.js';

// 계약: 이합사(离合词) 인지 R4a — rfc-zh-separable-verbs (오너 승인 2026-08-30 "ㄱㄱ" —
// 권장안 A+B 감지·수동 시드. 뷰어 문구는 R4b). "base_form = 표면형" 계약의 첫 명시 예외:
// 삽입형(吵过架·吵了一架)의 조각이 base_form=吵架로 합류해 저장·만남·FSRS(vocabIO
// normalizeWordText '기본형 우선')가 실제 어휘에 붙는다. 표면·분할·병음은 불변이고,
// 사전 밖·패턴 밖은 전부 무개입(실패 시 현행 수렴).

const tok = (line, text) => tokenizeZhLine(line).find((t) => t.text === text);

describe('zhSeparable 사전 정본(수동 시드)', () => {
  const entries = Object.entries(ZH_SEPARABLE);

  it('규모 — 상용 수동 시드 30~60(대량 조달은 후속 라운드)', () => {
    expect(entries.length).toBeGreaterThanOrEqual(30);
    expect(entries.length).toBeLessThanOrEqual(60);
  });

  it('형식 전수 — 키는 한자 2자(V≠O), 값은 1', () => {
    const bad = entries.filter(([k, v]) => !/^[一-鿿]{2}$/.test(k) || [...k][0] === [...k][1] || v !== 1);
    expect(bad.map(([k]) => k)).toEqual([]);
  });

  it('대표 시드 실재(RFC 최소 시드 목록)', () => {
    for (const w of ['睡觉', '见面', '吵架', '洗澡', '结婚', '帮忙', '散步', '聊天', '游泳', '唱歌']) {
      expect(ZH_SEPARABLE[w]).toBe(1);
    }
  });
});

describe('감지 A — 통짜 삽입형(jieba 사전 등재 V+상조사+O)', () => {
  it('洗过澡·结过婚: base만 합류, 표면·병음·분할 불변', () => {
    const xi = tok('他洗过澡。', '洗过澡');
    expect(xi.base_form).toBe('洗澡');
    expect(xi.furigana.split(' ')).toHaveLength(3); // 병음은 표면 3글자 그대로
    const jie = tok('他们结过婚。', '结过婚');
    expect(jie.base_form).toBe('结婚');
  });
});

describe('감지 B — 분리형 근접(V…O ≤2토큰, 사이 조사·수량구)', () => {
  it('상조사 삽입: 从来没吵过架 → 吵.base=吵架, O(架)는 불변(이중 계상 방지)', () => {
    const line = '从来没吵过架。';
    expect(tok(line, '吵').base_form).toBe('吵架');
    expect(tok(line, '架').base_form).toBe('架');
    expect(tok(line, '没').base_form).toBe('没'); // R1 되가름 조각도 불변
  });

  it('양사구 흡수(RFC 표2): 吵了一架·见了一面·睡了一觉(캐리어 오태그 d 구제)', () => {
    expect(tok('他们吵了一架。', '吵').base_form).toBe('吵架');
    expect(tok('他们吵了一架。', '一架').base_form).toBe('一架'); // 캐리어 불변
    expect(tok('昨天见了一面。', '见').base_form).toBe('见面');
    expect(tok('他睡了一觉。', '睡').base_form).toBe('睡觉');
    expect(tok('他吃了一惊。', '吃').base_form).toBe('吃惊');
  });

  it('단독 O 인접: 请了假·生了气(V=vn)·洗了澡·干了一杯·上了课(V=f 방위사 태그 실측)', () => {
    expect(tok('他请了假。', '请').base_form).toBe('请假');
    // 他生了气는 jieba가 他生/x로 오병합(R1 문서화 HMM 병합류 — 판별기 단어성 판정 영역)
    expect(tok('她生了气。', '生').base_form).toBe('生气');
    expect(tok('他洗了澡。', '洗').base_form).toBe('洗澡');
    expect(tok('大家干了一杯。', '干').base_form).toBe('干杯');
    expect(tok('他上了课。', '上').base_form).toBe('上课');
  });

  it('x-병합 조각 경유: 睡过觉(睡过/x 되가름)·发了烧(发了/x 되가름)', () => {
    expect(tok('他睡过觉。', '睡').base_form).toBe('睡觉');
    expect(tok('孩子发了烧。', '发').base_form).toBe('发烧');
  });

  it('회랑 +3(수량구 비융합 실측)·4자 융합 캐리어·고립 태그 확장(n·m)', () => {
    expect(tok('他抽了一根烟。', '抽').base_form).toBe('抽烟');   // V 了 一根/m 烟 — O가 +3
    expect(tok('她请了三天假。', '请').base_form).toBe('请假');
    expect(tok('我们开了一个会。', '开').base_form).toBe('开会');
    expect(tok('我们聊了一会儿天。', '聊').base_form).toBe('聊天'); // 一会儿天/m 4자 융합 캐리어
    expect(tok('我们照了一张相。', '照').base_form).toBe('照相');   // 照/n 고립 명사 기본값
    expect(tok('我们点了几个菜。', '点').base_form).toBe('点菜');   // 点/m 고립 양사 기본값
  });

  it('회랑 밖 장거리 삽입·HMM 쓰레기 병합(去理/x류)은 무개입 — v1 수용 미스', () => {
    expect(tok('我们排了一个小时队。', '排').base_form).toBe('排'); // 小时가 회랑 화이트리스트 밖
    const words = tokenizeZhLine('他去理了发。').map((t) => t.text);
    expect(words).toContain('去理'); // R1 문서화 HMM 병합 — 단어성 판정(판별기) 영역
  });
});

describe('감지 C — x-병합 양사 个 꼬리 분리 → B 합류', () => {
  it('帮个忙: 帮个/x → 帮+个/양사, 帮.base=帮忙', () => {
    const line = '请帮个忙。';
    const words = tokenizeZhLine(line).map((t) => t.text);
    expect(words).toContain('帮');
    expect(words).toContain('个');
    expect(words).not.toContain('帮个');
    expect(tok(line, '帮').base_form).toBe('帮忙');
    expect(tok(line, '个').pos).toBe('양사');
  });
});

describe('무개입 가드(오탐 방지)', () => {
  it('연속형은 base=표면 그대로: 他们吵架了·我们明天见面', () => {
    expect(tok('他们吵架了。', '吵架').base_form).toBe('吵架');
    expect(tok('我们明天见面。', '见面').base_form).toBe('见面');
  });

  it('화이트리스트 밖 사이 토큰(대명사) 무개입: 我吵他架', () => {
    expect(tok('我吵他架。', '吵').base_form).toBe('吵');
  });

  it('사전 밖 VO 무개입: 他看了书(看书 미등재)', () => {
    expect(tok('他看了书。', '看').base_form).toBe('看');
  });

  it('일반 문장 전수 — 이합사 없는 줄은 base_form=표면형 전량 유지', () => {
    for (const t of tokenizeZhLine('我在北京大学读书,他昨天买了三本书。')) {
      expect(t.base_form).toBe(t.text);
    }
  });
});
