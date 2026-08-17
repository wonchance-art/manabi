/**
 * 단어 상세 markdown → HTML
 * 도입 문구 제거, **섹션 제목**(뜻/뉘앙스/예문/발음)은 hr + heading,
 * 일반 **bold**는 그대로, 빈 줄은 단락 분리.
 *
 * 보안: 결과는 뷰어에서 dangerouslySetInnerHTML로 렌더되고, 입력(morpheme_dictionary.detail_text)은
 * 로그인 사용자 누구나 쓸 수 있는 크라우드소싱 필드다(POST /api/word-detail). 따라서 원문을 먼저
 * HTML 이스케이프해 저장형 XSS를 차단하고, 이 함수가 직접 만드는 태그(strong·hr·p·br)만 뒤에서
 * 재삽입한다. 이스케이프 순서상 &를 가장 먼저 치환해야 한다.
 */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDetail(text) {
  if (!text) return '';
  const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '-');
  const startIdx = lines.findIndex(l => l.startsWith('**'));
  const cleaned = (startIdx > 0 ? lines.slice(startIdx) : lines).join('\n');
  return escapeHtml(cleaned)
    .replace(/\*\*(.+?)\*\*/g, (_, m) => {
      if (/^(번역|맥락|발음|뜻|뉘앙스|예문)$/.test(m.trim())) {
        return `<hr class="pdf-detail-hr" /><strong class="pdf-detail-heading">${m}</strong>`;
      }
      return `<strong>${m}</strong>`;
    })
    // 병음 줄(⟪py⟫ 마커 — 중국어 예문 아래 표시 시점 합성, wordDetail.injectExamplePinyin)
    .replace(/⟪py⟫([^\n]*)/g, '<span class="pdf-detail-pinyin">$1</span>')
    .split('\n').map(l => l.trim()).filter(Boolean).join('<br />')
    .replace(/(<br \/>){2,}/g, '</p><p>')
    .replace(/^/, '<p>').replace(/$/, '</p>');
}
