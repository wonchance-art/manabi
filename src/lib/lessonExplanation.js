'use client';
import { supabase } from './supabase';
import { callGemini } from './gemini';

/**
 * 강의 자료의 한국어 설명을 가져오거나 생성.
 * 1) DB 캐시(lesson_explanation_ko) 있으면 즉시 반환
 * 2) 없으면 Gemini 생성 후 DB 저장
 *
 * @param {object} material reading_materials row
 * @returns {Promise<string|null>}
 */
export async function fetchOrGenerateExplanation(material) {
  if (!material) return null;
  if (material.lesson_explanation_ko) return material.lesson_explanation_ko;

  const lang = material.processed_json?.metadata?.language || 'Japanese';
  const langName = lang === 'Japanese' ? '일본어' : '영어';

  const prompt = `다음 ${langName} 학습 자료의 핵심 패턴을 한국어 학습자에게 친화적으로 설명해주세요.

자료 제목: ${material.title}

본문 예시:
${(material.raw_text || '').slice(0, 800)}

아래 형식으로 200~280자 이내, 친화적 톤. 마크다운 **굵게** 활용:

**패턴**
이 자료가 다루는 핵심 표현·문법을 한 문장으로

**공식**
패턴의 형식 (예: "A は B です" 또는 "be 동사 + 형용사")

**언제 쓸까**
이 패턴을 어떤 상황에 쓰는지 1~2문장

**주의**
한국어 학습자가 자주 하는 실수 1개 (한 문장)

도입·인사 문구 없이 바로 시작.`;

  try {
    const raw = await callGemini(prompt);
    const text = (raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw || '').trim();
    if (!text) return null;

    // DB 캐시 (fire-and-forget — 실패해도 사용자에게는 결과 반환)
    supabase.from('reading_materials')
      .update({ lesson_explanation_ko: text })
      .eq('id', material.id)
      .then(() => {});

    return text;
  } catch {
    return null;
  }
}
