import { useState } from 'react';
import { callGemini, GEMINI_MODEL } from './gemini';

const GRAMMAR_ACTIONS = [
  { key: 'translation', label: '🌐 전체 번역',   desc: '자연스러운 한국어 번역' },
  { key: 'breakdown',   label: '🔬 문장 분해',   desc: '주어/서술어/조사 구조 설명' },
  { key: 'grammar',     label: '📐 핵심 문법',   desc: '문법 패턴 + 예문' },
  { key: 'vocab',       label: '📖 어휘 체크',   desc: '핵심 단어·표현 정리' },
  { key: 'nuance',      label: '💬 뉘앙스·활용', desc: '실제 회화에서의 쓰임새' },
  { key: 'full',        label: '✨ 전체 분석',   desc: '번역+분해+문법+어휘 한번에' },
];

export { GRAMMAR_ACTIONS };

export function useGrammarAnalysis({ toast, materialLang }) {
  const [isGrammarModalOpen, setIsGrammarModalOpen] = useState(false);
  const [grammarAnalysis, setGrammarAnalysis] = useState('');
  const [isGrammarLoading, setIsGrammarLoading] = useState(false);
  const [selectedRangeText, setSelectedRangeText] = useState('');
  const [checkedActions, setCheckedActions] = useState(new Set());
  const [selectionPopup, setSelectionPopup] = useState(null);
  const [grammarFollowUp, setGrammarFollowUp] = useState('');
  const [grammarFollowLoading, setGrammarFollowLoading] = useState(false);

  function openGrammarModal() {
    const text = window.getSelection().toString().trim() || selectedRangeText;
    if (!text) { toast('분석할 문장을 드래그해서 선택해주세요.', 'warning'); return; }
    setSelectedRangeText(text);
    setGrammarAnalysis('');
    setGrammarFollowUp('');
    setCheckedActions(new Set());
    setIsGrammarModalOpen(true);
    setSelectionPopup(null);
  }

  async function requestGrammarAnalysis(types) {
    const text = selectedRangeText;
    const isJa = materialLang === 'Japanese';
    setIsGrammarLoading(true);
    setGrammarAnalysis('');

    const sectionPrompts = {
      translation: isJa
        ? `## 전체 번역\n반드시 아래 형식으로 출력:\n직역: (원문에 충실한 번역)\n의역: (자연스러운 한국어)\n뉘앙스: (두 번역 차이와 원문 어감, 2~3문장)`
        : `## 전체 번역\nOutput in this exact format:\n직역: (literal translation)\n의역: (natural Korean translation)\n뉘앙스: (difference and original nuance, 2~3 sentences)`,
      breakdown: isJa
        ? `## 문장 분해\n각 성분을 아래 형식으로 출력:\n주어: (해당 부분 + 간단 설명)\n서술어: (동사/형용사 원형과 활용형)\n목적어: (있을 경우)\n조사: (쓰인 조사와 선택 이유)\n참고: (전체 구조 요약 1~2문장)`
        : `## 문장 분해\nOutput each component in this format:\n주어: (subject + brief note)\n서술어: (verb/predicate form)\n목적어: (object if present)\n조사: (particles used and why)\n참고: (overall structure summary)`,
      grammar: isJa
        ? `## 핵심 문법 포인트\n문법 패턴마다 아래 형식으로 출력 (1~2개):\n패턴: (~형태 — 한 줄 요약)\n의미: (정확한 뜻과 뉘앙스)\n예문: (유사 예문 1개)\n활용법: (주의사항 또는 응용 팁)`
        : `## 핵심 문법 포인트\nFor each pattern (1~2):\n패턴: (pattern form — one-line summary)\n의미: (meaning and nuance)\n예문: (one example sentence)\n활용법: (usage tip or caution)`,
      vocab: isJa
        ? `## 어휘 체크\n핵심 단어마다 아래 형식으로 출력:\n단어: (표기 · 읽기 · 품사)\n의미: (한국어 뜻)\n예문: (짧은 예문 1개)\n참고: (관련 표현 또는 주의 사항, 있을 경우)`
        : `## 어휘 체크\nFor each key word:\n단어: (word · part of speech)\n의미: (Korean meaning)\n예문: (short example sentence)\n참고: (related expressions or notes if any)`,
      nuance: isJa
        ? `## 뉘앙스·활용\n아래 형식으로 출력:\n상황: (이 표현이 쓰이는 구체적 상황/관계)\n격식: (격식체 버전)\n반말: (반말/캐주얼 버전)\n유사표현: (비슷한 표현과 차이점)\n활용법: (실전 사용 시 주의점)`
        : `## 뉘앙스·활용\nOutput in this format:\n상황: (specific context/relationship where this is used)\n격식: (formal version)\n반말: (casual version)\n유사표현: (similar expressions and differences)\n활용법: (practical usage tip)`,
    };

    const activeTypes = types.includes('full')
      ? ['translation', 'breakdown', 'grammar', 'vocab', 'nuance']
      : types.filter(t => t !== 'full');

    let prompt;

    if (activeTypes.length === 1) {
      const intro = isJa
        ? `일본어 문장 「${text}」를 분석해주세요. 한국어로 답변.\n\n`
        : `Analyze the English sentence "${text}". Answer in Korean.\n\n`;
      prompt = intro + sectionPrompts[activeTypes[0]];
    } else {
      const aspectLabels = {
        translation: isJa ? '전체 번역 (직역/의역/뉘앙스)' : '번역 (직역/의역/뉘앙스)',
        breakdown:   isJa ? '문장 구조 분해 (주어/서술어/조사)' : '문장 구조 분해',
        grammar:     isJa ? '핵심 문법 패턴 (패턴/의미/예문/활용법)' : '핵심 문법 패턴',
        vocab:       isJa ? '어휘 체크 (단어/의미/예문)' : '어휘 체크',
        nuance:      isJa ? '뉘앙스·활용 (상황/격식/반말/유사표현)' : '뉘앙스·활용',
      };
      const aspects = activeTypes.map(t => `- ${aspectLabels[t]}`).join('\n');
      const labelExample = isJa
        ? `출력 형식 예시 (반드시 이 형식 준수):
## 전체 번역
직역: 오늘은 날씨가 좋다
의역: 오늘 날씨 정말 좋네
뉘앙스: ~는 대조 강조, 감탄 표현

## 문장 분해
주어: 今日は — 주제/대조 조사
서술어: いいですね — 정중한 감탄형`
        : `Output format example (must follow this format):
## 전체 번역
직역: The weather is nice today
의역: What great weather today
뉘앙스: Casual exclamatory tone`;

      prompt = isJa
        ? `일본어 문장 「${text}」에 대해 아래 항목을 분석해주세요. 한국어로 답변.

분석 항목:
${aspects}

규칙:
- 항목들을 자연스럽게 통합하되, 중복 내용은 한 번만 작성
- 각 섹션은 ## 소제목으로 구분
- 모든 핵심 정보는 반드시 "레이블: 내용" 형식으로 한 줄에 작성 (줄 바꿈 금지)
- 사용 가능한 레이블: 직역 의역 뉘앙스 주어 서술어 목적어 조사 패턴 의미 예문 활용법 단어 상황 격식 반말 유사표현 참고

${labelExample}`
        : `Analyze the English sentence "${text}" covering these aspects. Answer in Korean.

Aspects:
${aspects}

Rules:
- Integrate naturally, mention overlapping info only once
- Separate each section with ## heading
- Write all key info as "레이블: content" on a single line (no line break after colon)
- Available labels: 직역 의역 뉘앙스 주어 서술어 목적어 조사 패턴 의미 예문 활용법 단어 상황 격식 반말 유사표현 참고

${labelExample}`;
    }

    try {
      const result = await callGemini(prompt, null, { model: GEMINI_MODEL });
      setGrammarAnalysis(result);
      setGrammarFollowUp('');
    } catch (err) {
      setGrammarAnalysis('❌ 분석 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setIsGrammarLoading(false);
    }
  }

  /**
   * 단어를 문맥 속에서 해설 (BottomSheet에서 호출)
   * @param {object} token - { text, base_form, meaning, pos, furigana }
   * @param {string} sentence - 단어가 포함된 문장
   */
  async function analyzeWordInContext(token, sentence) {
    if (!token || !sentence) return;
    const isJa = materialLang === 'Japanese';

    // 모달 상태 설정 (이미 있는 UI 재사용)
    const label = `${token.text}${token.base_form && token.base_form !== token.text ? ` (기본형: ${token.base_form})` : ''}`;
    setSelectedRangeText(`${label} — "${sentence}"`);
    setGrammarAnalysis('');
    setGrammarFollowUp('');
    setCheckedActions(new Set(['word-context']));
    setIsGrammarModalOpen(true);
    setSelectionPopup(null);
    setIsGrammarLoading(true);

    const prompt = isJa
      ? `일본어 학습자를 위한 단어 문맥 해설입니다.

단어: ${token.text}
기본형: ${token.base_form || token.text}
품사: ${token.pos || '미상'}
사전적 뜻: ${token.meaning || '(없음)'}

이 단어가 다음 문장에서 어떻게 쓰였는지 한국어로 설명해주세요.

문장: 「${sentence}」

## 출력 형식 (반드시 이 형식)
이 문맥에서의 뜻: (구체적 뜻과 뉘앙스, 1~2문장)
왜 이 뜻인가: (문법적/문맥적 근거, 1~2문장)
어법 포인트: (관련 문법이나 패턴, 있을 때만)
비슷한 표현: (유사 어법, 있을 때만)

규칙:
- 총 3~6줄 내외로 간결하게
- 각 줄은 "레이블: 내용" 형식`
      : `English word in context — explain in Korean.

Word: ${token.text}
Base form: ${token.base_form || token.text}
POS: ${token.pos || 'unknown'}
Dictionary meaning: ${token.meaning || '(none)'}

Sentence: "${sentence}"

## Output format
이 문맥에서의 뜻: (specific meaning and nuance in this context, 1-2 sentences)
왜 이 뜻인가: (grammatical or contextual reason, 1-2 sentences)
어법 포인트: (related grammar, only if relevant)
비슷한 표현: (similar expressions, only if relevant)

Rules:
- 3-6 lines total
- Each line as "label: content"`;

    try {
      const result = await callGemini(prompt, null, { model: GEMINI_MODEL });
      setGrammarAnalysis(result);
    } catch (err) {
      setGrammarAnalysis('❌ 해설 중 오류가 발생했어요: ' + err.message);
    } finally {
      setIsGrammarLoading(false);
    }
  }

  async function askFollowUp() {
    const question = grammarFollowUp.trim();
    if (!question || isGrammarLoading || grammarFollowLoading) return;
    setGrammarFollowLoading(true);
    try {
      const prompt = `원문 문장: 「${selectedRangeText}」\n기존 분석:\n${grammarAnalysis}\n\n추가 질문: ${question}\n\n위 분석 맥락에서 질문에 답변해주세요. 한국어로, 간결하게.`;
      const answer = await callGemini(prompt, null, { model: GEMINI_MODEL });
      setGrammarAnalysis(prev => `${prev}\n\n---\n**Q: ${question}**\n${answer}`);
      setGrammarFollowUp('');
    } catch {
      toast('질문 처리에 실패했어요.', 'error');
    } finally {
      setGrammarFollowLoading(false);
    }
  }

  function handleTextSelection(isModalOpen) {
    if (isModalOpen) return;
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 1) {
      setSelectedRangeText(text);
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      setSelectionPopup({
        x: rect.left + rect.width / 2,
        y: rect.top - 48,
      });
    } else {
      setSelectionPopup(null);
    }
  }

  return {
    isGrammarModalOpen, setIsGrammarModalOpen,
    grammarAnalysis, setGrammarAnalysis,
    isGrammarLoading,
    selectedRangeText, setSelectedRangeText,
    checkedActions, setCheckedActions,
    selectionPopup, setSelectionPopup,
    grammarFollowUp, setGrammarFollowUp,
    grammarFollowLoading,
    openGrammarModal,
    analyzeGrammar: openGrammarModal,
    requestGrammarAnalysis,
    analyzeWordInContext,
    askFollowUp,
    handleTextSelection,
  };
}
