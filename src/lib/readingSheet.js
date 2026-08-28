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

// 읽기 모드 프리셋(오너 확정 표) — 키는 실제 설정 키와 1:1(적용 = 그대로 대입).
// 조판(글자·배경·행간)은 건드리지 않는다 — 프리셋은 '표시' 의도만 바꾼다.
export const READING_PRESETS = {
  immerse: { pronDisplay: 'none',    wordStateHl: false, focusMode: true,  showToneColors: false },
  study:   { pronDisplay: 'all',     wordStateHl: true,  focusMode: false, showToneColors: true },
  recall:  { pronDisplay: 'unknown', wordStateHl: true,  focusMode: false, showToneColors: false },
};

// 카드 문안 — 시연 합의 그대로(도구 행과 달리 프리셋 아이콘은 유지가 합의 사항).
export const PRESET_META = [
  { key: 'immerse', icon: '📖', name: '몰입 읽기', desc: '표기·색 끄고 글에 집중' },
  { key: 'study',   icon: '🎓', name: '학습 모드', desc: '발음·상태·성조 전부 표시' },
  { key: 'recall',  icon: '🙈', name: '암기 확인', desc: '모르는 단어만 발음, 상태 표시' },
];

// 현재 설정이 프리셋과 정확히 일치할 때만 활성 — 하나라도 손대면 카드 불이 꺼진다.
export function presetActive(name, settings) {
  const p = READING_PRESETS[name];
  return !!p && Object.entries(p).every(([k, v]) => settings?.[k] === v);
}
