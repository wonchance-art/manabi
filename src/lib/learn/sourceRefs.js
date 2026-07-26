// 실자료 src 필드(RFC authentic-sources §3) 집계 — 챕터 하단 출처 블록용 순수 로직.

function pushSrc(acc, src) {
  if (!src || typeof src !== 'object') return;
  const key = `${src.provider}|${src.by ?? ''}|${src.license}`;
  if (!acc.has(key)) {
    acc.set(key, { provider: src.provider, by: src.by, license: src.license, count: 0 });
  }
  acc.get(key).count += 1;
}

function walkDialogue(acc, dialogue) {
  if (!Array.isArray(dialogue)) return;
  for (const line of dialogue) pushSrc(acc, line?.src);
}

/** 챕터 전 섹션에서 src 표기를 수집해 provider·저작자·라이선스 단위로 묶는다. */
export function collectSrcAttributions(chapter) {
  const acc = new Map();
  for (const sec of chapter?.sections ?? []) {
    walkDialogue(acc, sec?.dialogue);
    walkDialogue(acc, sec?.original?.dialogue);
    walkDialogue(acc, sec?.variant?.dialogue);
    for (const ex of sec?.examples ?? []) {
      pushSrc(acc, ex?.src);
      walkDialogue(acc, ex?.dialogue);
    }
  }
  return [...acc.values()].sort((a, b) => b.count - a.count);
}
