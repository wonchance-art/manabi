# COPY-STD-001 바뀐 문구 표 (전 · 후 · 파일)

- 같은 줄을 두 번 고친 곳은 최종 결과로 합쳤다. 「(관리자)」는 관리자 화면, 「(번역표 키)」는 뷰어 번역표(viewerMessages.js) 첫 칸.
- 「n」은 같은 파일에서 같은 문구가 바뀐 곳의 수.

## 실패 끝맺음 — 105건 · 114곳

| 전 | 후 | 파일 | n |
|---|---|---|---|
| title: '콘텐츠를 불러올 수 없습니다' | title: '자료를 불러오지 못했어요' | `src/app/(app)/viewer/error.jsx` | 1 |
| 홈 화면을 불러올 수 없습니다 | 홈 화면을 불러오지 못했어요 | `src/app/(app)/home/error.jsx` | 1 |
| PDF를 열 수 없습니다 | PDF를 열지 못했어요 | `src/app/(app)/pdf/[id]/error.jsx` | 1 |
| 단어장을 불러올 수 없습니다 | 단어장을 불러오지 못했어요 | `src/app/(app)/vocab/error.jsx` | 1 |
| '설명 생성에 실패했어요.' | '설명을 만들지 못했어요.' | `src/app/api/explain/route.js` | 1 |
| '해설 생성에 실패했어요.' | '해설을 만들지 못했어요.' | `src/app/api/explain/route.js` | 1 |
| '문단 생성에 실패했어요.' | '문단을 만들지 못했어요.' | `src/app/api/study-paragraph/route.js` | 1 |
| '첨삭 생성에 실패했어요. 잠시 후 다시 시도해주세요.' | '첨삭을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' | `src/app/api/writing-feedback/route.js` | 1 |
| '삭제 실패' | '계정을 삭제하지 못했어요.' | `src/app/api/account/delete/route.js` | 1 |
| `데이터 조회 실패: ${failed.join(', ')}` | `데이터를 불러오지 못했어요: ${failed.join(', ')}` | `src/components/AccountSettings.jsx` — 내부 오류(화면에는 friendlyError 경유) | 1 |
| toast('변경 실패 — ' + friendlyToastMessage(err), 'error'); | toast(failureMessage(passwordLogin ? '비밀번호를 바꾸지 못했어요.' : '비밀번호를 만들지 못했어요.', err), 'error'); | `src/components/AccountSettings.jsx` | 1 |
| toast('내보내기 실패 — ' + friendlyToastMessage(err), 'error'); | toast(failureMessage('데이터를 내보내지 못했어요.', err), 'error'); | `src/components/AccountSettings.jsx` | 1 |
| throw new Error(json.error \|\| '삭제 실패'); | throw new Error(json.error \|\| 'account delete failed'); | `src/components/AccountSettings.jsx` | 1 |
| toast('삭제 실패 — ' + friendlyToastMessage(err), 'error'); | toast(failureMessage('계정을 삭제하지 못했어요.', err), 'error'); | `src/components/AccountSettings.jsx` | 1 |
| toast('재발송 실패 — ' + friendlyToastMessage(err, '잠시 후 다시 시도'), 'error'); | toast(failureMessage('인증 메일을 보내지 못했어요.', err), 'error'); | `src/components/Layout.jsx` | 1 |
| setError('저장 실패: ' + friendlyToastMessage(err)); | setError(failureMessage('프로필을 저장하지 못했어요.', err)); | `src/components/OnboardingModal.jsx` | 1 |
| toast('신고 실패 — ' + friendlyToastMessage(err, '잠시 후 다시 시도'), 'error'); | toast(failureMessage('신고를 접수하지 못했어요.', err), 'error'); | `src/components/ReportMaterialButton.jsx` | 1 |
| '(시작에 실패했어요. 다시 시도해 주세요)' | '(대화를 시작하지 못했어요. 다시 시도해 주세요)' | `src/components/ConversationPanel.jsx` | 1 |
| 복습 저장 실패 — 연결을 확인해주세요. 이 단어는 다음에 다시 나와요. | 복습을 저장하지 못했어요. 연결을 확인해 주세요 — 이 단어는 다음에 다시 나와요. | `src/components/vocab/FsrsReviewSession.jsx` | 1 |
| 복습 저장 실패 — 연결을 확인해주세요. 이 단어는 다음에 다시 나와요. | 복습을 저장하지 못했어요. 연결을 확인해 주세요 — 이 단어는 다음에 다시 나와요. | `src/views/VocabPage.jsx` | 6 |
| PDF 파일 주소를 불러올 수 없어요. | PDF 파일 주소를 불러오지 못했어요. | `src/components/PdfJsViewer.jsx` | 1 |
| toast?.('정제 검사 실패: ' + friendlyToastMessage(err), 'error'); | toast?.(failureMessage('정제 검사를 하지 못했어요.', err), 'error'); | `src/components/BookRefinePanel.jsx` | 1 |
| friendlyToastMessage(err, '실패') | friendlyToastMessage(err, '정제하지 못했어요.') | `src/components/BookRefinePanel.jsx` | 1 |
| ${failed ? ` · ${failed}과 실패` : ''} | ${failed ? ` · ${failed}과는 정제하지 못했어요` : ''} | `src/components/BookRefinePanel.jsx` | 1 |
| '복원에 실패했어요.' | '복원하지 못했어요.' | `src/components/admin/ChapterAdminStrip.jsx` (관리자) | 1 |
| '불러오기에 실패했어요.' | '불러오지 못했어요.' | `src/components/admin/InlineEditForm.jsx` (관리자) | 1 |
| '저장에 실패했어요.' | '저장하지 못했어요.' | `src/components/admin/InlineEditForm.jsx` (관리자) | 1 |
| 해당 구간의 출처를 열 수 없어요. 현재 자료는 그대로 읽을 수 있습니다. | 해당 구간의 출처를 열지 못했어요. 현재 자료는 그대로 읽을 수 있어요. | `src/components/materials/OriginalMaterialReader.jsx` | 1 |
| 기록에 실패했어요. 다시 시도해 주세요. | 기록하지 못했어요. 다시 시도해 주세요. | `src/components/world/StoryOverlay.jsx` | 1 |
| '플랫폼 저장에 실패했어요. 연결을 확인해 주세요.' | '플랫폼을 저장하지 못했어요. 연결을 확인해 주세요.' | `src/components/world/overworldRegionScene.js` | 1 |
| '귀환 위치 저장에 실패했어요. 연결을 확인해 주세요.' | '귀환 위치를 저장하지 못했어요. 연결을 확인해 주세요.' | `src/components/world/overworldRegionScene.js` | 1 |
| '종착역 저장에 실패했어요. 연결을 확인하고 다시 시도해 주세요.' | '종착역을 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.' | `src/components/world/transsibCorridorScene.js` | 1 |
| onError: (err) => toast('삭제 실패: ' + friendlyToastMessage(err), 'error'), | onError: (err) => toast(failureMessage('휴지통으로 옮기지 못했어요.', err), 'error'), | `src/views/MaterialAddPdfSection.jsx` | 1 |
| toast('업로드 실패: ' + friendlyToastMessage(err), 'error'); | toast(failureMessage('PDF를 올리지 못했어요.', err), 'error'); | `src/views/MaterialAddPdfSection.jsx` | 1 |
| throw new Error('PDF 접근 실패'); | throw new Error('PDF를 열지 못했어요.'); | `src/views/MaterialAddPdfSection.jsx` | 1 |
| toast('텍스트 추출 실패: ' + friendlyToastMessage(err), 'error'); | toast(failureMessage('텍스트를 추출하지 못했어요.', err), 'error'); | `src/views/MaterialAddPdfSection.jsx` | 1 |
| onError: (err) => toast('삭제 실패: ' + friendlyToastMessage(err), 'error'), | onError: (err) => toast(failureMessage('휴지통으로 옮기지 못했어요.', err), 'error'), | `src/views/MaterialsPage.jsx` | 1 |
| onError: (err) => toast('변경 실패: ' + friendlyToastMessage(err), 'error'), | onError: (err) => toast(failureMessage('공개 범위를 바꾸지 못했어요.', err), 'error'), | `src/views/MaterialsPage.jsx` | 1 |
| 자료 목록을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요. | 자료 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요. | `src/views/MaterialsPage.jsx` | 1 |
| tokens: '단어 분석에 실패했어요.' | tokens: '단어를 분석하지 못했어요.' | `src/views/PdfViewerPage.jsx` | 1 |
| context: '번역과 맥락 생성에 실패했어요.' | context: '번역과 맥락을 만들지 못했어요.' | `src/views/PdfViewerPage.jsx` | 1 |
| toast('저장 실패', 'error'); | toast('단어를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.', 'error'); | `src/views/PdfViewerPage.jsx` | 1 |
| PDF 파일 주소를 불러올 수 없어요. | PDF 파일 주소를 불러오지 못했어요. | `src/views/PdfViewerPage.jsx` | 1 |
| toast('추가 실패 — ' + friendlyToastMessage(err), 'error'); | toast(failureMessage('단어를 추가하지 못했어요.', err), 'error'); | `src/views/VocabPage.jsx` | 1 |
| toast('되돌리기 실패 — ' + friendlyToastMessage(err), 'error'); | toast(failureMessage('되돌리지 못했어요.', err), 'error'); | `src/views/VocabPage.jsx` | 1 |
| toast('예문 생성에 실패했어요.', 'error'); | toast('예문을 만들지 못했어요.', 'error'); | `src/views/VocabPage.jsx` | 1 |
| throw new Error(j.error \|\| '삭제 실패'); | throw new Error(j.error \|\| 'override delete failed'); | `src/views/AdminPage.jsx` (관리자) | 1 |
| onError: (err) => toast('삭제 실패: ' + friendlyToastMessage(err), 'error'), | onError: (err) => toast(failureMessage('삭제하지 못했어요.', err), 'error'), | `src/views/AdminPage.jsx` (관리자) | 3 |
| onError: (err) => toast('역할 변경 실패: ' + friendlyToastMessage(err), 'error'), | onError: (err) => toast(failureMessage('역할을 바꾸지 못했어요.', err), 'error'), | `src/views/AdminPage.jsx` (관리자) | 1 |
| onError: (err) => toast('변경 실패: ' + friendlyToastMessage(err), 'error'), | onError: (err) => toast(failureMessage('바꾸지 못했어요.', err), 'error'), | `src/views/AdminPage.jsx` (관리자) | 1 |
| onError: (err) => toast('추가 실패: ' + friendlyToastMessage(err), 'error'), | onError: (err) => toast(failureMessage('소스를 추가하지 못했어요.', err), 'error'), | `src/views/AdminPage.jsx` (관리자) | 1 |
| toast('수업 만들기 실패 — ' + friendlyToastMessage(err), 'error'); | toast(failureMessage('수업을 만들지 못했어요.', err), 'error'); | `src/views/ClassHubPage.jsx` | 1 |
| toast('설정 저장 실패 — ' + friendlyToastMessage(err), 'error'); | toast(failureMessage('설정을 저장하지 못했어요.', err), 'error'); | `src/views/ClassHubPage.jsx` | 1 |
| toast('암호 변경 실패 — ' + friendlyToastMessage(err), 'error'); | toast(failureMessage('암호를 바꾸지 못했어요.', err), 'error'); | `src/views/ClassHubPage.jsx` | 1 |
| '목록을 못 받았어요. 잠시 후 다시 열어 주세요.' | '목록을 받지 못했어요. 잠시 후 다시 열어 주세요.' | `src/views/ClassTeamPage.jsx` | 1 |
| 지금은 교재 정보를 불러올 수 없어요. <button type="button" onClick={() => location.reload()}>다시 확인</button> | 지금은 교재 정보를 불러오지 못했어요. <button type="button" onClick={() => location.reload()}>다시 시도</button> | `src/views/HomePage.jsx` | 1 |
| '책 등록 실패 — ' + friendlyToastMessage(err) | failureMessage('책을 등록하지 못했어요.', err) | `src/views/MaterialAddPage.jsx` | 1 |
| toast('테스트 발송에 실패했어요.', 'error'); | toast('테스트 알림을 보내지 못했어요.', 'error'); | `src/views/MyPage.jsx` | 2 |
| toast('동기화 실패 — 이 기기에는 저장됐어요', 'error'); | toast('동기화하지 못했어요. 이 기기에는 저장됐어요.', 'error'); | `src/views/ProfileStats.jsx` | 1 |
| friendlyToastMessage(e, '분석에 실패했어요.') | friendlyToastMessage(e, '분석하지 못했어요.') | `src/views/QuickPage.jsx` | 1 |
| toast('저장 실패', 'error'); | toast('단어를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.', 'error'); | `src/views/QuickPage.jsx` | 1 |
| 기록에 실패했어요. 잠시 후 다시 시도해 주세요. | 기록하지 못했어요. 잠시 후 다시 시도해 주세요. | `src/views/ReadingTextView.jsx` | 1 |
| 트랙을 불러올 수 없어요. | 트랙을 불러오지 못했어요. | `src/views/ReadingTrackPage.jsx` | 1 |
| 기록에 실패했어요. 다시 시도해 주세요. | 기록하지 못했어요. 다시 시도해 주세요. | `src/views/ReadingTrackPage.jsx` | 1 |
| toast?.('저장 실패', 'error'); | toast?.('문형을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.', 'error'); | `src/views/ReferencePatternIndexPage.jsx` | 1 |
| toast?.('저장 실패', 'error'); | toast?.('단어를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.', 'error'); | `src/views/ReferenceVocabPage.jsx` | 1 |
| 첨삭을 못 받았어요 — 다음에 다시 | 첨삭을 받지 못했어요 — 다음에 다시 해 봐요 | `src/views/StudySessionPage.jsx` | 1 |
| '첨삭에 실패했어요. 잠시 후 다시 시도해주세요.' | '첨삭을 받지 못했어요. 잠시 후 다시 시도해 주세요.' | `src/views/WritingStudioPage.jsx` | 1 |
| onError: (err) => toast('수정 실패 — ' + friendlyToastMessage(err), 'error'), | onError: (err) => toast(failureMessage('수정을 저장하지 못했어요.', err), 'error'), | `src/views/ViewerPage.jsx` | 1 |
| toast('단어장 반영은 실패했어요 — 이 자료에는 반영됐어요.', 'warning'); | toast('단어장에는 반영하지 못했어요. 이 자료에는 반영됐어요.', 'warning'); | `src/views/ViewerPage.jsx` | 1 |
| toast('전체 적용은 실패했어요 — 이 자료에는 반영됐어요.', 'warning'); | toast('전체에는 적용하지 못했어요. 이 자료에는 반영됐어요.', 'warning'); | `src/views/ViewerPage.jsx` | 1 |
| else toast('저장 실패 — ' + friendlyToastMessage(error), 'error'); | else toast(failureMessage('단어를 저장하지 못했어요.', error), 'error'); | `src/views/ViewerPage.jsx` | 1 |
|       toast('저장 실패', 'error'); |       toast('단어를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.', 'error'); | `src/views/ViewerPage.jsx` | 1 |
| toast('취소 실패 — ' + friendlyToastMessage(err), 'error'); | toast(failureMessage('저장을 되돌리지 못했어요.', err), 'error'); | `src/views/ViewerPage.jsx` | 1 |
| toast('되돌리기 실패 — ' + friendlyToastMessage(err), 'error'); | toast(failureMessage('되돌리지 못했어요.', err), 'error'); | `src/views/ViewerPage.jsx` | 1 |
| toast('단어 추가 실패 — ' + friendlyToastMessage(err), 'error'); | toast(failureMessage('단어를 추가하지 못했어요.', err), 'error'); | `src/views/ViewerPage.jsx` | 1 |
| '자료를 찾을 수 없어요' : '자료를 불러올 수 없어요' | '자료를 찾을 수 없어요' : '자료를 불러오지 못했어요' | `src/views/ViewerPage.jsx` | 1 |
| {savedWordsError && <p role="alert">{vt("잠시 후 다시 시도해주세요.")} | {savedWordsError && <p role="alert">{vt("저장한 단어를 불러오지 못했어요.")} | `src/views/ViewerPage.jsx` | 1 |
| vt("분석에 실패했습니다.") | vt("분석하지 못했어요.") | `src/views/ViewerPage.jsx` | 1 |
| vt("분석 실패 — 재시도 버튼을 눌러주세요") | vt("분석하지 못했어요. 재분석 버튼을 눌러 주세요") | `src/views/ViewerPage.jsx` | 1 |
| ['분석에 실패했습니다.',' | ['분석하지 못했어요.',' | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| ['분석 실패 — 재시도 버튼을 눌러주세요',' | ['분석하지 못했어요. 재분석 버튼을 눌러 주세요',' | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| ['자료를 불러올 수 없어요',' | ['자료를 불러오지 못했어요',' | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| ['잠시 후 다시 시도해주세요.','请稍后重试。','請稍後重試。'] | ['저장한 단어를 불러오지 못했어요.','无法加载已保存的单词。','無法載入已儲存的單字。'] | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| ['저장 실패','保存失败','儲存失敗'] | ['단어를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.','无法保存单词，请稍后重试。','無法儲存單字，請稍後重試。'] | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| toast?.('쉬운 문장 생성에 실패했어요.', 'error'); | toast?.('쉬운 문장을 만들지 못했어요.', 'error'); | `src/lib/useEasierText.js` | 1 |
| toast?.('쉬운 문장 생성에 실패했어요 — ' + friendlyToastMessage(err), 'error'); | toast?.(failureMessage('쉬운 문장을 만들지 못했어요.', err), 'error'); | `src/lib/useEasierText.js` | 1 |
| toast?.('문법 해설에 실패했어요.', 'error'); | toast?.('문법 해설을 받지 못했어요.', 'error'); | `src/lib/useGrammarDetail.js` | 1 |
| toast?.('문법 해설에 실패했어요 — ' + friendlyToastMessage(err), 'error'); | toast?.(failureMessage('문법 해설을 받지 못했어요.', err), 'error'); | `src/lib/useGrammarDetail.js` | 1 |
| toast?.('질문 처리에 실패했어요.', 'error'); | toast?.('질문에 답하지 못했어요.', 'error'); | `src/lib/useGrammarDetail.js` | 2 |
| toast?.('저장 실패 — ' + friendlyToastMessage(err), 'error'), | toast?.(failureMessage('저장하지 못했어요.', err), 'error'), | `src/lib/useGrammarNoteSave.js` | 1 |
| toast?.('복습 저장 실패 — ' + friendlyToastMessage(err), 'error'); | toast?.(failureMessage('복습을 저장하지 못했어요.', err), 'error'); | `src/lib/useInlineReview.js` | 1 |
| toast?.('댓글 저장 실패: ' + friendlyToastMessage(err), 'error'), | toast?.(failureMessage('댓글을 저장하지 못했어요.', err), 'error'), | `src/lib/useMaterialComments.js` | 1 |
| toast?.('삭제 실패: ' + friendlyToastMessage(err), 'error'), | toast?.(failureMessage('댓글을 삭제하지 못했어요.', err), 'error'), | `src/lib/useMaterialComments.js` | 1 |
| throw new Error('PDF 접근 실패'); | throw new Error('PDF를 열지 못했어요.'); | `src/lib/usePdfRangeMutation.js` | 1 |
| toast?.('범위 가져오기 실패 — ' + friendlyToastMessage(err), 'error'), | toast?.(failureMessage('범위를 가져오지 못했어요.', err), 'error'), | `src/lib/usePdfRangeMutation.js` | 1 |
| toast?.('분석에 실패했어요. 원문은 그대로 남아 있어요.', 'error'); | toast?.('분석하지 못했어요. 원문은 그대로 남아 있어요.', 'error'); | `src/lib/useReanalyze.js` | 1 |
| toast?.('분석 실패: ' + friendlyToastMessage(err), 'error'); | toast?.(failureMessage('분석하지 못했어요.', err), 'error'); | `src/lib/useReanalyze.js` | 1 |
| toast?.('제목 수정 실패 — ' + friendlyToastMessage(err), 'error'), | toast?.(failureMessage('제목을 바꾸지 못했어요.', err), 'error'), | `src/lib/useTitleEdit.js` | 1 |
| toast('업데이트 실패 — ' + friendlyToastMessage(err), 'error'); | toast(failureMessage('단어를 수정하지 못했어요.', err), 'error'); | `src/lib/useVocabData.js` | 1 |
| toast('삭제 실패 — ' + friendlyToastMessage(err), 'error'); | toast(failureMessage('단어를 삭제하지 못했어요.', err), 'error'); | `src/lib/useVocabData.js` | 1 |
| toast('가져오기 실패 — ' + friendlyToastMessage(err), 'error'); | toast(failureMessage('단어를 가져오지 못했어요.', err), 'error'); | `src/lib/useVocabData.js` | 1 |
| toast('수정 실패 — ' + friendlyToastMessage(err), 'error'); | toast(failureMessage('단어를 수정하지 못했어요.', err), 'error'); | `src/lib/useVocabData.js` | 1 |
| toast('일괄 삭제 실패: ' + friendlyToastMessage(err), 'error'); | toast(failureMessage('선택한 단어를 삭제하지 못했어요.', err), 'error'); | `src/lib/useVocabData.js` | 1 |
| toast('정리본을 못 읽었어요.', 'error'); | toast('정리본을 읽지 못했어요.', 'error'); | `src/views/ClassTeamPage.jsx` | 1 |

## 다시 시도 — 43건 · 45곳

| 전 | 후 | 파일 | n |
|---|---|---|---|
| known.refetch(); }}>다시 확인</button> | known.refetch(); }}>다시 시도</button> | `src/components/VocabularyExclusionList.jsx` | 1 |
| >최신 내용 다시 불러오기</button> | >최신 내용 불러오기</button> | `src/components/admin/TextbookEditor.jsx` (다른 동작) | 1 |
| onClick={()=>load()}>다시 불러오기</button> | onClick={()=>load()}>다시 시도</button> | `src/components/books/BookEditor.jsx` | 1 |
| onClick={() => location.reload()}>다시 열기</button> | onClick={() => location.reload()}>다시 시도</button> | `src/components/books/BookReader.jsx` | 1 |
| onClick={() => location.reload()}>다시 확인</button> | onClick={() => location.reload()}>다시 시도</button> | `src/components/books/Bookshelf.jsx` | 1 |
| onClick={()=>query.refetch()}>다시 확인</button> | onClick={()=>query.refetch()}>다시 시도</button> | `src/components/classroom/ClassCopyNotice.jsx` | 1 |
| onClick={() => q.refetch()}>다시 불러오기</button> | onClick={() => q.refetch()}>다시 시도</button> | `src/components/classroom/ClassCourseSchedule.jsx` | 1 |
| onClick={()=>query.refetch()}>다시 불러오기</button> | onClick={()=>query.refetch()}>다시 시도</button> | `src/components/classroom/ClassRemoteHistory.jsx` | 1 |
| onClick={()=>query.refetch()}>다시 확인</button> | onClick={()=>query.refetch()}>다시 시도</button> | `src/components/classroom/ClassTeamSettings.jsx` | 1 |
| >최신 설정으로 다시 열기</button> | >최신 설정 불러오기</button> | `src/components/classroom/ClassTeamSettings.jsx` (다른 동작) | 1 |
| text.refetch();}}>다시 확인</button> | text.refetch();}}>다시 시도</button> | `src/components/classroom/ClassTextbookNotes.jsx` | 1 |
| onClick={()=>session.refetch()}>다시 불러오기</button> | onClick={()=>session.refetch()}>다시 시도</button> | `src/components/classroom/ClassroomReader.jsx` | 2 |
| onClick={()=>coverage.refetch()}>수업 범위 다시 확인</button> | onClick={()=>coverage.refetch()}>다시 시도</button> | `src/components/classroom/ClassroomReader.jsx` | 2 |
| onClick={retry}>다시 불러오기</button> | onClick={retry}>다시 시도</button> | `src/components/classroom/ClassroomUI.jsx` | 1 |
| onClick={()=>query.refetch()}>다시 확인</button> | onClick={()=>query.refetch()}>다시 시도</button> | `src/components/classroom/TextbookAnnotations.jsx` | 1 |
| onClick={()=>bookmark.refetch()}>다시 확인</button> | onClick={()=>bookmark.refetch()}>다시 시도</button> | `src/components/library/LibrarySaveButton.jsx` | 1 |
| draft.frozen?'다시 확인': | draft.frozen?'다시 시도': | `src/components/library/LibraryChapterEditor.jsx` | 1 |
| onClick={()=>query.refetch()}>다시 불러오기</button> | onClick={()=>query.refetch()}>다시 시도</button> | `src/components/library/LibraryShelf.jsx` | 1 |
| >저장 결과 확인 필요 <button onClick={()=>resume(pending.id,pending.undo)}>다시 확인</button> | >정리 결과를 아직 확인하지 못했어요. <button onClick={()=>resume(pending.id,pending.undo)}>다시 시도</button> | `src/components/library/LibraryShelf.jsx` | 1 |
| onClick={() => query.refetch()}>다시 불러오기</button> | onClick={() => query.refetch()}>다시 시도</button> | `src/components/materials/MaterialEditor.jsx` | 1 |
| onClick={() => setRetry(value => value + 1)}>다시 불러오기</button> | onClick={() => setRetry(value => value + 1)}>다시 시도</button> | `src/components/materials/OriginalFileReader.jsx` | 1 |
| onClick={() => query.refetch()}>다시 확인</button> | onClick={() => query.refetch()}>다시 시도</button> | `src/components/materials/PassageSources.jsx` | 1 |
| onClick={() => query.refetch()}>다시 불러오기</button> | onClick={() => query.refetch()}>다시 시도</button> | `src/components/materials/SuggestionReader.jsx` | 1 |
| onClick={()=>saved.refetch()}>다시 확인</button> | onClick={()=>saved.refetch()}>다시 시도</button> | `src/components/notes/NoteVocabulary.jsx` | 1 |
| onClick={()=>window.location.reload()}>다시 열기</button> | onClick={()=>window.location.reload()}>다시 시도</button> | `src/components/notes/StudyNotePage.jsx` | 1 |
| onClick={() => refetchDueVocab()}>다시 불러오기</button> | onClick={() => refetchDueVocab()}>다시 시도</button> | `src/views/MaterialsPage.jsx` | 1 |
| onClick={() => refetchProgress()}>다시 불러오기</button> | onClick={() => refetchProgress()}>다시 시도</button> | `src/views/MaterialsPage.jsx` | 1 |
| onClick={() => refetchPdfs()}>다시 불러오기</button> | onClick={() => refetchPdfs()}>다시 시도</button> | `src/views/MaterialsPage.jsx` | 1 |
| <p>다시 확인한 뒤 복습을 시작해 주세요.</p><button type="button" className="btn btn--primary" onClick={() => bookScope.refetch()}>범위 다시 불러오기</button> | <p>범위를 다시 불러온 뒤 복습을 시작해 주세요.</p><button type="button" className="btn btn--primary" onClick={() => bookScope.refetch()}>다시 시도</button> | `src/views/VocabPage.jsx` | 1 |
| <p>연결을 확인한 뒤 다시 불러와 주세요. 복습 기록은 그대로 남아 있어요.</p><button type="button" className="btn btn--primary" onClick={() => refetchVocab()}>다시 불러오기</button> | <p>연결을 확인한 뒤 다시 시도해 주세요. 복습 기록은 그대로 남아 있어요.</p><button type="button" className="btn btn--primary" onClick={() => refetchVocab()}>다시 시도</button> | `src/views/VocabPage.jsx` | 1 |
| 최신 표현을 확인하지 못했어요. <button type="button" onClick={() => refetchVocab()}>다시 불러오기</button> | 최신 표현을 확인하지 못했어요. <button type="button" onClick={() => refetchVocab()}>다시 시도</button> | `src/views/VocabPage.jsx` | 1 |
| 마지막으로 받은 내용을 보여 드립니다. <button onClick={()=>note.refetch()}>다시 연결</button> | 마지막으로 받은 내용을 보여 드려요. <button onClick={()=>note.refetch()}>다시 시도</button> | `src/views/ClassBoardPage.jsx` | 1 |
| onClick={()=>retryTeams()}>다시 불러오기</button> | onClick={()=>retryTeams()}>다시 시도</button> | `src/views/ClassHubPage.jsx` | 1 |
| onClick={()=>retryNotes()}>다시 불러오기</button> | onClick={()=>retryNotes()}>다시 시도</button> | `src/views/ClassTeamPage.jsx` | 1 |
| onClick={()=>retryChapters()}>다시 확인</button> | onClick={()=>retryChapters()}>다시 시도</button> | `src/views/ClassTeamPage.jsx` | 1 |
| onClick={()=>refetchClaimed()}>다시 확인</button> | onClick={()=>refetchClaimed()}>다시 시도</button> | `src/views/ClassTeamPage.jsx` | 1 |
| <button type="button" onClick={() => refetch()}>다시 불러오기</button> | <button type="button" onClick={() => refetch()}>다시 시도</button> | `src/views/HomePage.jsx` | 1 |
| onClick={() => recommendations.refetch()}>다시 확인</button> | onClick={() => recommendations.refetch()}>다시 시도</button> | `src/views/HomePage.jsx` | 1 |
| vt('설명을 다시 불러오기') | vt('다시 시도') | `src/views/ViewerPage.jsx` | 1 |
| vt("상태 다시 확인") | vt("다시 시도") | `src/views/ViewerPage.jsx` | 1 |
| ['설명을 다시 불러오기','重新加载讲解','重新載入解說'], |  | `src/lib/viewerMessages.js` (번역표 행 삭제 — 「다시 시도」 행 재사용) | 1 |
| ['상태 다시 확인','重新检查状态','重新確認狀態'], |  | `src/lib/viewerMessages.js` (번역표 행 삭제 — 「다시 시도」 행 재사용) | 1 |
| <p>연결을 확인하고 다시 열어 주세요. 복습 기록은 그대로 남아 있어요.</p><a href="/review/grammar">다시 불러오기 →</a> | <p>연결을 확인하고 다시 시도해 주세요. 복습 기록은 그대로 남아 있어요.</p><a href="/review/grammar">다시 시도 →</a> | `src/app/(app)/review/grammar/page.jsx` | 1 |

## 해 주세요 — 37건 · 37곳

| 전 | 후 | 파일 | n |
|---|---|---|---|
| 다시 방문해주세요. | 다시 방문해 주세요. | `src/app/global-error.jsx` | 1 |
| 아래 링크도 확인해주세요. | 아래 링크도 확인해 주세요. | `src/app/help/page.jsx` | 1 |
| 병행 확인해주세요. | 병행 확인해 주세요. | `src/app/terms/page.jsx` | 1 |
| '세션이 만료됐어요. 다시 로그인해주세요.' | '세션이 만료됐어요. 다시 로그인해 주세요.' | `src/app/api/analyze/route.js` | 1 |
| '요청이 너무 많아요. 잠시 후 다시 시도해주세요.' | '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' | `src/app/api/analyze/route.js` | 1 |
| '요청이 너무 많아요. 잠시 후 다시 시도해주세요.' | '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' | `src/app/api/dict-correct/route.js` | 1 |
| '세션이 만료됐어요. 다시 로그인해주세요.' | '세션이 만료됐어요. 다시 로그인해 주세요.' | `src/app/api/explain/route.js` | 1 |
| '요청이 너무 잦아요. 잠시 후 다시 시도해주세요.' | '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' | `src/app/api/explain/route.js` | 1 |
| '세션이 만료됐어요. 다시 로그인해주세요.' | '세션이 만료됐어요. 다시 로그인해 주세요.' | `src/app/api/gemini/route.js` | 1 |
| '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' | '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' | `src/app/api/gemini/route.js` | 1 |
| '세션이 만료됐어요. 다시 로그인해주세요.' | '세션이 만료됐어요. 다시 로그인해 주세요.' | `src/app/api/study-paragraph/route.js` | 1 |
| '요청이 너무 잦아요. 잠시 후 다시 시도해주세요.' | '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' | `src/app/api/study-paragraph/route.js` | 1 |
| '세션이 만료됐어요. 다시 로그인해주세요.' | '세션이 만료됐어요. 다시 로그인해 주세요.' | `src/app/api/writing-feedback/route.js` | 1 |
| '첨삭 요청이 너무 잦아요. 잠시 후 다시 시도해주세요.' | '첨삭 요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' | `src/app/api/writing-feedback/route.js` | 1 |
| Vercel 환경 변수를 확인해주세요.' | Vercel 환경 변수를 확인해 주세요.' | `src/app/api/writing-feedback/route.js` | 1 |
| '작문을 입력해주세요.' | '작문을 입력해 주세요.' | `src/app/api/writing-feedback/route.js` | 1 |
| '인증 메일을 다시 보냈어요. 받은편지함을 확인해주세요.' | '인증 메일을 다시 보냈어요. 받은편지함을 확인해 주세요.' | `src/components/Layout.jsx` | 1 |
| 받은편지함을 확인해주세요.{' '} | 받은편지함을 확인해 주세요.{' '} | `src/components/Layout.jsx` | 1 |
| setError('닉네임을 입력해주세요.'); | setError('닉네임을 입력해 주세요.'); | `src/components/OnboardingModal.jsx` | 1 |
| 이 자료가 부적절하다고 생각하시면 이유를 선택해주세요. | 이 자료가 부적절하다고 생각하면 이유를 골라 주세요. | `src/components/ReportMaterialButton.jsx` | 1 |
| '사용할 새 비밀번호를 입력해주세요' | '사용할 새 비밀번호를 입력해 주세요' | `src/views/AuthPage.jsx` | 1 |
| toast('본인 학습 목적 사용에 동의해주세요.', 'warning'); | toast('본인 학습 목적 사용에 동의해 주세요.', 'warning'); | `src/views/MaterialAddPdfSection.jsx` | 1 |
| toast('먼저 아래 저작권 동의를 체크해주세요.', 'warning'); | toast('먼저 아래 저작권 동의를 체크해 주세요.', 'warning'); | `src/views/MaterialAddPdfSection.jsx` | 1 |
| toast('받아두지 못했어요. 연결을 확인해주세요.', 'error'); | toast('받아 두지 못했어요. 연결을 확인해 주세요.', 'error'); | `src/views/MaterialsPage.jsx` | 1 |
| throw new Error('단어를 입력해주세요') | throw new Error('단어를 입력해 주세요') | `src/views/VocabPage.jsx` | 1 |
| toast('복습 계산을 불러오지 못했어요. 다시 시도해주세요.', 'error'); | toast('복습 계산을 불러오지 못했어요. 다시 시도해 주세요.', 'error'); | `src/views/VocabPage.jsx` | 1 |
| toast('내용을 입력해주세요.', 'warning'); | toast('내용을 입력해 주세요.', 'warning'); | `src/views/MaterialAddPage.jsx` | 1 |
| throw new Error('닉네임을 입력해주세요.'); | throw new Error('닉네임을 입력해 주세요.'); | `src/views/MyPage.jsx` | 1 |
| 다른 모드를 선택해주세요. | 다른 모드를 골라 주세요. | `src/views/VocabReview.jsx` | 1 |
| friendlyToastMessage(error, '잠시 후 다시 시도해주세요.') | friendlyToastMessage(error, '잠시 후 다시 시도해 주세요.') | `src/views/ViewerPage.jsx` | 1 |
| toast('세션이 만료됐어요. 다시 로그인해주세요.', 'warning', 5000); | toast('세션이 만료됐어요. 다시 로그인해 주세요.', 'warning', 5000); | `src/lib/AuthContext.jsx` | 1 |
| toast?.('문단을 선택해주세요.', 'warning'); | toast?.('문단을 골라 주세요.', 'warning'); | `src/lib/useReanalyzeUI.js` | 1 |
| '세션이 만료됐어요. 다시 로그인해주세요.' | '세션이 만료됐어요. 다시 로그인해 주세요.' | `src/lib/server/auth.js` | 1 |
| 가입 이메일로 문의주세요. | 가입 이메일로 문의해 주세요. | `src/app/help/page.jsx` | 1 |
| 몇 가지만 알려주세요. | 몇 가지만 알려 주세요. | `src/components/OnboardingModal.jsx` | 1 |
| 페이지 범위를 줄여주세요. | 페이지 범위를 줄여 주세요. | `src/views/MaterialAddPdfSection.jsx` | 1 |
| 조금만 더 기다려주세요… | 조금만 더 기다려 주세요… | `src/views/StudySessionPage.jsx` | 1 |

## 해요체 — 204건 · 221곳

| 전 | 후 | 파일 | n |
|---|---|---|---|
| title: '자료를 찾을 수 없습니다', desc: '삭제되었거나 잘못된 링크일 수 있어요.' | title: '자료를 찾을 수 없어요', desc: '삭제됐거나 잘못된 링크일 수 있어요.' | `src/app/(app)/viewer/error.jsx` | 1 |
| title: 'AI가 아직 분석 중입니다', desc: '잠시 후 다시 시도해주세요. 분석에는 수십 초가 걸릴 수 있어요.' | title: 'AI가 아직 분석하고 있어요', desc: '분석에는 수십 초가 걸릴 수 있어요. 잠시 후 다시 시도해 주세요.' | `src/app/(app)/viewer/error.jsx` | 1 |
| '기억 곡선 기반 간격 반복 알고리즘입니다. | '기억 곡선 기반 간격 반복 알고리즘이에요. | `src/app/help/page.jsx` | 1 |
| 그 수정본은 본인 단어장에만 반영됩니다.' | 그 수정본은 본인 단어장에만 반영돼요.' | `src/app/help/page.jsx` | 1 |
| 순수 텍스트 PDF는 즉시 처리됩니다. 너무 긴 PDF(100쪽 이상)는 나눠서 올려주세요.' | 순수 텍스트 PDF는 바로 처리돼요. 너무 긴 PDF(100쪽 이상)는 나눠서 올려 주세요.' | `src/app/help/page.jsx` | 1 |
| 새 자료 분석·단어 저장은 인터넷이 필요합니다.' | 새 자료 분석·단어 저장은 인터넷이 필요해요.' | `src/app/help/page.jsx` | 1 |
| 단어를 탭하면 뜻이 뜨고 단어장에 저장됩니다.' | 단어를 탭하면 뜻이 뜨고 단어장에 저장돼요.' | `src/app/help/page.jsx` | 1 |
| 더 궁금하신 점이 있으신가요? 아래 | 더 궁금한 점이 있나요? 아래 | `src/app/help/page.jsx` | 1 |
| '잘못된 요청입니다.' | '잘못된 요청이에요.' | `src/app/api/explain/route.js` | 3 |
| '지원하지 않는 언어입니다.' | '지원하지 않는 언어예요.' | `src/app/api/writing-feedback/route.js` | 2 |
| '접근할 수 없는 단어입니다.' | '접근할 수 없는 단어예요.' | `src/app/api/learning/exclusions/route.js` | 1 |
| 기존 카드를 합치지 않았습니다.' | 기존 카드는 합치지 않았어요.' | `src/app/api/learning/vocabulary/route.js` | 1 |
| '접근할 수 없는 문맥입니다.' | '접근할 수 없는 문맥이에요.' | `src/app/api/learning/vocabulary/route.js` | 1 |
| '잘못된 JSON입니다.' | '잘못된 JSON이에요.' | `src/app/api/world/position/route.js` | 1 |
| 'scene, x, y가 올바르지 않습니다.' | 'scene, x, y가 올바르지 않아요.' | `src/app/api/world/position/route.js` | 1 |
| '잘못된 JSON입니다.' | '잘못된 JSON이에요.' | `src/app/api/world/session/route.js` | 1 |
| 'token이 필요합니다.' | 'token이 필요해요.' | `src/app/api/world/session/route.js` | 1 |
| '잘못된 JSON입니다.' | '잘못된 JSON이에요.' | `src/app/api/world/stamps/route.js` | 1 |
| 'nodeId가 올바르지 않습니다.' | 'nodeId가 올바르지 않아요.' | `src/app/api/world/stamps/route.js` | 1 |
| '이미 모든 스타터 콘텐츠가 존재합니다.' | '스타터 콘텐츠가 이미 모두 있어요.' | `src/app/api/admin/seed-starters/route.js` (관리자) | 1 |
| 'lang, slug가 필요합니다.' | 'lang, slug가 필요해요.' | `src/app/api/admin/chapter/route.js` (관리자) | 2 |
| '챕터를 찾을 수 없습니다.' | '챕터를 찾을 수 없어요.' | `src/app/api/admin/chapter/route.js` (관리자) | 2 |
| '잘못된 JSON입니다.' | '잘못된 JSON이에요.' | `src/app/api/admin/chapter/route.js` (관리자) | 2 |
| 'lang, slug, data가 필요합니다.' | 'lang, slug, data가 필요해요.' | `src/app/api/admin/chapter/route.js` (관리자) | 1 |
| '수정 버전이 올바르지 않습니다. 다시 불러와 주세요.' | '수정 버전이 올바르지 않아요. 다시 불러와 주세요.' | `src/app/api/admin/chapter/route.js` (관리자) | 1 |
| '챕터 구조가 올바르지 않습니다. sections는 비어있지 않은 배열이어야 하고, 제목·본문 등 텍스트 필드는 문자열이어야 합니다.' | '챕터 구조가 올바르지 않아요. sections는 비어 있지 않은 배열이어야 하고, 제목·본문 등 텍스트 필드는 문자열이어야 해요.' | `src/app/api/admin/chapter/route.js` (관리자) | 1 |
| `story 문항 id는 삭제·변경할 수 없습니다 (기록 연동) | `story 문항 id는 삭제·변경할 수 없어요 (기록 연동) | `src/app/api/admin/chapter/route.js` (관리자) | 1 |
| '다른 편집에서 내용이 변경됐어요. 입력은 유지됩니다. 최신 내용을 확인한 뒤 다시 편집해 주세요.' | '다른 편집에서 내용이 바뀌었어요. 입력은 그대로 있어요. 최신 내용을 확인한 뒤 다시 편집해 주세요.' | `src/app/api/admin/chapter/route.js` (관리자) | 1 |
| 이 작업은 <strong>되돌릴 수 없습니다</strong>. | 이 작업은 <strong>되돌릴 수 없어요</strong>. | `src/components/AccountSettings.jsx` | 1 |
| 공용(public)으로 공유한 자료는 익명 사용자로 남을 수 있습니다. | 공용(public)으로 공유한 자료는 익명 사용자로 남을 수 있어요. | `src/components/AccountSettings.jsx` | 1 |
| '신고가 접수됐어요. 검토 후 조치하겠습니다.' | '신고가 접수됐어요. 검토한 뒤 조치할게요.' | `src/components/ReportMaterialButton.jsx` | 1 |
| title="이 자료를 신고합니다" | title="이 자료 신고하기" | `src/components/ReportMaterialButton.jsx` | 1 |
| 짧고 자연스러운 질문으로 시작합니다. | 짧고 자연스러운 질문으로 시작해요. | `src/components/ConversationPanel.jsx` | 1 |
| 🔒 개인 소장 자료 — 비공개로 등록됩니다 | 🔒 개인 소장 자료 — 비공개로 등록돼요 | `src/components/BookDraftPanel.jsx` | 1 |
| 지금은 최신 내용을 보고 있습니다.' | 지금은 최신 내용을 보고 있어요.' | `src/components/ChapterSourceNotice.jsx` | 1 |
| 원어만 담고 뜻은 드래그 번역에 붙입니다</strong> | 원어만 담고 뜻은 드래그 번역에 붙여요</strong> | `src/components/MaterialAddSentenceSection.jsx` | 1 |
| 마지막 챕터까지 마쳤습니다. | 마지막 챕터까지 마쳤어요. | `src/components/RefPatternCheck.jsx` | 1 |
| 더 자연스러운 음성이 필요하면 Chrome 또는 Edge로 접속하면 Google·Microsoft 클라우드 음성이 추가됩니다. | 더 자연스러운 음성이 필요하면 Chrome 또는 Edge로 접속해 주세요. Google·Microsoft 클라우드 음성이 추가돼요. | `src/components/TtsVoicePicker.jsx` | 1 |
| '저장했어요. 교재 페이지에 수정 내용이 반영됩니다.' | '저장했어요. 교재 페이지에 수정 내용이 반영돼요.' | `src/components/admin/TextbookEditor.jsx` (관리자) | 1 |
| 편집할 교재가 없습니다. | 편집할 교재가 없어요. | `src/components/admin/TextbookEditor.jsx` (관리자) | 1 |
| 저장하면 교재에 바로 반영됩니다. | 저장하면 교재에 바로 반영돼요. | `src/components/admin/TextbookEditor.jsx` (관리자) | 1 |
| 초안 저장을 누르기 전까지 저장된 초안은 그대로입니다.' | 초안 저장을 누르기 전까지 저장된 초안은 그대로예요.' | `src/components/books/BookEditor.jsx` | 1 |
| <p>편집 저장소를 불러오는 중입니다. 연결 설정이 끝나야 | <p>편집 저장소를 불러오고 있어요. 연결 설정이 끝나야 | `src/components/books/BookEditor.jsx` | 1 |
| 미리보기는 마지막으로 검수한 출력본입니다. | 미리보기는 마지막으로 검수한 출력본이에요. | `src/components/books/BookEditor.jsx` | 1 |
| 기존 초안을 이 후보로 바로 저장할 수 없어요. 초안은 유지되며, | 기존 초안을 이 후보로 바로 저장할 수 없어요. 초안은 그대로 있고, | `src/components/books/BookEditor.jsx` | 1 |
| 발행하면 모든 독자가 이 판본을 보게 됩니다. | 발행하면 모든 독자가 이 판본을 보게 돼요. | `src/components/books/BookEditor.jsx` | 1 |
| 관리자 미리보기 · 발행 전 원고입니다. | 관리자 미리보기 · 발행 전 원고예요. | `src/components/books/BookReader.jsx` | 1 |
| 별도로 보관한 사본입니다. 이 자료는 자동으로 변경하지 않습니다. | 별도로 보관한 사본이에요. 이 자료는 자동으로 바꾸지 않아요. | `src/components/classroom/ClassCopyNotice.jsx` | 1 |
| '내 학습 기록은 유지됩니다.' | '내 학습 기록은 그대로 있어요.' | `src/components/classroom/ClassCopyNotice.jsx` | 1 |
| 앞의 20개를 표시합니다. | 앞의 20개만 보여 드려요. | `src/components/classroom/ClassCopyNotice.jsx` | 1 |
| 저장하면 학생들이 새 암호로 다시 입장해야 합니다. 비워 두면 기존 암호를 유지합니다. | 저장하면 학생들이 새 암호로 다시 입장해야 해요. 비워 두면 기존 암호를 그대로 써요. | `src/components/classroom/ClassTeamSettings.jsx` | 1 |
| '다른 수정과 겹쳤어요. 입력은 보관돼 있습니다.' | '다른 수정과 겹쳤어요. 입력은 보관돼 있어요.' | `src/components/classroom/ClassTextbookNotes.jsx` | 1 |
| 기록 버튼을 눌러야 수업에 추가됩니다.' | 기록 버튼을 눌러야 수업에 추가돼요.' | `src/components/classroom/ClassroomReader.jsx` | 1 |
| 학생에게 남길 표현을 추가하면 이곳에 모입니다. | 학생에게 남길 표현을 추가하면 이곳에 모여요. | `src/components/classroom/ClassroomReader.jsx` | 1 |
| 오늘 표현에 추가하면 학생에게 전달됩니다. | 오늘 표현에 추가하면 학생에게 전달돼요. | `src/components/classroom/ClassroomReader.jsx` | 1 |
| 이 자리에서 뜻을 보고 수업에 추가합니다. | 이 자리에서 뜻을 보고 수업에 추가해요. | `src/components/classroom/ClassroomReader.jsx` | 1 |
| '다른 수정과 겹쳤어요. 입력은 보관돼 있습니다.' | '다른 수정과 겹쳤어요. 입력은 보관돼 있어요.' | `src/components/classroom/TextbookAnnotations.jsx` | 1 |
| setError('저장된 작업이 없습니다. 다시 선택해 주세요.') | setError('저장된 작업이 없어요. 다시 선택해 주세요.') | `src/components/library/LibraryShelf.jsx` | 1 |
| 폴더가 없습니다. <button | 폴더가 없어요. <button | `src/components/library/LibraryShelf.jsx` | 1 |
| 원본을 불러오지 못했어요. 글과 저장 기록은 그대로 남아 있습니다. | 원본을 불러오지 못했어요. 글과 저장 기록은 그대로 남아 있어요. | `src/components/materials/OriginalFileReader.jsx` | 1 |
| 위의 ‘원본 파일 열기’로 내려받아 읽을 수 있습니다. | 위의 ‘원본 파일 열기’로 내려받아 읽을 수 있어요. | `src/components/materials/OriginalFileReader.jsx` | 1 |
| '읽던 쪽과 장은 계정의 위치 기록과 연결됩니다.' | '읽던 쪽과 장은 계정의 위치 기록과 연결돼요.' | `src/components/materials/OriginalFileReader.jsx` | 1 |
| 본문은 읽기 편한 텍스트로 표시됩니다. | 본문은 읽기 편한 텍스트로 보여 드려요. | `src/components/materials/OriginalFileReader.jsx` | 1 |
| 원본을 그대로 표시합니다. | 원본을 그대로 보여 드려요. | `src/components/materials/OriginalFileReader.jsx` | 1 |
| 출처의 쪽·장까지 연결됩니다. | 출처의 쪽·장까지 연결돼요. | `src/components/materials/PassageSources.jsx` | 1 |
| 보관한 인용을 아래에 표시합니다. | 보관한 인용을 아래에 보여 드려요. | `src/components/materials/PassageSources.jsx` | 1 |
| NHK가 제공한 뉴스 제목과 소개를 묶은 브리핑입니다. | NHK가 제공한 뉴스 제목과 소개를 묶은 브리핑이에요. | `src/components/materials/SuggestionReader.jsx` | 1 |
| 원본 출처를 함께 보존합니다. | 원본 출처를 함께 보존해요. | `src/components/materials/SuggestionReader.jsx` | 1 |
| 한 줄씩 연결됩니다. | 한 줄씩 연결돼요. | `src/components/notes/NoteVocabulary.jsx` | 1 |
| 저장할 때 중복을 다시 확인합니다. | 저장할 때 중복을 다시 확인해요. | `src/components/notes/NoteVocabulary.jsx` | 1 |
| 기존 단어의 뜻과 복습 일정은 유지됩니다. | 기존 단어의 뜻과 복습 일정은 그대로예요. | `src/components/notes/NoteVocabulary.jsx` | 1 |
| 열어 둔 교재를 이 노트의 출처로 연결합니다. | 열어 둔 교재를 이 노트의 출처로 연결해요. | `src/components/notes/StudyNotePage.jsx` | 1 |
| 내 계정에만 보관됩니다. | 내 계정에만 보관돼요. | `src/components/notes/StudyNotePage.jsx` | 1 |
| 이미 정리한 필기입니다. | 이미 정리한 필기예요. | `src/components/notes/StudyNotePage.jsx` | 1 |
| 정리 목록의 원문은 그대로 보관됩니다. | 정리 목록의 원문은 그대로 보관돼요. | `src/components/notes/StudyNotePage.jsx` | 1 |
| '이 표현을 적었던 노트입니다. 원문이 바뀌었다면 저장 당시 문장을 함께 확인하세요.' | '이 표현을 적었던 노트예요. 원문이 바뀌었다면 저장 당시 문장을 함께 확인해 주세요.' | `src/components/notes/StudyNotePage.jsx` | 1 |
| 글자 도구는 텍스트 입력입니다. | 글자 도구는 텍스트 입력이에요. | `src/components/notes/StudyNotePage.jsx` | 1 |
| <p>하위 폴더도 삭제됩니다. 자료는 남습니다.</p> | <p>하위 폴더도 삭제돼요. 자료는 남아 있어요.</p> | `src/components/library/LibraryCollections.jsx` | 1 |
| 출처 정보는 그대로 유지됩니다. | 출처 정보는 그대로 남아요. | `src/components/admin/InlineEditForm.jsx` (관리자) | 1 |
| 모델마다 한 번씩 보냅니다. 학습 기록·사전에는 쓰지 않습니다. | 모델마다 한 번씩 보내요. 학습 기록·사전에는 쓰지 않아요. | `src/components/admin/LlmBenchPanel.jsx` (관리자) | 1 |
| 비용은 모델당 수 센트 이하입니다. | 비용은 모델당 수 센트 이하예요. | `src/components/admin/LlmBenchPanel.jsx` (관리자) | 1 |
| 이 브라우저에 저장됩니다. | 이 브라우저에 저장돼요. | `src/components/books/BookHome.jsx` | 1 |
| 검수 중인 판본입니다. 문화 글은 | 검수 중인 판본이에요. 문화 글은 | `src/components/books/BookMaterials.jsx` | 1 |
| 검수 중인 판본입니다. 지금은 | 검수 중인 판본이에요. 지금은 | `src/components/books/BookReview.jsx` | 1 |
| 로 인식합니다. 원래 필기는 그대로 남아요. | 로 인식해요. 원래 필기는 그대로 남아요. | `src/components/classroom/BoardInkRecognition.jsx` | 1 |
| '다른 부분에 필기를 계속해도 됩니다. 닫으면 결과 적용을 취소합니다.' | '다른 부분에 필기를 계속해도 돼요. 닫으면 결과를 적용하지 않아요.' | `src/components/classroom/BoardInkRecognition.jsx` | 1 |
| '수업 기록·개인 단어장에 자동 저장하지 않습니다.' | '수업 기록·개인 단어장에 자동으로 저장하지 않아요.' | `src/components/classroom/BoardInkRecognition.jsx` | 1 |
| '전체 판·교재는 전송하지 않습니다.' | '전체 판·교재는 보내지 않아요.' | `src/components/classroom/BoardInkRecognition.jsx` | 1 |
| 같은 표현이 여러 곳에 있습니다.' | 같은 표현이 여러 곳에 있어요.' | `src/components/classroom/ClassSourceFocus.jsx` | 1 |
| 교재는 먼저 읽어 볼 수 있습니다.' | 교재는 먼저 읽어 볼 수 있어요.' | `src/components/classroom/ClassStudyHistory.jsx` | 1 |
| <p>이전 형식의 노트입니다. 노트를 열어 확인하세요.</p> | <p>이전 형식의 노트예요. 노트를 열어 확인해 주세요.</p> | `src/components/classroom/ClassStudyHistory.jsx` | 1 |
| 다시 열 때 수업 접근 권한을 확인합니다. | 다시 열 때 수업 접근 권한을 확인해요. | `src/components/classroom/ClassroomJoin.jsx` | 1 |
| 자료의 공개 범위는 바뀌지 않습니다. | 자료의 공개 범위는 바뀌지 않아요. | `src/components/learning/MaterialChapterLinks.jsx` | 2 |
| 연결 목록은 나에게만 보입니다. | 연결 목록은 나에게만 보여요. | `src/components/learning/MaterialChapterLinks.jsx` | 1 |
| '출처와 함께 담았어요. 기존 복습 일정은 유지됩니다.' | '출처와 함께 담았어요. 기존 복습 일정은 그대로예요.' | `src/components/learning/SaveContextButton.jsx` | 1 |
| 작성한 글은 그대로 유지됩니다.' | 작성한 글은 그대로 있어요.' | `src/components/materials/MaterialComposer.jsx` | 1 |
| 자료를 다시 저장할 필요는 없습니다.' | 자료를 다시 저장할 필요는 없어요.' | `src/components/materials/MaterialComposer.jsx` | 1 |
| '최신 글을 불러오지 못했어요. 초안을 유지합니다.' | '최신 글을 불러오지 못했어요. 초안은 그대로 있어요.' | `src/components/materials/MaterialComposer.jsx` | 1 |
| 저장 결과가 확정될 때까지 내용을 유지합니다. | 저장 결과가 확정될 때까지 내용을 그대로 둬요. | `src/components/materials/MaterialComposer.jsx` | 1 |
| ’에 담습니다.</p> | ’에 담아요.</p> | `src/components/materials/MaterialComposer.jsx` | 1 |
| 첨부를 빼도 이전 원본은 보관됩니다. 새 본문으로 학습하면 별도의 학습 기록으로 이어집니다. | 첨부를 빼도 이전 원본은 보관돼요. 새 본문으로 학습하면 별도의 학습 기록으로 이어져요. | `src/components/materials/MaterialComposer.jsx` | 1 |
| 읽기·표현 저장 화면으로 이어집니다. 수정한 본문으로 공부해도 이전 표현의 출처는 남아 있습니다. | 읽기·표현 저장 화면으로 이어져요. 수정한 본문으로 공부해도 이전 표현의 출처는 남아 있어요. | `src/components/materials/OriginalMaterialReader.jsx` | 1 |
| 읽던 위치가 계정에 저장됩니다. | 읽던 위치가 계정에 저장돼요. | `src/components/materials/OriginalPositionNotice.jsx` | 1 |
| 공부할 문장을 직접 입력하면 이 위치와 함께 보관합니다. | 공부할 문장을 직접 입력하면 이 위치와 함께 보관해요. | `src/components/materials/PassageStudy.jsx` | 1 |
| 출처는 쪽·장까지 연결됩니다. | 출처는 쪽·장까지 연결돼요. | `src/components/materials/PassageStudy.jsx` | 1 |
| 학습할 내용만 다듬습니다. 선택했던 원문도 함께 보관됩니다. | 학습할 내용만 다듬어요. 선택했던 원문도 함께 보관돼요. | `src/components/materials/PassageStudy.jsx` | 1 |
| 선택한 내용을 임의로 잘라내지 않습니다. | 선택한 내용을 임의로 잘라내지 않아요. | `src/components/materials/PassageStudy.jsx` | 1 |
| 선택한 구간의 뜻과 표현을 준비합니다. | 선택한 구간의 뜻과 표현을 준비해요. | `src/components/materials/PassageStudy.jsx` | 1 |
| 읽은 표현을 정리 목록에 추가합니다. | 읽은 표현을 정리 목록에 추가해요. | `src/components/notes/NoteRecognition.jsx` | 1 |
| 닫으면 결과 적용을 취소합니다. | 닫으면 결과를 적용하지 않아요. | `src/components/notes/NoteRecognition.jsx` | 1 |
| 연결한 교재는 보내지 않습니다. | 연결한 교재는 보내지 않아요. | `src/components/notes/NoteRecognition.jsx` | 1 |
| setError('비밀번호는 8자 이상이어야 합니다.') | setError('비밀번호는 8자 이상이어야 해요.') | `src/views/AuthPage.jsx` | 2 |
| setError('비밀번호 확인이 일치하지 않습니다.') | setError('비밀번호 확인이 일치하지 않아요.') | `src/views/AuthPage.jsx` | 1 |
| setSuccess('비밀번호가 변경됐어요. 자동으로 로그인됩니다...') | setSuccess('비밀번호가 변경됐어요. 자동으로 로그인할게요…') | `src/views/AuthPage.jsx` | 1 |
| setSuccess('비밀번호 재설정 링크를 이메일로 보냈습니다. 확인해주세요.') | setSuccess('비밀번호 재설정 링크를 이메일로 보냈어요. 확인해 주세요.') | `src/views/AuthPage.jsx` | 1 |
| setSuccess('인증 이메일을 발송했습니다. 이메일을 확인해주세요.') | setSuccess('인증 이메일을 보냈어요. 이메일을 확인해 주세요.') | `src/views/AuthPage.jsx` | 1 |
| setSuccess('인증 메일을 다시 보냈습니다. 받은 편지함과 스팸함을 확인해주세요.') | setSuccess('인증 메일을 다시 보냈어요. 받은 편지함과 스팸함을 확인해 주세요.') | `src/views/AuthPage.jsx` | 1 |
| 이미 가입된 이메일입니다. 로그인하거나 Google로 계속하세요. | 이미 가입된 이메일이에요. 로그인하거나 Google로 계속해 주세요. | `src/views/AuthPage.jsx` | 1 |
| </a>에 동의합니다. | </a>에 동의해요. | `src/views/AuthPage.jsx` | 1 |
| throw new Error('자료가 변경됐습니다. 다시 확인해 주세요.') | throw new Error('자료가 바뀌었어요. 다시 확인해 주세요.') | `src/views/MaterialAddPdfSection.jsx` | 1 |
| OCR 모드로 추출합니다. 시간이 조금 더 걸려요. | OCR 모드로 추출할게요. 시간이 조금 더 걸려요. | `src/views/MaterialAddPdfSection.jsx` | 1 |
| 저작권 자료를 공개 공유하지 않겠습니다. | 저작권 자료를 공개 공유하지 않을게요. | `src/views/MaterialAddPdfSection.jsx` | 1 |
| 5~10페이지가 적절합니다. | 5~10페이지가 적절해요. | `src/views/MaterialAddPdfSection.jsx` | 1 |
| throw new Error('자료가 변경됐습니다. 다시 확인해 주세요.') | throw new Error('자료가 바뀌었어요. 다시 확인해 주세요.') | `src/views/MaterialsPage.jsx` | 1 |
| 단어 목록이<br />여기에 표시됩니다 | 단어 목록이<br />여기에 나타나요 | `src/views/PdfViewerPage.jsx` | 1 |
| PDF 파일 주소가 없습니다. | PDF 파일 주소가 없어요. | `src/views/PdfViewerPage.jsx` | 1 |
| >접근 권한이 없습니다</h2> | >접근 권한이 없어요</h2> | `src/views/AdminPage.jsx` (관리자) | 1 |
| '혼자 볼 때는 모범답과 비교해 스스로 판정하세요.' | '혼자 볼 때는 모범답과 비교해 스스로 판정해 주세요.' | `src/views/ClassCourseTestPage.jsx` | 1 |
| <p>수업에서 입력한 표현이 날짜별로 모입니다.</p> | <p>수업에서 입력한 표현이 날짜별로 모여요.</p> | `src/views/ClassTeamPage.jsx` | 1 |
| <b>사용할 사본을 선택하세요.</b><p>다른 사본은 삭제하지 않습니다.</p> | <b>사용할 사본을 골라 주세요.</b><p>다른 사본은 삭제하지 않아요.</p> | `src/views/ClassTeamPage.jsx` | 1 |
| throw new Error('문법 복습 결과를 저장하지 못했습니다.'); | throw new Error('문법 복습 결과를 저장하지 못했어요.'); | `src/views/GrammarReviewSession.jsx` | 1 |
| '복습할 표현이 있어요. 오늘 분량은 복습에서 확인하세요.' | '복습할 표현이 있어요. 오늘 분량은 복습에서 확인해 주세요.' | `src/views/HomePage.jsx` | 1 |
| q.why \|\| '정답입니다.' | q.why \|\| '정답이에요.' | `src/views/ReadingTextView.jsx` | 1 |
| q.why \|\| '정답입니다.' | q.why \|\| '정답이에요.' | `src/views/StoryCheck.jsx` | 1 |
| throw new Error('토큰을 찾을 수 없습니다.'); | throw new Error('토큰을 찾을 수 없어요.'); | `src/views/ViewerPage.jsx` | 1 |
| '이 자료는 삭제됐거나 비공개로 전환됐을 수 있어요. 연결됐던 단어는 단어장에 그대로 남아 있습니다.' | '이 자료는 삭제됐거나 비공개로 바뀌었을 수 있어요. 연결됐던 단어는 단어장에 그대로 남아 있어요.' | `src/views/ViewerPage.jsx` | 1 |
| vt("비공개 자료입니다") | vt("비공개 자료예요") | `src/views/ViewerPage.jsx` | 1 |
| vt("이 자료는 작성자만 열람할 수 있습니다.") | vt("이 자료는 작성자만 볼 수 있어요.") | `src/views/ViewerPage.jsx` | 1 |
| vt("로그인하면 단어장에 저장하고 복습할 수 있습니다 →") | vt("로그인하면 단어장에 저장하고 복습할 수 있어요 →") | `src/views/ViewerPage.jsx` | 1 |
| vt("처음부터 다시 분석합니다") | vt("처음부터 다시 분석해요") | `src/views/ViewerPage.jsx` | 1 |
| vt("문단을 선택해서 분석합니다") | vt("문단을 골라 분석해요") | `src/views/ViewerPage.jsx` | 1 |
| vt("텍스트를 고치면 바뀐 줄만 분석합니다") | vt("텍스트를 고치면 바뀐 줄만 분석해요") | `src/views/ViewerPage.jsx` | 1 |
| '새 분석을 준비 중입니다. 기존 자료는 유지됩니다.' | '새 분석을 준비하고 있어요. 기존 자료는 그대로 있어요.' | `src/views/ViewerPage.jsx` | 2 |
| ['비공개 자료입니다',' | ['비공개 자료예요',' | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| ['이 자료는 작성자만 열람할 수 있습니다.',' | ['이 자료는 작성자만 볼 수 있어요.',' | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| ['로그인하면 단어장에 저장하고 복습할 수 있습니다 →',' | ['로그인하면 단어장에 저장하고 복습할 수 있어요 →',' | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| ['처음부터 다시 분석합니다',' | ['처음부터 다시 분석해요',' | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| ['문단을 선택해서 분석합니다',' | ['문단을 골라 분석해요',' | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| ['텍스트를 고치면 바뀐 줄만 분석합니다',' | ['텍스트를 고치면 바뀐 줄만 분석해요',' | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| ['새 분석을 준비 중입니다. 기존 자료는 유지됩니다.',' | ['새 분석을 준비하고 있어요. 기존 자료는 그대로 있어요.',' | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| ['이 자료는 삭제됐거나 비공개로 전환됐을 수 있어요. 연결됐던 단어는 단어장에 그대로 남아 있습니다.',' | ['이 자료는 삭제됐거나 비공개로 바뀌었을 수 있어요. 연결됐던 단어는 단어장에 그대로 남아 있어요.',' | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| '이메일 또는 비밀번호가 올바르지 않습니다.' | '이메일 또는 비밀번호가 올바르지 않아요.' | `src/lib/authErrors.js` (인증) | 1 |
| '이메일 인증이 필요합니다. 받은 편지함을 확인해주세요.' | '이메일 인증이 필요해요. 받은 편지함을 확인해 주세요.' | `src/lib/authErrors.js` (인증) | 1 |
| `비밀번호는 최소 ${min}자 이상이어야 합니다.` : '비밀번호가 너무 짧습니다.' | `비밀번호는 최소 ${min}자 이상이어야 해요.` : '비밀번호가 너무 짧아요.' | `src/lib/authErrors.js` (인증) | 1 |
| '시도 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.' | '시도 횟수가 너무 많아요. 잠시 후 다시 시도해 주세요.' | `src/lib/authErrors.js` (인증) | 1 |
| '유효하지 않은 이메일 형식입니다.' | '이메일 형식이 올바르지 않아요.' | `src/lib/authErrors.js` (인증) | 1 |
| '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.' | '인터넷 연결을 확인해 주세요. 연결되면 다시 시도해 주세요.' | `src/lib/authErrors.js` (인증) | 1 |
| '현재 회원가입이 비활성화되어 있습니다.' | '지금은 회원가입을 받지 않아요.' | `src/lib/authErrors.js` (인증) | 1 |
| '링크가 만료되었습니다. 다시 요청해주세요.' | '링크가 만료됐어요. 다시 요청해 주세요.' | `src/lib/authErrors.js` (인증) | 1 |
| '등록된 사용자를 찾을 수 없습니다.' | '등록된 사용자를 찾을 수 없어요.' | `src/lib/authErrors.js` (인증) | 1 |
| '분석 결과의 줄 위치가 올바르지 않아 기존 분석을 유지합니다.' | '분석 결과의 줄 위치가 올바르지 않아 기존 분석을 그대로 둬요.' | `src/lib/analysisCoverage.js` | 1 |
| '뜻 줄만 걷어내는 계획이 아닙니다(바뀐 줄 존재) — 정제를 중단합니다.' | '뜻 줄만 걷어내는 계획이 아니에요(바뀐 줄 있음) — 정제를 멈췄어요.' | `src/lib/bilingualSplit.js` | 1 |
| '기존 분석을 옮길 수 없어 정제를 중단합니다.' | '기존 분석을 옮길 수 없어 정제를 멈췄어요.' | `src/lib/bilingualSplit.js` | 1 |
| 자동으로 합칠 수 없어요. 내 자료를 유지합니다.' | 자동으로 합칠 수 없어요. 내 자료는 그대로 둬요.' | `src/lib/classCopyModel.js` | 1 |
| 저장한 위치를 보호하기 위해 내 자료를 유지합니다.' | 저장한 위치를 보호하려고 내 자료는 그대로 둬요.' | `src/lib/classCopyModel.js` | 1 |
| '기존 단어 위치를 안전하게 연결하지 못했어요. 내 자료를 유지합니다.' | '기존 단어 위치를 안전하게 연결하지 못했어요. 내 자료는 그대로 둬요.' | `src/lib/classCopyModel.js` | 1 |
| 저장한 단어와 문맥을 보호하기 위해 내 자료를 유지합니다.' | 저장한 단어와 문맥을 보호하려고 내 자료는 그대로 둬요.' | `src/lib/classCopyModel.js` | 1 |
| 'EPUB 항목이 너무 많습니다.' | 'EPUB 항목이 너무 많아요.' | `src/lib/epub.js` | 1 |
| 'EPUB 압축 용량 정보가 맞지 않습니다.' | 'EPUB 압축 용량 정보가 맞지 않아요.' | `src/lib/epub.js` | 1 |
| '기존 레벨별 어휘 학습 페이지로 연결됩니다.' | '기존 레벨별 어휘 학습 페이지로 연결돼요.' | `src/lib/learn/courseMapData.js` | 1 |
| '다른 변경이 있습니다. 새로 확인해 주세요.' | '다른 변경이 있어요. 새로 확인해 주세요.' | `src/lib/libraryOperations.js` | 1 |
| '서재 업데이트 준비 중입니다. 잠시 후 다시 시도해 주세요.' | '서재 업데이트를 준비하고 있어요. 잠시 후 다시 시도해 주세요.' | `src/lib/libraryOperations.js` | 1 |
| 기존 자료는 그대로 읽을 수 있습니다.' | 기존 자료는 그대로 읽을 수 있어요.' | `src/lib/materialDocument.js` | 1 |
| '저장 결과를 확인하지 못했어요. 다시 시도하면 같은 요청을 확인합니다.' | '저장 결과를 확인하지 못했어요. 다시 시도하면 같은 요청을 확인해요.' | `src/lib/materialImport.js` | 1 |
| '불러오지 못했어요. 저장된 자료는 그대로 있습니다.' | '불러오지 못했어요. 저장된 자료는 그대로 있어요.' | `src/lib/personalLibrary.js` | 1 |
| '안전한 분석 저장 기능을 준비 중이에요. 기존 원문과 분석은 그대로 유지됩니다.' | '안전한 분석 저장 기능을 준비 중이에요. 기존 원문과 분석은 그대로 있어요.' | `src/lib/reanalysisPreservation.js` | 1 |
| '원본 텍스트가 없습니다.' | '원본 텍스트가 없어요.' | `src/lib/reanalysisPreservation.js` | 1 |
| '기존 분석의 줄 위치를 확인하지 못했어요. 원문은 유지됩니다. 전체 재분석을 사용해 주세요.' | '기존 분석의 줄 위치를 확인하지 못했어요. 원문은 그대로 있으니 전체 재분석을 사용해 주세요.' | `src/lib/reanalysisPreservation.js` | 1 |
| '새 분석을 완료하지 못했어요. 기존 원문과 분석은 그대로 유지됩니다.' | '새 분석을 완료하지 못했어요. 기존 원문과 분석은 그대로 있어요.' | `src/lib/reanalysisPreservation.js` | 1 |
| '분석 연결을 확인하지 못했어요. 기존 원문과 분석은 그대로 유지됩니다.' | '분석 연결을 확인하지 못했어요. 기존 원문과 분석은 그대로 있어요.' | `src/lib/reanalysisPreservation.js` | 1 |
| '변경이 너무 큽니다 — 전체 분석을 사용해주세요.' | '변경이 너무 커요 — 전체 분석을 사용해 주세요.' | `src/lib/sourceEdit.js` | 1 |
| '기존 분석을 옮길 수 없습니다 — 전체 분석을 사용해주세요.' | '기존 분석을 옮길 수 없어요 — 전체 분석을 사용해 주세요.' | `src/lib/sourceEdit.js` | 1 |
| 원본은 그대로 읽을 수 있습니다.' | 원본은 그대로 읽을 수 있어요.' | `src/lib/sourcePassage.js` | 1 |
| '설명판 형식을 확인하지 못했어요. 저장된 내용은 그대로 보존합니다.' | '설명판 형식을 확인하지 못했어요. 저장된 내용은 그대로 남아 있어요.' | `src/lib/teachingBoard.js` | 1 |
| throw new Error('PDF 끝에 도달했습니다.'); | throw new Error('PDF 끝까지 읽었어요.'); | `src/lib/usePdfRangeMutation.js` | 1 |
| toast?.('스캔본으로 감지 — OCR로 재시도합니다 (시간이 걸려요)', 'info', 4000); | toast?.('스캔본이라 OCR로 다시 추출할게요. 시간이 조금 걸려요.', 'info', 4000); | `src/lib/usePdfRangeMutation.js` | 1 |
| throw new Error('추출된 텍스트가 너무 적습니다.'); | throw new Error('추출된 텍스트가 너무 적어요.'); | `src/lib/usePdfRangeMutation.js` | 1 |
| throw new Error('원본 텍스트가 없습니다.'); | throw new Error('원본 텍스트가 없어요.'); | `src/lib/useReanalyze.js` | 1 |
| 내 초안은 새 노트로 보관할 수 있습니다.' | 내 초안은 새 노트로 보관할 수 있어요.' | `src/lib/useStudyNote.js` | 1 |
| 내 초안을 새 노트로 보관할 수 있습니다.' | 내 초안을 새 노트로 보관할 수 있어요.' | `src/lib/useStudyNote.js` | 1 |
| throw new Error('유효한 행이 없습니다.'); | throw new Error('가져올 수 있는 행이 없어요.'); | `src/lib/useVocabData.js` | 1 |
| { error: '관리자 권한이 필요합니다.', status: 403 } | { error: '관리자 권한이 필요해요.', status: 403 } | `src/lib/supabaseServer.js` | 1 |
| 이전 분석을 유지합니다.' | 이전 분석을 그대로 둬요.' | `src/lib/reanalysisPreservation.js` | 9 |
| '접근할 수 없는 자료입니다.' | '접근할 수 없는 자료예요.' | `src/lib/server/learningContext.js` | 1 |
| 내 초안은 이 기기에 보관되어 있습니다.' | 내 초안은 이 기기에 보관돼 있어요.' | `src/lib/server/studyNotes.js` | 1 |
| 문형 교재입니다. | 문형 교재예요. | `src/app/(app)/admin/legacy-textbooks/[[...path]]/page.jsx` (관리자) | 1 |
| hint="집계 함수가 아직 이 환경에 배포되지 않았습니다." | hint="집계 함수가 아직 이 환경에 배포되지 않았어요." | `src/app/(app)/admin/metrics/page.jsx` (관리자) | 1 |
| 아래 대시보드가 채워집니다. (집계 전용 함수 — 행·원문은 ⏎             반환하지 않습니다.) | 아래 대시보드가 채워져요. (집계 전용 함수 — 행·원문은 ⏎             반환하지 않아요.) | `src/app/(app)/admin/metrics/page.jsx` (관리자) | 1 |
| 원문(detail)은 표시하지 않습니다 — 오답률·노출수만으로 후보를 좁힙니다. | 원문(detail)은 표시하지 않아요 — 오답률·노출수만으로 후보를 좁혀요. | `src/app/(app)/admin/metrics/page.jsx` (관리자) | 1 |
| 자료를 처리하지 못했어요. 기존 자료는 유지됩니다. | 자료를 처리하지 못했어요. 기존 자료는 그대로 있어요. | `src/app/api/class/[team]/copy/route.js` | 1 |
| 교재는 나중에 연결해도 됩니다. | 교재는 나중에 연결해도 돼요. | `src/views/ClassHubPage.jsx` | 1 |
| 자유롭게 배우는 수업입니다. | 자유롭게 배우는 수업이에요. | `src/views/ClassTeamPage.jsx` | 1 |
| 처음 여는 자료는 내 서재에 보관됩니다. | 처음 여는 자료는 내 서재에 보관돼요. | `src/views/ClassTeamPage.jsx` | 1 |
| 한 번에 500개 요소까지 가능합니다. | 한 번에 500개 요소까지 가능해요. | `src/lib/noteRecognition.js` | 1 |

## 로딩 — 15건 · 16곳

| 전 | 후 | 파일 | n |
|---|---|---|---|
| "로딩 중..." | "화면 불러오는 중…" | `src/app/(app)/loading.jsx` | 1 |
| setExportMsg('데이터 수집 중...'); | setExportMsg('데이터 모으는 중…'); | `src/components/AccountSettings.jsx` | 1 |
| message = '로딩 중...' | message = '불러오는 중…' | `src/components/Spinner.jsx` | 1 |
| <Spinner message="로딩 중..." /> | <Spinner message="PDF 불러오는 중…" /> | `src/components/PdfJsViewer.jsx` | 1 |
| color: 'var(--text-muted)' }}>로딩 중...</div> | color: 'var(--text-muted)' }}>PDF 목록 불러오는 중…</div> | `src/views/MaterialAddPdfSection.jsx` | 1 |
| <Spinner message="PDF 로딩 중..." /> | <Spinner message="PDF 불러오는 중…" /> | `src/views/PdfViewerPage.jsx` | 1 |
| <Spinner message="로딩 중..." /> | <Spinner message="PDF 불러오는 중…" /> | `src/views/PdfViewerPage.jsx` | 1 |
| <Spinner message="자료 해부 중..." /> | <Spinner message="자료 불러오는 중…" /> | `src/views/ViewerPage.jsx` | 1 |
| vt("상세 설명 생성 중...") | vt("상세 설명 만드는 중…") | `src/views/ViewerPage.jsx` | 1 |
| '검증한 분석을 저장 중입니다…' | '검증한 분석을 저장하고 있어요…' | `src/views/ViewerPage.jsx` | 2 |
| '문단 단위로 분석 중입니다...' | '문단 단위로 분석하고 있어요…' | `src/views/ViewerPage.jsx` | 1 |
| ['상세 설명 생성 중...',' | ['상세 설명 만드는 중…',' | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| ['검증한 분석을 저장 중입니다…',' | ['검증한 분석을 저장하고 있어요…',' | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| ['문단 단위로 분석 중입니다...','正在逐段分析...','正在逐段分析...'] | ['문단 단위로 분석하고 있어요…','正在逐段分析…','正在逐段分析…'] | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| ['자료 해부 중...','正在解析资料...','正在解析資料...'] | ['자료 불러오는 중…','正在加载资料…','正在載入資料…'] | `src/lib/viewerMessages.js` (번역표 키) | 1 |

## 말줄임표 — 35건 · 35곳

| 전 | 후 | 파일 | n |
|---|---|---|---|
| vt("분석 중...") | vt("분석 중…") | `src/views/ViewerPage.jsx` | 1 |
| '추출 중...' | '추출 중…' | `src/views/ViewerPage.jsx` | 1 |
| ['분석 중...',' | ['분석 중…',' | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| placeholder={listening ? '듣는 중...' : placeholder} | placeholder={listening ? '듣는 중…' : placeholder} | `src/components/ConversationPanel.jsx` — 줄 단위 | 1 |
| {saving ? '저장 중...' : '시작하기'} | {saving ? '저장 중…' : '시작하기'} | `src/components/OnboardingModal.jsx` — 줄 단위 | 1 |
| {resendingConfirm ? '발송 중...' : '인증 메일 다시 보내기'} | {resendingConfirm ? '발송 중…' : '인증 메일 다시 보내기'} | `src/components/Layout.jsx` — 줄 단위 | 1 |
| {mutation.isPending ? '가져오는 중...' : '자료로 만들어 읽기'} | {mutation.isPending ? '가져오는 중…' : '자료로 만들어 읽기'} | `src/components/PdfReadBridge.jsx` — 줄 단위 | 1 |
| {submitting ? '저장 중...' : passwordLogin ? '변경' : '만들기'} | {submitting ? '저장 중…' : passwordLogin ? '변경' : '만들기'} | `src/components/AccountSettings.jsx` — 줄 단위 | 1 |
| {deleting ? '삭제 중...' : '영구 삭제'} | {deleting ? '삭제 중…' : '영구 삭제'} | `src/components/AccountSettings.jsx` — 줄 단위 | 1 |
| {submitting ? '접수 중...' : '신고'} | {submitting ? '접수 중…' : '신고'} | `src/components/ReportMaterialButton.jsx` — 줄 단위 | 1 |
| {markCompleteMutation.isPending ? '...' : '✓ 읽기 완료'} | {markCompleteMutation.isPending ? '…' : '✓ 읽기 완료'} | `src/views/ViewerPage.jsx` — 줄 단위 | 1 |
| <div className="pdf-context__loading">번역 + 맥락 생성 중...</div> | <div className="pdf-context__loading">번역 + 맥락 생성 중…</div> | `src/views/PdfViewerPage.jsx` — 줄 단위 | 1 |
| <div className="pdf-side__empty">분석 중...</div> | <div className="pdf-side__empty">분석 중…</div> | `src/views/PdfViewerPage.jsx` — 줄 단위 | 1 |
| {analyzing \|\| contextLoading ? '...' : '→'} | {analyzing \|\| contextLoading ? '…' : '→'} | `src/views/PdfViewerPage.jsx` — 줄 단위 | 1 |
| ? <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>상세 설명 생성 중...</div> | ? <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>상세 설명 생성 중…</div> | `src/views/PdfViewerPage.jsx` — 줄 단위 | 1 |
| {addSourceMutation.isPending ? '추가 중...' : '추가'} | {addSourceMutation.isPending ? '추가 중…' : '추가'} | `src/views/AdminPage.jsx` — 줄 단위 | 1 |
| {analyzing ? '분석 중...' : '분석'} | {analyzing ? '분석 중…' : '분석'} | `src/views/QuickPage.jsx` — 줄 단위 | 1 |
| ? <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>상세 설명 생성 중...</div> | ? <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>상세 설명 생성 중…</div> | `src/views/QuickPage.jsx` — 줄 단위 | 1 |
| {saved ? '✓ 저장됨' : saving[key] ? '저장 중...' : '단어장에 저장'} | {saved ? '✓ 저장됨' : saving[key] ? '저장 중…' : '단어장에 저장'} | `src/views/QuickPage.jsx` — 줄 단위 | 1 |
| {busy ? '저장 중...' : '저장'} | {busy ? '저장 중…' : '저장'} | `src/views/ProfileStats.jsx` — 줄 단위 | 1 |
| {updateVocabMutation?.isPending ? '저장 중...' : '저장'} | {updateVocabMutation?.isPending ? '저장 중…' : '저장'} | `src/views/VocabList.jsx` — 줄 단위 | 1 |
| {saveProfileMutation.isPending ? '저장 중...' : '저장'} | {saveProfileMutation.isPending ? '저장 중…' : '저장'} | `src/views/MyPage.jsx` — 줄 단위 | 1 |
| {saveGoalsMutation.isPending ? '저장 중...' : '저장'} | {saveGoalsMutation.isPending ? '저장 중…' : '저장'} | `src/views/MyPage.jsx` — 줄 단위 | 1 |
| {uploading ? '업로드 중...' : '＋ PDF 업로드'} | {uploading ? '업로드 중…' : '＋ PDF 업로드'} | `src/views/MaterialAddPdfSection.jsx` — 줄 단위 | 1 |
| ? (useOcr ? 'OCR 추출 중...' : '텍스트 추출 중...') | ? (useOcr ? 'OCR 추출 중…' : '텍스트 추출 중…') | `src/views/MaterialAddPdfSection.jsx` — 줄 단위 | 1 |
| placeholder="제목으로 자료 찾기..." | placeholder="제목으로 자료 찾기…" | `src/views/MaterialsPage.jsx` — 줄 단위 | 1 |
| placeholder="동사 / 명사 / 형용사..." | placeholder="동사 / 명사 / 형용사…" | `src/views/VocabPage.jsx` — 줄 단위 | 1 |
| {manualAddMutation.isPending ? '추가 중...' : '추가'} | {manualAddMutation.isPending ? '추가 중…' : '추가'} | `src/views/VocabPage.jsx` — 줄 단위 | 1 |
| placeholder="의미를 입력하세요..." | placeholder="의미를 입력하세요…" | `src/views/VocabReview.jsx` — 줄 단위 | 1 |
| {exampleLoading ? '예문 생성 중...' : 'AI 예문 보기'} | {exampleLoading ? '예문 생성 중…' : 'AI 예문 보기'} | `src/views/VocabReview.jsx` — 줄 단위 | 1 |
| {resending ? '보내는 중...' : '인증 메일 다시 보내기'} | {resending ? '보내는 중…' : '인증 메일 다시 보내기'} | `src/views/AuthPage.jsx` — 줄 단위 | 1 |
| {loading ? '처리 중...' : isReset ? '비밀번호 변경' : isForgot ? '재설정 링크 보내기' : isLogin ? '로그인' : '회원가입'} | {loading ? '처리 중…' : isReset ? '비밀번호 변경' : isForgot ? '재설정 링크 보내기' : isLogin ? '로그인' : '회원가입'} | `src/views/AuthPage.jsx` — 줄 단위 | 1 |
| placeholder="이 자료에 대해 이야기해보세요..." | placeholder="이 자료에 대해 이야기해보세요…" | `src/views/ViewerComments.jsx` — 줄 단위 | 1 |
| {addCommentMutation.isPending ? '...' : '등록'} | {addCommentMutation.isPending ? '…' : '등록'} | `src/views/ViewerComments.jsx` — 줄 단위 | 1 |
| placeholder="https://youtu.be/..." | placeholder="https://youtu.be/…" | `src/components/MaterialAddLinkSection.jsx` | 1 |

## 성공 토스트 — 21건 · 21곳

| 전 | 후 | 파일 | n |
|---|---|---|---|
| `《${inspect.book.title \|\| '제목 없는 책'}》 정제 — ${done}과 완료${failed ? ` · ${failed}과는 정제하지 못했어요` : ''}` | `《${inspect.book.title \|\| '제목 없는 책'}》 ${done}과를 정제했어요.${failed ? ` ${failed}과는 정제하지 못했어요.` : ''}` | `src/components/BookRefinePanel.jsx` | 1 |
| toast('휴지통으로 옮겼습니다.', 'info'); | toast('PDF를 휴지통으로 옮겼어요.', 'info'); | `src/views/MaterialAddPdfSection.jsx` | 1 |
| toast('휴지통으로 옮겼습니다.', 'success'); | toast('자료를 휴지통으로 옮겼어요.', 'success'); | `src/views/MaterialsPage.jsx` | 1 |
| '공용으로 공개했습니다.' : '비공개로 전환했습니다.' | '공용으로 공개했어요.' : '비공개로 바꿨어요.' | `src/views/MaterialsPage.jsx` | 1 |
| toast(`"${token.text}" 저장!`, 'success'); | toast(`"${token.text}" 단어를 저장했어요`, 'success'); | `src/views/PdfViewerPage.jsx` | 1 |
| toast('소스가 추가되었습니다.', 'success'); | toast('소스를 추가했어요.', 'success'); | `src/views/AdminPage.jsx` (관리자) | 1 |
| `《${bookDraft.title}》 챕터 ${total}개 등록 완료! 각 챕터는 열 때 분석돼요.` | `《${bookDraft.title}》 챕터 ${total}개를 등록했어요. 각 챕터는 열 때 분석돼요.` | `src/views/MaterialAddPage.jsx` | 1 |
| toast('복습 알림이 해제됐습니다.', 'success'); | toast('복습 알림을 껐어요.', 'success'); | `src/views/MyPage.jsx` | 1 |
| toast('목표가 저장됐습니다.', 'success'); | toast('목표를 저장했어요.', 'success'); | `src/views/MyPage.jsx` | 1 |
| toast('프로필이 저장됐습니다.', 'success'); | toast('프로필을 저장했어요.', 'success'); | `src/views/MyPage.jsx` | 1 |
| toast(`"${token.text}" 저장!`, 'success'); | toast(`"${token.text}" 단어를 저장했어요`, 'success'); | `src/views/QuickPage.jsx` | 1 |
| toast?.(`"${item.pattern}" 단어장에 저장`, 'success'); | toast?.(`"${item.pattern}" 문형을 저장했어요`, 'success'); | `src/views/ReferencePatternIndexPage.jsx` | 1 |
| toast?.(`"${text}" 단어장에 저장`, 'success'); | toast?.(`"${text}" 단어를 저장했어요`, 'success'); | `src/views/ReferenceVocabPage.jsx` | 1 |
| toast('수정이 저장됐어요!', 'success'); | toast('수정을 저장했어요', 'success'); | `src/views/ViewerPage.jsx` | 1 |
| if (linked) toast(`"${token.text}" 저장!`, 'success'); | if (linked) toast(`"${token.text}" 단어를 저장했어요`, 'success'); | `src/views/ViewerPage.jsx` | 1 |
| toast(`"${token.text}" 저장!`, 'success'); | toast(`"${token.text}" 단어를 저장했어요`, 'success'); | `src/views/ViewerPage.jsx` | 1 |
| toast?.(queued ? '복습 저장 — 연결되면 보내요' : '복습 완료!', 'success', 2000); | toast?.(queued ? '복습을 이 기기에 저장했어요. 연결되면 보내요.' : '복습을 저장했어요', 'success', 2000); | `src/lib/useInlineReview.js` | 1 |
| toast?.('분석 시작 — 뷰어로 이동합니다', 'success'); | toast?.('분석을 시작했어요. 뷰어로 이동할게요.', 'success'); | `src/lib/usePdfRangeMutation.js` | 1 |
| else toast?.('분석 완료!', 'success'); | else toast?.('분석을 마쳤어요', 'success'); | `src/lib/useReanalyze.js` | 1 |
| toast('단어를 삭제했습니다.', 'info'); | toast('단어를 삭제했어요.', 'info'); | `src/lib/useVocabData.js` | 1 |
| toast(`${count}개 단어를 삭제했습니다.`, 'info'); | toast(`단어 ${count}개를 삭제했어요.`, 'info'); | `src/lib/useVocabData.js` | 1 |

## 되돌리기 — 8건 · 8곳

| 전 | 후 | 파일 | n |
|---|---|---|---|
| onClick={()=>resume(result.id,true)}>실행 취소</button> | onClick={()=>resume(result.id,true)}>되돌리기</button> | `src/components/library/LibraryShelf.jsx` | 1 |
| setUndo(null);})}>실행 취소</button> | setUndo(null);})}>되돌리기</button> | `src/components/library/LibraryCollections.jsx` | 1 |
| ['undo','실행 취소'] | ['undo','되돌리기'] | `src/components/classroom/BoardHistory.jsx` | 1 |
| toast('가장 최근 저장만 취소할 수 있어요.', 'info'); | toast('가장 최근 저장만 되돌릴 수 있어요.', 'info'); | `src/views/ViewerPage.jsx` | 1 |
| toast(`"${snapshot.text}" 저장을 취소했어요`, 'info'); | toast(`"${snapshot.text}" 저장을 되돌렸어요`, 'info'); | `src/views/ViewerPage.jsx` | 1 |
| throw new Error('저장 취소 가능 시간이 지났어요.'); | throw new Error('되돌릴 수 있는 시간이 지났어요.'); | `src/lib/viewerSaveUndo.js` | 1 |
| throw new Error('안전한 저장 취소 기능을 준비 중이에요. 저장한 단어는 유지됩니다.'); | throw new Error('안전한 되돌리기 기능을 준비 중이에요. 저장한 단어는 그대로 있어요.'); | `src/lib/viewerSaveUndo.js` | 1 |
| throw new Error('단어가 없거나 저장 취소 결과를 확인하지 못했어요.'); | throw new Error('단어가 없거나 되돌린 결과를 확인하지 못했어요.'); | `src/lib/viewerSaveUndo.js` | 1 |

## 복습 없음 — 7건 · 7곳

| 전 | 후 | 파일 | n |
|---|---|---|---|
| '지금 다시 볼 표현은 없어요. 다음 복습까지 새로운 문장을 만나 보세요.' | '지금 복습할 표현이 없어요. 다음 복습까지 새로운 문장을 만나 보세요.' | `src/components/vocab/FsrsReviewSession.jsx` | 1 |
| '지금 다시 볼 표현은 없어요. 다음 복습까지 새로운 문장을 만나 보세요.' | '지금 복습할 표현이 없어요. 다음 복습까지 새로운 문장을 만나 보세요.' | `src/views/VocabPage.jsx` | 1 |
| '지금 복습할 문법은 없어요. 다음 일정에 다시 만나요.' | '지금 복습할 문법이 없어요. 다음 일정에 다시 만나요.' | `src/views/VocabPage.jsx` | 1 |
| '오늘 복습할 문법이 없어요. 강의에서 챕터의 패턴 체크를 통과하면 며칠 뒤 여기로 돌아옵니다.' | '지금 복습할 문법이 없어요. 강의에서 챕터의 패턴 체크를 통과하면 며칠 뒤 여기로 돌아와요.' | `src/views/GrammarReviewSession.jsx` | 1 |
| '지금 복습할 표현은 없어요.' : '예문 아래 ‘예문 담기’로 시작하세요.' | '지금 복습할 표현이 없어요.' : '예문 아래 ‘예문 담기’로 시작해 보세요.' | `src/views/HomePage.jsx` | 1 |
| '지금은 복습할 단어가 없어요' | '지금 복습할 단어가 없어요' | `src/views/VocabReview.jsx` | 1 |
| 지금은 복습할 게 없어요 — 내일 다시 와요 | 지금 복습할 단어가 없어요. 내일 다시 와 주세요. | `src/components/world/QuestReview.jsx` | 1 |

## 연결 끊김 — 11건 · 11곳

| 전 | 후 | 파일 | n |
|---|---|---|---|
| 인터넷에 연결되지 않았어요 | 인터넷 연결을 확인해 주세요 | `src/app/(app)/offline/page.jsx` | 1 |
| 네트워크 연결을 확인한 후 다시 시도해주세요. | 이 기기에 받아 둔 자료는 그대로 열 수 있어요. 연결되면 다시 시도해 주세요. | `src/app/(app)/offline/page.jsx` | 1 |
| title: '네트워크 연결 오류', desc: '인터넷 연결을 확인한 후 다시 시도해주세요.' | title: '인터넷 연결을 확인해 주세요', desc: '연결되면 다시 시도해 주세요.' | `src/app/(app)/viewer/error.jsx` | 1 |
| '네트워크 연결을 확인해주세요' | '인터넷 연결을 확인해 주세요' | `src/app/error.jsx` | 1 |
| '인터넷 연결이 불안정한 것 같아요. 잠시 후 다시 시도해주세요.' | '연결이 불안정한 것 같아요. 잠시 후 다시 시도해 주세요.' | `src/app/error.jsx` | 1 |
| 인터넷 연결이 끊겼습니다. 저장해 둔 자료·단어장은 그대로 볼 수 있어요. | 인터넷 연결을 확인해 주세요. 저장해 둔 자료·단어장은 그대로 볼 수 있어요. | `src/components/Layout.jsx` | 1 |
| '연결이 끊겼어요. 입력한 내용은 유지됩니다.' | '인터넷 연결을 확인해 주세요. 입력한 내용은 그대로 있어요.' | `src/components/admin/TextbookEditor.jsx` (관리자) | 1 |
| '오프라인이라 목록을 못 받았어요 — 연결되면 다시 열어 주세요.' | '인터넷 연결을 확인해 주세요. 연결되면 목록을 다시 열 수 있어요.' | `src/views/ClassTeamPage.jsx` | 1 |
| setError('네트워크 오류가 발생했어요.'); | setError('인터넷 연결을 확인해 주세요. 작문은 그대로 있어요.'); | `src/views/WritingStudioPage.jsx` | 1 |
| toast('네트워크 오류로 복원하지 못했어요.', 'error'); | toast('복원하지 못했어요. 인터넷 연결을 확인해 주세요.', 'error'); | `src/components/admin/ChapterAdminStrip.jsx` (관리자) | 1 |
| setError('네트워크 오류로 저장하지 못했어요.'); | setError('저장하지 못했어요. 인터넷 연결을 확인해 주세요.'); | `src/components/admin/InlineEditForm.jsx` (관리자) | 1 |

## 로그인 필요 — 12건 · 14곳

| 전 | 후 | 파일 | n |
|---|---|---|---|
| '로그인이 필요합니다.' | '로그인이 필요해요.' | `src/app/api/analyze/route.js` | 1 |
| '로그인이 필요합니다.' | '로그인이 필요해요.' | `src/app/api/explain/route.js` | 1 |
| '로그인이 필요합니다.' | '로그인이 필요해요.' | `src/app/api/gemini/route.js` | 1 |
| '로그인이 필요합니다.' | '로그인이 필요해요.' | `src/app/api/study-paragraph/route.js` | 1 |
| '로그인이 필요합니다.' | '로그인이 필요해요.' | `src/app/api/writing-feedback/route.js` | 1 |
| toast('로그인이 필요합니다.', 'warning'); | toast('로그인이 필요해요.', 'warning'); | `src/views/PdfViewerPage.jsx` | 1 |
| if (!user) { toast('로그인이 필요합니다.', 'warning'); return; } | if (!user) { toast('로그인이 필요해요.', 'warning'); return; } | `src/views/MaterialAddPage.jsx` | 2 |
| >로그인이 필요합니다</h2> | >로그인이 필요해요</h2> | `src/views/MyPage.jsx` | 1 |
| toast('로그인이 필요합니다.', 'warning'); | toast('로그인이 필요해요.', 'warning'); | `src/views/ViewerPage.jsx` | 1 |
| ['로그인이 필요합니다.',' | ['로그인이 필요해요.',' | `src/lib/viewerMessages.js` (번역표 키) | 1 |
| { error: '로그인이 필요합니다.', status: 401 } | { error: '로그인이 필요해요.', status: 401 } | `src/lib/supabaseServer.js` | 2 |
| { error: '로그인이 필요합니다.', status: 401 } | { error: '로그인이 필요해요.', status: 401 } | `src/lib/server/auth.js` | 1 |

## 빈 상태 — 5건 · 5곳

| 전 | 후 | 파일 | n |
|---|---|---|---|
| '조건에 맞는 자료가 없습니다.' | '조건에 맞는 자료가 없어요.' | `src/views/MaterialsPage.jsx` | 1 |
| '아직 공유된 공용 자료가 없습니다.' | '아직 공유된 공용 자료가 없어요.' | `src/views/MaterialsPage.jsx` | 1 |
| '아직 작성한 노트가 없습니다.' : '아직 보관된 개인 자료가 없습니다.' | '아직 작성한 노트가 없어요.' : '아직 보관된 개인 자료가 없어요.' | `src/views/MaterialsPage.jsx` | 1 |
| 레슨이 없습니다. | 레슨이 없어요. | `src/views/CourseMapPage.jsx` | 1 |
| '검색 결과가 없습니다.' | '검색 결과가 없어요.' | `src/views/VocabList.jsx` | 1 |

## 확인창 — 6건 · 6곳

| 전 | 후 | 파일 | n |
|---|---|---|---|
| >정제 실행 ({inspect.stats.chapters}과)</Button> | >정제하기 ({inspect.stats.chapters}과)</Button> | `src/components/BookRefinePanel.jsx` | 1 |
| title="책 단위 정제" | title="이 책을 책 단위로 정제할까요?" | `src/components/BookRefinePanel.jsx` | 1 |
| confirmLabel="정제 실행" | confirmLabel="정제하기" | `src/components/BookRefinePanel.jsx` | 1 |
| title="암호 바꾸기" | title="입장 암호를 바꿀까요?" | `src/views/ClassHubPage.jsx` | 1 |
| confirmLabel="바꾸기" | confirmLabel="암호 바꾸기" | `src/views/ClassHubPage.jsx` | 1 |
| onClick={()=>setDialog('trash')}>휴지통으로 이동</button> | onClick={()=>setDialog('trash')}>휴지통으로</button> | `src/components/library/LibraryShelf.jsx` | 1 |

## TEST — 25건 · 30곳

| 전 | 후 | 파일 | n |
|---|---|---|---|
| '이메일 또는 비밀번호가 올바르지 않습니다.' | '이메일 또는 비밀번호가 올바르지 않아요.' | `src/lib/__tests__/authErrors.more.test.js` | 2 |
| '이메일 인증이 필요합니다. 받은 편지함을 확인해주세요.' | '이메일 인증이 필요해요. 받은 편지함을 확인해 주세요.' | `src/lib/__tests__/authErrors.more.test.js` | 1 |
| '시도 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.' | '시도 횟수가 너무 많아요. 잠시 후 다시 시도해 주세요.' | `src/lib/__tests__/authErrors.more.test.js` | 2 |
| '유효하지 않은 이메일 형식입니다.' | '이메일 형식이 올바르지 않아요.' | `src/lib/__tests__/authErrors.more.test.js` | 1 |
| '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.' | '인터넷 연결을 확인해 주세요. 연결되면 다시 시도해 주세요.' | `src/lib/__tests__/authErrors.more.test.js` | 3 |
| '현재 회원가입이 비활성화되어 있습니다.' | '지금은 회원가입을 받지 않아요.' | `src/lib/__tests__/authErrors.more.test.js` | 1 |
| '링크가 만료되었습니다. 다시 요청해주세요.' | '링크가 만료됐어요. 다시 요청해 주세요.' | `src/lib/__tests__/authErrors.more.test.js` | 2 |
| '등록된 사용자를 찾을 수 없습니다.' | '등록된 사용자를 찾을 수 없어요.' | `src/lib/__tests__/authErrors.more.test.js` | 1 |
| toBe('비밀번호는 최소 8자 이상이어야 합니다.') | toBe('비밀번호는 최소 8자 이상이어야 해요.') | `src/lib/__tests__/authAccountGuidance.test.js` | 1 |
| toBe('비밀번호는 최소 6자 이상이어야 합니다.') | toBe('비밀번호는 최소 6자 이상이어야 해요.') | `src/lib/__tests__/authAccountGuidance.test.js` | 1 |
| expect(html).toContain('다시 확인'); | expect(html).toContain('다시 시도'); | `src/lib/__tests__/classTextbookNotesRender.test.jsx` | 1 |
| '다른 수정과 겹쳤어요. 입력은 보관돼 있습니다.' | '다른 수정과 겹쳤어요. 입력은 보관돼 있어요.' | `src/lib/__tests__/classTextbookNotesRender.test.jsx` | 1 |
| toHaveBeenCalledWith('복습 저장 — 연결되면 보내요', 'success', 2000) | toHaveBeenCalledWith('복습을 이 기기에 저장했어요. 연결되면 보내요.', 'success', 2000) | `src/lib/__tests__/gradeOutbox.test.js` | 1 |
| 「복습 완료!」 | 「복습을 저장했어요」 | `src/lib/__tests__/gradeOutbox.test.js` | 1 |
| toHaveBeenCalledWith('복습 완료!', 'success', 2000) | toHaveBeenCalledWith('복습을 저장했어요', 'success', 2000) | `src/lib/__tests__/gradeOutbox.test.js` | 1 |
| rejects.toThrow('유지됩니다') | rejects.toThrow('저장한 단어는 그대로 있어요') | `src/lib/__tests__/viewerSaveUndo.test.js` | 1 |
| toContain('레슨이 없습니다.') | toContain('레슨이 없어요.') | `src/views/__tests__/CourseMapPage.test.jsx` | 1 |
| if (!updated) throw new Error('문법 복습 결과를 저장하지 못했습니다.') | if (!updated) throw new Error('문법 복습 결과를 저장하지 못했어요.') | `src/views/__tests__/reviewReliabilityFixes.test.js` | 1 |
| if \(r\?\.ok === false\) \{ toast\('복습 저장 실패/ | if \(r\?\.ok === false\) \{ toast\('복습을 저장하지 못했어요/ | `src/views/__tests__/reviewSaveSurface.test.js` | 1 |
| 조용한 교정(quiet)은 「수정이 저장됐어요!」 토스트를 생략 | 조용한 교정(quiet)은 「수정을 저장했어요」 토스트를 생략 | `src/views/__tests__/senseCorrection.test.js` | 1 |
| toast\('수정이 저장됐어요!', 'success'\);/ | toast\('수정을 저장했어요', 'success'\);/ | `src/views/__tests__/senseCorrection.test.js` | 1 |
| friendlyToastMessage: error => error.message, | friendlyToastMessage: error => error.message, failureMessage: (head, error) => `${head} ${error.message}`, | `src/views/__tests__/queuedReviewUndoRecovery.test.js` | 1 |
| toContain("onError: (err) => toast('수정 실패 — ' + friendlyToastMessage(err), 'error')") | toContain("onError: (err) => toast(failureMessage('수정을 저장하지 못했어요.', err), 'error')") | `src/views/__tests__/senseCorrection.test.js` | 1 |
| toBe('비밀번호가 너무 짧습니다.') | toBe('비밀번호가 너무 짧아요.') | `src/lib/__tests__/authAccountGuidance.test.js` | 1 |
| '비밀번호는 최소 6자 이상이어야 합니다.' | '비밀번호는 최소 6자 이상이어야 해요.' | `src/lib/__tests__/authErrors.more.test.js` | 1 |

## E2E — 28건 · 38곳

| 전 | 후 | 파일 | n |
|---|---|---|---|
| hasText: '이메일 또는 비밀번호가 올바르지 않습니다.' | hasText: '이메일 또는 비밀번호가 올바르지 않아요.' | `e2e/auth-account-guidance.e2e.mjs` | 1 |
| hasText: '이메일 인증이 필요합니다.' | hasText: '이메일 인증이 필요해요.' | `e2e/auth-account-guidance.e2e.mjs` | 1 |
| getByRole('button',{name:'다시 불러오기',exact:true}) | getByRole('button',{name:'다시 시도',exact:true}) | `e2e/library-v4.e2e.mjs` | 1 |
| '이전 형식의 노트입니다. 노트를 열어 확인하세요.' | '이전 형식의 노트예요. 노트를 열어 확인해 주세요.' | `e2e/textbook-teaching.e2e.mjs` | 1 |
| '읽던 위치가 계정에 저장됩니다.' | '읽던 위치가 계정에 저장돼요.' | `e2e/original-reading-position.e2e.mjs` | 2 |
| '비밀번호 재설정 링크를 이메일로 보냈습니다. 확인해주세요.' | '비밀번호 재설정 링크를 이메일로 보냈어요. 확인해 주세요.' | `e2e/auth-return.e2e.mjs` | 1 |
| getByRole('button',{name:'다시 불러오기',exact:true}) | getByRole('button',{name:'다시 시도',exact:true}) | `e2e/library-discovery.e2e.mjs` | 1 |
| '아직 보관된 개인 자료가 없습니다.' | '아직 보관된 개인 자료가 없어요.' | `e2e/library-discovery.e2e.mjs` | 1 |
| '아직 작성한 노트가 없습니다.' | '아직 작성한 노트가 없어요.' | `e2e/library-discovery.e2e.mjs` | 1 |
| ['empty','예문 아래 ‘예문 담기’로 시작하세요.'],['scheduled','지금 복습할 표현은 없어요.'],['due','복습할 표현이 있어요. 오늘 분량은 복습에서 확인하세요.'] | ['empty','예문 아래 ‘예문 담기’로 시작해 보세요.'],['scheduled','지금 복습할 표현이 없어요.'],['due','복습할 표현이 있어요. 오늘 분량은 복습에서 확인해 주세요.'] | `e2e/list-home-clarity.e2e.mjs` | 1 |
| getByRole('button',{name:'다시 불러오기',exact:true}) | getByRole('button',{name:'다시 시도',exact:true}) | `e2e/list-home-clarity.e2e.mjs` | 2 |
| getByText('지금 복습할 표현은 없어요.' | getByText('지금 복습할 표현이 없어요.' | `e2e/list-home-clarity.e2e.mjs` | 1 |
| getByText('수정이 저장됐어요!',{exact:true}) | getByText('수정을 저장했어요',{exact:true}) | `e2e/viewer-word-card.e2e.mjs` | 1 |
| getByText('수정이 저장됐어요!',{exact:true}) | getByText('수정을 저장했어요',{exact:true}) | `e2e/source-passage.e2e.mjs` | 1 |
| getByText('분석 완료!',{exact:true}) | getByText('분석을 마쳤어요',{exact:true}) | `e2e/viewer-boundary-edit.e2e.mjs` | 3 |
| getByText(/분석 실패: fixture result save unavailable/) | getByText(/분석하지 못했어요\. /) | `e2e/reading-loop.e2e.mjs` | 1 |
| getByText(/분석 실패:/) | getByText(/분석하지 못했어요\. /) | `e2e/viewer-analysis-resume.e2e.mjs` | 1 |
| '자료를 처리하지 못했어요. 기존 자료는 유지됩니다.' | '자료를 처리하지 못했어요. 기존 자료는 그대로 있어요.' | `e2e/class-copy.e2e.mjs` | 1 |
| getByRole('button',{name:'다시 확인',exact:true}) | getByRole('button',{name:'다시 시도',exact:true}) | `e2e/library-book-chapters.e2e.mjs` | 2 |
| getByRole('button',{name:'다시 확인',exact:true}) | getByRole('button',{name:'다시 시도',exact:true}) | `e2e/library-management.e2e.mjs` | 4 |
| getByRole('button',{name:'실행 취소',exact:true}) | getByRole('button',{name:'되돌리기',exact:true}) | `e2e/library-management.e2e.mjs` | 2 |
| getByRole('button',{name:'실행 취소',exact:true}) | getByRole('button',{name:'되돌리기',exact:true}) | `e2e/teaching-board-menu-checks.mjs` | 1 |
| menus.action('tools','실행 취소') | menus.action('tools','되돌리기') | `e2e/teaching-board.e2e.mjs` | 1 |
| getByRole('button',{name:'실행 취소',exact:true}) | getByRole('button',{name:'되돌리기',exact:true}) | `e2e/teaching-board.e2e.mjs` | 1 |
| getByRole('button',{name:'범위 다시 불러오기'}) | getByRole('button',{name:'다시 시도',exact:true}) | `e2e/n5-review-return.e2e.mjs` | 1 |
| getByRole('button',{name:'다시 불러오기',exact:true}) | getByRole('button',{name:'다시 시도',exact:true}) | `e2e/review-room.e2e.mjs` | 1 |
| getByRole('button',{name:'다시 불러오기'}) | getByRole('button',{name:'다시 시도',exact:true}) | `e2e/suggestion-reading.e2e.mjs` | 2 |
| getByRole('button', { name: '다시 불러오기', exact: true }) | getByRole('button', { name: '다시 시도', exact: true }) | `e2e/web-v2.e2e.mjs` | 1 |
