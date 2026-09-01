import { describe, expect, it } from 'vitest';
import ZH_SEPARABLE from '../data/zhSeparable.json';
import ZH_SEPARABLE_HSK from '../data/zhSeparableHsk.json';
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

  it('회랑 밖 장거리 삽입은 여전히 무개입 — 그리고 去理 미스는 v2-T가 없앴다', () => {
    expect(tok('我们排了一个小时队。', '排').base_form).toBe('排'); // 小时가 회랑 화이트리스트 밖

    // 이 줄은 원래 `去理`가 **한 토큰으로 남는 것**을 고정하고 있었다(「v1 수용 미스」).
    // 미스의 원인은 이합사 쪽이 아니라 그 위였다 — HMM이 去+理를 붙여 `x`를 달았고,
    // V 클러스터가 성립하지 않아 회랑 탐색 자체가 시작되지 못했다. v2-T R1이 x+한자를
    // 되가르면서 원인이 사라졌고, 미스는 **적중으로 바뀌었다**.
    const words = tokenizeZhLine('他去理了发。').map((t) => t.text);
    expect(words).toEqual(['他', '去', '理', '了', '发', '。']);
    expect(tok('他去理了发。', '理').base_form).toBe('理发');
  });

  it('V+상조사 2자 클러스터(오너 보고 下过雨): 下过/v 조각의 base만 VO로, 표면·분할 불변', () => {
    // jieba 사전이 下过·刮过를 통째 등재 — x가 아니라 R1 되가름 대상도 아니다(穿过 보호)
    const line = '昨天下过雨。';
    const xiaguo = tok(line, '下过');
    expect(xiaguo.base_form).toBe('下雨');
    expect(xiaguo.furigana.split(' ')).toHaveLength(2); // 표면 병음 그대로
    expect(tok(line, '雨').base_form).toBe('雨');        // O 불변(이중 계상 방지)
    expect(tok('下过一场雨。', '下过').base_form).toBe('下雨'); // 클러스터 + 회랑
    expect(tok('他下过班。', '下过').base_form).toBe('下班');   // 시드 기존 항목도 잡는 보너스
  });

  it('날씨 이합사 — f-태그 B·l-토큰 캐리어·연속형', () => {
    expect(tok('昨天下了雨。', '下').base_form).toBe('下雨');       // 下/f (방위사 기본값)
    expect(tok('外面下了一场雨。', '下').base_form).toBe('下雨');
    expect(tok('外面刮了一阵风。', '刮').base_form).toBe('刮风');   // 一阵风/l 융합 캐리어
    expect(tok('下雨了。', '下雨').base_form).toBe('下雨');         // 연속형 그대로
  });

  it('클러스터 가드 — 실단어 穿过는 불변(穿路 미등재 + 马路 캐리어 아님)', () => {
    expect(tok('他穿过马路。', '穿过').base_form).toBe('穿过');
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

  it('중립 스위프 영구 계약 — 사전이 커져도(대량층 포함) 무이합 문장 합류 0', () => {
    // 대량 조달(477항) 직후 전수 실측으로 선별한 중립 코퍼스(적대 함정 포함:
    // 得了到北京·拿出了来自·打了个电话·为了/除了/忘了·수량구 삽입 비이합).
    // 시드가 더 자라면 이 계약이 오탐 성장의 첫 방벽이다.
    const neutral = [
      '我们是好朋友。', '他的名气很大。', '怪不得你没来。', '我不在乎这个。',
      '他成天玩游戏。', '我想约你吃饭。', '约三十人参加了活动。', '你知道这件事吗？',
      '街上很热闹。', '我喜欢安静的地方。', '一个人也没有。', '他不是学生。',
      '他吃了一个苹果。', '我上了一辆车。', '他打了一个电话。', '我们见了很多人。',
      '他下了楼。', '她生了一个孩子。', '他放了一本书在桌上。', '我起了一个名字。',
      '她照了镜子。', '他穿过马路。', '他睡着了。', '他到了站。', '车开过来了。',
      '他走过那条街。', '为了你我什么都做。', '除了他都来了。', '雨下得很大。',
      '他忘了带伞。', '他想了想。', '他得了到北京的机会。', '他拿出了来自北京的信。',
      '他打了个电话。', '他吃了点东西。', '他上了年纪。', '他帮了他一下。',
    ];
    const bad = [];
    for (const s of neutral) {
      for (const t of tokenizeZhLine(s)) {
        if (t.base_form !== t.text) bad.push(`${s} :: ${t.text}⇒${t.base_form}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

// 대량층(zhSeparableHsk.json) — 오너 승인 2026-08-30 "이합사 대량 조달 ㄱㄱ".
// 원천: 공식 HSK 3.0 WebPinyin의 ∥ 분철 마커(국제중문교육 등급표준의 이합사 표기,
// ivankra/hsk30 MIT). RFC 1순위 Wiktionary(3,121)는 프록시 정책 차단 실측으로 대체 —
// 권위(공식 표준)·HSK 어휘 정합·라이선스 모두 우위. 생성 build-zh-hsk.mjs ③.
describe('이합사 대량층(HSK ∥ 마커)', () => {
  const entries = Object.entries(ZH_SEPARABLE_HSK);

  it('규모 — ∥ 532행에서 2자·수제 제외 후 400+', () => {
    expect(entries.length).toBeGreaterThan(400);
    expect(entries.length).toBeLessThan(520);
  });

  it('형식 전수 — 한자 2자·V≠O·값 1', () => {
    const bad = entries.filter(([k, v]) => !/^[一-鿿]{2}$/.test(k) || [...k][0] === [...k][1] || v !== 1);
    expect(bad.map(([k]) => k)).toEqual([]);
  });

  it('수제층과 비겹침(생성기가 정본 우선 제외)', () => {
    for (const w of Object.keys(ZH_SEPARABLE)) {
      expect(ZH_SEPARABLE_HSK[w]).toBeUndefined();
    }
  });

  it('스팟 — 공식 마커 수확(吃饭·打车·得到·出门) / 얼화 3자·공백 분철 클래스 배제', () => {
    for (const w of ['吃饭', '打车', '得到', '出门', '请客', '上当']) {
      expect(ZH_SEPARABLE_HSK[w]).toBe(1);
    }
    expect(ZH_SEPARABLE_HSK['聊天儿']).toBeUndefined(); // 3자 얼화
    expect(ZH_SEPARABLE_HSK['回家']).toBeUndefined();   // 공백 분철(혼성 구 클래스 — v1 배제)
    expect(ZH_SEPARABLE_HSK['上次']).toBeUndefined();
  });

  it('병합 배선 — 대량층 항목이 감지에 실제로 문다(수제 뒤집기: 吃饭은 이제 공식 등재)', () => {
    expect(tok('他吃了饭。', '吃了饭').base_form).toBe('吃饭');  // A 통짜
    expect(tok('吃过饭了。', '吃过饭').base_form).toBe('吃饭');  // 기존 가드의 정반전(공식 근거)
    expect(tok('我打了车。', '打').base_form).toBe('打车');      // B 회랑
    expect(tok('他上了当。', '上').base_form).toBe('上当');      // f-태그 V
  });
});
