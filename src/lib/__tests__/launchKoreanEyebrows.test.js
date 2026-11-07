import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 발매 점검 #4 · #9(오너 승인 목업 Ez2VCekG8Nub5dTT5wBamA ①, 2026-11-06 KST).
const read = (p) => readFileSync(p, 'utf8');

describe('#9 영어 머리 줄 → 한국어', () => {
  it('복습실 · 01 / 떠올리기 · 02 / 문형 · manabi 교재 · manabi 읽을거리', () => {
    const vocab = read('src/views/VocabPage.jsx');
    expect(vocab.match(/<p className="manabi-eyebrow">복습실<\/p>/g)).toHaveLength(3);
    expect(vocab).toContain('<span className="manabi-eyebrow">01 / 떠올리기</span>');
    expect(vocab).toContain('<p className="manabi-eyebrow">02 / 문형</p>');
    expect(vocab).not.toMatch(/THE REVIEW ROOM|01 \/ RECALL|02 \/ PATTERNS/);
    expect(read('src/components/books/BookCover.jsx')).toContain('<span>manabi 교재</span>');
    expect(read('src/components/materials/SuggestionReader.jsx')).toContain('<p className="manabi-eyebrow">manabi 읽을거리</p>');
  });
});

describe('#4 단어 카드 — 저장 전 단어엔 네 칸이 곧 저장', () => {
  it('저장 전에만 「· 고르면 단어장에 저장돼요」, 간체 · 번체 사전', () => {
    expect(read('src/views/ViewerPage.jsx')).toContain('{vt("얼마나 알겠어요?")}{!isWordSaved && <span className="save-grade__hint"> · {vt("고르면 단어장에 저장돼요")}</span>}');
    expect(read('src/lib/viewerMessages.js')).toContain("['고르면 단어장에 저장돼요','选择后会存入单词本','選擇後會存入單字本']");
  });
});

describe('남은 영어 머리 줄 17곳 → 한국어(오너 승인 2026-11-07 KST — 목업 CrsGiHf5bS4tmQk3n2HVBx ② 권장 A)', () => {
  // 「자리 / 할 일」 짝 — 서재는 「내 서재 / …」, 교재는 「교재 / …」. 함께 읽기 머리(11-04 승인)도 함께 바꿨다.
  const CASES = [
    ['src/components/materials/MaterialComposer.jsx', ['<p className="manabi-eyebrow">내 서재</p>', '<p className="manabi-eyebrow">내 서재 / 저장됨</p>', '<p className="manabi-eyebrow">내 서재 / 직접 쓰기</p>', '<span>나만 보기</span>']],
    ['src/views/MaterialAddPage.jsx', ['<p className="manabi-eyebrow">내 서재 / 가져오기</p>']],
    ['src/views/GroupsPage.jsx', ['<p className="manabi-eyebrow groups-page__eyebrow">내 서재 / 소그룹</p>']],
    ['src/components/materials/OriginalMaterialReader.jsx', ['<p className="manabi-eyebrow">내 서재 / 담아 둔 자료</p>', '<small>원문 링크</small>']],
    ['src/components/materials/PassageStudy.jsx', ['<span className="manabi-eyebrow">학습으로 잇기</span>', '<span className="manabi-eyebrow">고른 구간</span>']],
    ['src/components/books/BookMaterials.jsx', ['<p className="manabi-eyebrow">교재 / 더 읽기</p>', '<small>문화 / {']],
    ['src/components/books/BookReview.jsx', ['<p className="manabi-eyebrow">교재 / 복습</p>']],
    ['src/components/books/BookCover.jsx', ["'외국어 문고'"]],
    ['src/components/notes/StudyNotePage.jsx', ['<small>필기 노트</small>']],
    ['src/components/notes/NoteVocabulary.jsx', ['<small>내 단어</small>']],
    ['src/components/notes/NoteRecognition.jsx', ['<small>필기 → 단어</small>']],
    ['src/components/classroom/BoardInkRecognition.jsx', ['<small>필기 → 표현</small>']],
    ['src/components/classroom/ClassroomUI.jsx', ['<span className="classroom-eyebrow">manabi / 수업</span>', '<span>manabi / 수업</span>']],
    ['src/views/ClassHubPage.jsx', ['<span className="classroom-eyebrow">manabi / 수업</span>']],
    ['src/views/ClassBoardPage.jsx', ['<span className="classroom-eyebrow">manabi / 수업</span>']],
  ];
  it.each(CASES)('%s', (file, labels) => {
    const src = read(file);
    for (const label of labels) expect(src).toContain(label);
    expect(src).not.toMatch(/YOUR LIBRARY|A PAGE OF YOUR OWN|PRIVATE \/|IMPORT \/|TOGETHER \/|KEPT FOR ANOTHER DAY|ORIGINAL LINK|READ INTO LEARNING|A PASSAGE TO KEEP|BEYOND THE BOOK|CULTURE \/|WORDS TO KEEP|LANGUAGE COLLECTION|PERSONAL NOTEBOOK|MY WORDS|→ WORDS|MANABI \/ CLASS|manabi \/ class/);
  });
});
