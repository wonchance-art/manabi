import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 본문 듣기(ListenControls)가 소리를 내지 못하면 단어 발음과 같은 안내(TTS-GAP-001)를 띄운다 — 같은 조건 · 같은 문구 · 같은 토스트.
// 렌더 테스트(훅 대역 — authExplicitLoginRace.test.jsx 관례, DOM 환경 없음). 안내는 providers에 붙은 SpeechUnavailableNotice를
// 실제로 구독시켜, 듣기 막대 → notifySpeechUnavailable → 토스트(문구 · 'warning')까지 한 길로 확인한다.
const h = vi.hoisted(() => ({ slots: [], index: 0, effects: [], dirty: false, toast: null }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useState(initial) {
      const index = h.index++;
      if (!(index in h.slots)) h.slots[index] = initial;
      return [h.slots[index], (value) => {
        h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value;
        h.dirty = true;
      }];
    },
    useRef(initial) {
      const index = h.index++;
      if (!(index in h.slots)) h.slots[index] = { current: initial };
      return h.slots[index];
    },
    useEffect(fn, deps) {
      const index = h.index++, previous = h.slots[index];
      if (!previous || !deps || deps.some((value, i) => value !== previous.deps[i])) {
        h.effects.push(fn);
        h.slots[index] = { deps };
      }
    },
  };
});
vi.mock('../../lib/ToastContext', () => ({ useToast: () => h.toast }));

const ja = { lang: 'ja-JP', localService: true, voiceURI: 'local-ja' };
const ko = { lang: 'ko-KR', localService: true, voiceURI: 'local-ko' };
const KO_TEXT = '안녕하세요. 반갑습니다.';
const JA_TEXT = '駅はどこですか。ありがとう。';

let ListenControls, SpeechUnavailableNotice, messages, voices, utterances, synth, onSentence, props;

function run(component, componentProps) {
  let tree;
  for (let pass = 0; pass < 10; pass += 1) {
    h.index = 0; h.dirty = false;
    tree = component(componentProps);
    h.effects.splice(0).forEach((fn) => fn());
    if (!h.dirty) return tree;
  }
  return tree;
}
const render = () => run(ListenControls, props);

function walk(node, found = []) {
  if (Array.isArray(node)) { node.forEach((child) => walk(child, found)); return found; }
  if (!node || typeof node !== 'object' || !node.props) return found;
  found.push(node);
  walk(node.props.children, found);
  return found;
}
const button = (tree, name) => walk(tree).find((el) => el.type === 'button' && (el.props['aria-label'] === name || el.props.title === name));
// 버튼을 눌러(이벤트 처리 중 상태가 바뀌면) 다시 그린 화면을 돌려준다.
const tap = (tree, name) => { button(tree, name).props.onClick(); return render(); };
const fire = (utter, kind, event = {}) => { utter[kind](event); return render(); };

async function mount({ language = 'Korean', text = KO_TEXT, throwOnSpeak = false } = {}) {
  synth = {
    cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(), getVoices: () => voices,
    speak: vi.fn((u) => { if (throwOnSpeak) throw new Error('not-allowed'); utterances.push(u); }),
  };
  vi.stubGlobal('window', { speechSynthesis: synth, SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } } });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {} });
  vi.resetModules(); // 같은 이유 10초 묶음(SPEECH_NOTICE_GAP_MS)을 테스트마다 비운다
  ({ default: ListenControls } = await import('../ListenControls'));
  ({ default: SpeechUnavailableNotice } = await import('../SpeechUnavailableNotice'));
  messages = await import('../../lib/errorMessage');
  h.toast = vi.fn();
  h.slots = []; run(SpeechUnavailableNotice, {}); // providers처럼 안내를 먼저 구독한다
  h.slots = [];
  onSentence = vi.fn();
  props = { text, language, onSentence, compact: true, uiLocale: 'ko', playbackRate: 0.85, rateLabel: '1×' };
  return render();
}

beforeEach(() => { voices = [ja]; utterances = []; });
afterEach(() => { vi.unstubAllGlobals(); });

describe('본문 듣기 — 소리를 낼 수 없으면 단어 발음과 같은 안내', () => {
  it('그 언어의 목소리가 없으면(한국어 음성 없음) 시작하지 않고 「이 기기에서는 소리를 낼 수 없어요.」', async () => {
    let tree = await mount();
    tree = tap(tree, '본문 전체 듣기');
    expect(utterances).toHaveLength(0);
    expect(h.toast).toHaveBeenCalledTimes(1);
    expect(h.toast).toHaveBeenCalledWith(messages.SPEECH_UNAVAILABLE_MESSAGE, 'warning');
    expect(messages.SPEECH_UNAVAILABLE_MESSAGE).toBe('이 기기에서는 소리를 낼 수 없어요.');
    expect(button(tree, '본문 전체 듣기'), '막대는 정지 상태 그대로').toBeTruthy();
    expect(button(tree, '정지')).toBeUndefined();
    expect(onSentence).not.toHaveBeenCalledWith(0);
  });

  it('목소리가 있으면 안내 없이 읽고, 재생 · 일시정지 · 따라가기(문장 번호)는 지금 그대로', async () => {
    let tree = await mount({ language: 'Japanese', text: JA_TEXT });
    tree = tap(tree, '본문 전체 듣기');
    expect(utterances.map((u) => [u.text, u.lang, u.rate])).toEqual([['駅はどこですか。', 'ja-JP', 0.85]]);
    expect(onSentence).toHaveBeenLastCalledWith(0);
    tree = tap(tree, '일시정지');
    expect(synth.pause).toHaveBeenCalledTimes(1);
    tree = tap(tree, '재생');
    expect(synth.resume).toHaveBeenCalledTimes(1);
    tree = fire(utterances[0], 'onend');
    expect(utterances.map((u) => u.text)).toEqual(['駅はどこですか。', 'ありがとう。']);
    expect(onSentence).toHaveBeenLastCalledWith(1);
    tree = fire(utterances[1], 'onend');
    expect(onSentence).toHaveBeenLastCalledWith(null);
    expect(button(tree, '본문 전체 듣기')).toBeTruthy();
    expect(h.toast).not.toHaveBeenCalled();
  });

  it('한국어도 목소리가 있으면 안내 없이 읽는다 · 한국어가 아닌 언어는 목소리 목록이 비어도 지금처럼 바로 읽는다(useTTS와 같은 조건)', async () => {
    voices = [ja, ko];
    let tree = await mount();
    tree = tap(tree, '본문 전체 듣기');
    expect(utterances.map((u) => [u.text, u.lang]), '단어 발음과 같은 ko-KR(en-US 폴백 아님)').toEqual([['안녕하세요.', 'ko-KR']]);
    voices = []; utterances = [];
    tree = await mount({ language: 'Japanese', text: JA_TEXT });
    tree = tap(tree, '본문 전체 듣기');
    expect(utterances.map((u) => u.text)).toEqual(['駅はどこですか。']);
    expect(h.toast).not.toHaveBeenCalled();
  });
});

describe('본문 듣기 — 읽는 중 실패', () => {
  it('엔진 오류 → 「소리를 재생하지 못했어요. 잠시 후 다시 눌러 주세요.」 · 막대 · 강조 · 진행이 처음으로', async () => {
    let tree = await mount({ language: 'Japanese', text: JA_TEXT });
    tree = tap(tree, '본문 전체 듣기');
    tree = fire(utterances[0], 'onend');
    synth.cancel.mockClear();
    tree = fire(utterances[1], 'onerror', { error: 'synthesis-failed' });
    expect(h.toast).toHaveBeenCalledTimes(1);
    expect(h.toast).toHaveBeenCalledWith(messages.SPEECH_FAILED_MESSAGE, 'warning');
    expect(messages.SPEECH_FAILED_MESSAGE).toBe('소리를 재생하지 못했어요. 잠시 후 다시 눌러 주세요.');
    expect(synth.cancel).toHaveBeenCalled();
    expect(onSentence).toHaveBeenLastCalledWith(null);
    expect(button(tree, '본문 전체 듣기')).toBeTruthy();
    expect(button(tree, '정지')).toBeUndefined();
    tree = tap(tree, '본문 전체 듣기');
    expect(utterances.at(-1).text, '다시 누르면 첫 문장부터').toBe('駅はどこですか。');
  });

  it('엔진이 발화를 바로 거절하면(예: iOS 탭 밖) 같은 실패 안내 · 정지 상태', async () => {
    let tree = await mount({ language: 'Japanese', text: JA_TEXT, throwOnSpeak: true });
    tree = tap(tree, '본문 전체 듣기');
    expect(h.toast).toHaveBeenCalledWith(messages.SPEECH_FAILED_MESSAGE, 'warning');
    expect(button(tree, '본문 전체 듣기')).toBeTruthy();
    expect(onSentence).toHaveBeenLastCalledWith(null);
  });

  // 뷰어 점검 2026-10-23: 단어 발음이 끼어들면 듣기가 정지돼 처음부터였다 — 이제 그 문장에서 멈추고 ▶로 그 문장부터 잇는다.
  it('취소 · 끊김(단어 발음이 이어받음)은 안내 없이 그 문장에서 멈추고 ▶로 그 문장부터 잇는다 · 정지한 옛 세션의 오류는 무시', async () => {
    let tree = await mount({ language: 'Japanese', text: JA_TEXT });
    tree = tap(tree, '본문 전체 듣기');
    tree = fire(utterances[0], 'onend');
    const second = utterances[1].text;
    tree = fire(utterances[1], 'onerror', { error: 'interrupted' });
    expect(button(tree, '재생')).toBeTruthy();
    expect(button(tree, '본문 전체 듣기')).toBeFalsy();
    expect(synth.resume).not.toHaveBeenCalled();
    tree = tap(tree, '재생');
    expect(synth.resume).not.toHaveBeenCalled();
    expect(utterances.at(-1).text).toBe(second);
    expect(onSentence).toHaveBeenLastCalledWith(1);
    tree = tap(tree, '정지');
    tree = tap(tree, '본문 전체 듣기');
    tree = tap(tree, '정지');
    tree = fire(utterances.at(-1), 'onerror', { error: 'synthesis-failed' });
    expect(h.toast).not.toHaveBeenCalled();
  });
});
