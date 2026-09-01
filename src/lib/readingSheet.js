// 읽기 설정 시트 캐논 — 오너 확정 2026-08-27 (시연 아티팩트 합의: A 표준 시트 + 프리셋 줄).
// 신설 3종(발음 표기 3단계·세피아 배경·말하기 속도)의 값 체계가 여기 산다.
// UI(ViewerPage)는 이 표를 그리기만 하고, 시맨틱은 전부 이 파일이 정본이다.

// 말하기 속도 — 뷰어의 모든 ▷(단어 카드·좌패널 문장·자동 발음) 공통.
// 경로가 둘이라 값도 둘이다: server = 고품질 음성(Audio.playbackRate, 1 = 원음),
// web = Web Speech 폴백(utter.rate — 현행 기본 0.85가 'normal'이므로 그대로 보존하고
// slow/fast는 같은 비율(×0.75/×1.25 근사)로 내린다/올린다.
export const TTS_RATES = {
  slow:   { label: '0.75×', server: 0.75, web: 0.65 },
  normal: { label: '1×',    server: 1,    web: 0.85 },
  fast:   { label: '1.25×', server: 1.25, web: 1.05 },
};

// speak(text, lang, opts) 서명에 맞춘 옵션 변환 — 모르는 키는 normal로 수렴(실패 무해).
export function ttsOptsFor(rateKey) {
  const r = TTS_RATES[rateKey] || TTS_RATES.normal;
  return { playbackRate: r.server, rate: r.web };
}

// 발음 표기 3단(all·unknown·none)에서 이 토큰의 루비(병음·요미가나)를 감출지.
// '모르는 단어만'(unknown)의 실시맨틱(v1 확정): 아는 단어(knownWordSet)와 담은 단어
// (savedWords)를 감춘다 — 담은 단어는 능동 회상 대상이고, 신규·만남 단어에는 아직
// 크러치(발음)가 필요하다. 시연의 '상태색 있는 단어만 병음' 프록시와 다름을 명시한다.
export function pronHiddenFor(pronDisplay, { isKnown = false, isSaved = false } = {}) {
  if (pronDisplay === 'none') return true;
  if (pronDisplay === 'unknown') return isKnown || isSaved;
  return false; // 'all' 및 미지 값 — 전체 표시가 안전 기본
}

// ── 후리가나 셀프 테스트(v1-4 R1 — 오너 승인 2026-09-01) ──
// 규칙 한 줄: **탭은 언제나 그 자리에서 가장 덜 아는 것을 연다.** 가려진 단어는 발음을
// 먼저 내주고, 가려지지 않은 단어는 지금처럼 곧장 카드를 연다(무변경).
//
// 공개가 싼 이유: 가려진 발음은 이미 DOM에 있고 `.surface--furi-off`가 visibility만 꺼
// 둔다. 공개 = 클래스 한 겹 벗기기 → **폭·행간 불변**(글이 안 밀린다).

// 「전체」에는 공개 단계가 없다 — 가릴 게 없기 때문이다. 설정 시트의 종속 스위치를
// 흐리는 판정도 이 한 줄을 쓴다. 둘을 따로 적으면 "흐린데 눌리는" 스위치가 생긴다.
export function pronRevealAvailable(pronDisplay) {
  return pronDisplay !== 'all';
}

// 이 탭이 '카드 열기'가 아니라 '발음 공개'인가.
// 집중 모드의 문장 밖 탭(= 순수 이동)은 이 판정보다 **앞선** 단계라 여기 오지 않는다 —
// 이 함수는 우선순위 ②만 맡는다(①은 ViewerPage의 집중 모드 분기가 그대로 지킨다).
// `hidden`은 '지금 이 토큰의 읽기가 가려져 있는가'로, 루비가 실제로 붙는 토큰에서만
// 참이다(요미 없는 토큰까지 참이면 탭이 아무 일도 없이 먹힌다).
export function shouldRevealPron(enabled, pronDisplay, { hidden = false, revealed = false } = {}) {
  if (!enabled) return false;                          // 꺼져 있으면 탭 동작은 지금과 완전히 같다
  if (!pronRevealAvailable(pronDisplay)) return false; // 가릴 게 없으면 단계도 없다
  return !!hidden && !revealed;
}

// 읽기 모드 프리셋(오너 확정 표) — 키는 실제 설정 키와 1:1(적용 = 그대로 대입).
// 조판(글자·배경·행간)은 건드리지 않는다 — 프리셋은 '표시' 의도만 바꾼다.
// `pronReveal`은 v1-4 R1에서 합류했다: 🙈 암기 확인은 이름부터 인출 연습인데 정작
// 확인하는 길이 없었다(카드 시트를 여는 것뿐). 이제 프리셋이 이름값을 한다.
export const READING_PRESETS = {
  immerse: { pronDisplay: 'none',    wordStateHl: false, focusMode: true,  showToneColors: false, pronReveal: false },
  study:   { pronDisplay: 'all',     wordStateHl: true,  focusMode: false, showToneColors: true,  pronReveal: false },
  recall:  { pronDisplay: 'unknown', wordStateHl: true,  focusMode: false, showToneColors: false, pronReveal: true },
};

// 카드 문안 — 시연 합의 그대로(도구 행과 달리 프리셋 아이콘은 유지가 합의 사항).
export const PRESET_META = [
  { key: 'immerse', icon: '📖', name: '몰입 읽기', desc: '표기·색 끄고 글에 집중' },
  { key: 'study',   icon: '🎓', name: '학습 모드', desc: '발음·상태·성조 전부 표시' },
  { key: 'recall',  icon: '🙈', name: '암기 확인', desc: '모르는 단어만 발음, 탭하면 공개' },
];

// 현재 설정이 프리셋과 정확히 일치할 때만 활성 — 하나라도 손대면 카드 불이 꺼진다.
export function presetActive(name, settings) {
  const p = READING_PRESETS[name];
  return !!p && Object.entries(p).every(([k, v]) => settings?.[k] === v);
}
