/**
 * 📚 책에 이어 적기 — 순수 부품 (#1077 설계 5520128974, 오너 「하루 한두 챕터씩 적으면서 완성」 ㄱㄱㄱ).
 *
 * 책은 가상 컨테이너다(bookMeta.js — 챕터 자료들이 metadata.book {key,title,order,total}을 공유).
 * 입구 3종이 전부 「한 번에 전부 → 등분 → 새 key」라 오늘 배운 1과를 넣으면 새 책이 하나 더 생겼다.
 * 여기서는 **기존 key에 다음 순번으로 이어 붙이는** 계산만 한다 — 순번·제목·키 결정·내 책 목록.
 * 등록·조회는 기존 흐름(handleBookRegister·형제 챕터 조회) 그대로. `total`은 「등록 시점 개수」일 뿐
 * 표시 소비처가 없다(자료실·뷰어 모두 실개수) — 이어 붙여도 낡은 total이 화면에 나오지 않는다.
 */
import { getBook } from './bookMeta';

/** 다음 과 순번 — 형제 챕터 order 최댓값 + 1(없으면 1). 숫자가 아닌 order는 무시. */
export function nextChapterOrder(chapters) {
  let max = 0;
  for (const c of chapters || []) {
    const o = Number(c?.order ?? c?._bookOrder);
    if (Number.isFinite(o) && o > max) max = o;
  }
  return max + 1;
}

/** 과 제목 — 문장 목록 입구의 `N과` 규약 그대로(sentenceListImport 계약). */
export function chapterTitle(order) {
  return `${order}과`;
}

/** 분할 결과(1과부터)를 startOrder부터 다시 매긴다. 본문은 손대지 않는다. */
export function renumberChapters(chapters, startOrder) {
  const start = Number.isFinite(Number(startOrder)) && Number(startOrder) >= 1 ? Number(startOrder) : 1;
  return (chapters || []).map((ch, i) => ({ ...ch, title: chapterTitle(start + i) }));
}

/**
 * 등록 키 — 이어 적기면 책의 key, 아니면 새로 만든다. makeKey는 이어 적기에서 **호출되지 않는다**
 * (호출되면 같은 책이 둘로 갈라진다 — 계약).
 */
export function bookKeyForDraft(draft, makeKey) {
  const key = draft?.append?.key;
  if (typeof key === 'string' && key) return key;
  return makeKey();
}

/** 이어 적기 등록의 순번·총수 — 새 책이면 1부터·챕터 수, 이어 적기면 다음 순번부터·기존+새 챕터 수. */
export function appendPlanOf(draft) {
  const n = draft?.chapters?.length || 0;
  const startOrder = Number(draft?.append?.startOrder) >= 1 ? Number(draft.append.startOrder) : 1;
  const existingCount = Number(draft?.append?.existingCount) >= 0 ? Number(draft.append.existingCount) : 0;
  return { startOrder, existingCount, total: existingCount + n, lastOrder: startOrder + n - 1 };
}

/**
 * 내 자료 행 → 이어 적을 수 있는 책 목록. 같은 key끼리 묶고, 제목은 book.title, 언어·난이도는
 * 첫 챕터 metadata, count·lastOrder는 실개수·최대 순번, latest는 가장 최근 created_at.
 * 정렬은 latest 내림차순(어제 적던 책이 맨 위).
 * @param {Array<{id, created_at, processed_json:{metadata:{language, level, book}}}>} rows
 */
export function listAppendableBooks(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const meta = r?.processed_json?.metadata;
    const book = getBook(meta);
    if (!book) continue;
    let b = map.get(book.key);
    if (!b) {
      b = { key: book.key, title: book.title, language: meta?.language || null, level: meta?.level || null, count: 0, lastOrder: 0, latest: '' };
      map.set(book.key, b);
    }
    b.count += 1;
    if (book.order > b.lastOrder) b.lastOrder = book.order;
    if (!b.title && book.title) b.title = book.title;
    const at = String(r?.created_at || '');
    if (at > b.latest) b.latest = at;
  }
  return [...map.values()].sort((a, b) => (a.latest < b.latest ? 1 : a.latest > b.latest ? -1 : 0));
}

/** 내용 줄 수(빈 줄 제외) — 마지막 과의 문장 수로 「과당 문장 수」를 물려받을 때. */
export function countContentLines(text) {
  return String(text || '').split('\n').filter((l) => l.trim()).length;
}
