// 일본어 대응 표시(한자 대조 2단계, 옵트인) — 사전 행(meanings jsonb 안 관례 필드 ja)에서
// 대응 정보를 꺼내 표시 문자열로 만든다. 세 형태:
//   図書館(としょかん)  — 신자체 표기가 간체와 다를 때
//   がっこう            — 표기가 같으면 요미만(반복 제거)
//   ≒先生(せんせい)     — 뜻은 같지만 일본어에선 다른 단어를 쓸 때(diff)

/** 사전 행에서 ja를 찾는다 — 사전 승격(buildPromotedEntry)이 뜻 순서를 바꿔도 위치 무관. */
export function getJaRef(dictEntry) {
  const meanings = Array.isArray(dictEntry?.meanings) ? dictEntry.meanings : [];
  for (const m of meanings) {
    if (m && 'ja' in m) return m.ja; // null(대응 없음 판정)도 그대로 반환
  }
  return undefined; // 미판정 레거시
}

/** 표시 문자열 — 대응 없음(null)·미판정(undefined)·형식 불량은 null(표시 생략). */
export function formatJaRef(ja, chineseText) {
  if (!ja || typeof ja !== 'object') return null;
  const form = typeof ja.form === 'string' ? ja.form.trim() : '';
  const yomi = typeof ja.yomi === 'string' ? ja.yomi.trim() : '';
  if (!form || !yomi) return null;
  if (ja.diff === true) return `≒${form}(${yomi})`;
  if (form === String(chineseText || '')) return yomi;
  return `${form}(${yomi})`;
}
