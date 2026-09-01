import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('src/views 리뷰 후속 신뢰성 회귀', () => {
  it('V-05 HomePage: 모든 Supabase 응답 오류를 throw하고 오류 UI를 표시한다', () => {
    const src = read('src/views/HomePage.jsx');
    expect(src).toContain('const dbResults = [');
    expect(src).toContain('const failed = dbResults.find(result => result?.error)');
    expect(src).toContain('if (failed) throw failed.error');
    expect(src).toContain('const { data, isLoading, error, refetch } = useQuery({');
    expect(src.indexOf('if (error) return (')).toBeLessThan(src.indexOf('const isNewUser'));
  });

  it('V-08 PdfViewerPage: signed URL 실패·경로 부재와 재시도를 렌더한다', () => {
    const src = read('src/views/PdfViewerPage.jsx');
    expect(src).toContain("throw new Error('SIGNED_URL_MISSING')");
    expect(src).toContain('isLoading: isPdfUrlLoading');
    expect(src).toContain('error: pdfUrlError');
    expect(src).toContain('refetch: refetchPdfUrl');
    expect(src).toContain('pdfUrlError || (pdfInfo && !pdfInfo.storage_path)');
    expect(src).toContain('onClick={() => refetchPdfUrl()}');
  });

  it('V-09 PdfViewerPage: 분석 두 경로가 finally로 플래그를 해제하고 늦은 응답을 버린다', () => {
    const src = read('src/views/PdfViewerPage.jsx');
    expect(src).toContain('const requestId = ++analyzeRequestRef.current');
    expect(src.match(/\} finally \{/g)).toHaveLength(2);
    expect(src).toContain('setAnalyzing(false)');
    expect(src).toContain('setContextLoading(false)');
    expect(src).toContain('requestId !== analyzeRequestRef.current');
    expect(src).toContain('analysisError.tokens');
    expect(src).toContain('analysisError.context');
  });

  it('V-10 Pdf/Vocab: localStorage 값을 lazy initializer가 아닌 마운트 effect에서 복원한다', () => {
    const pdf = read('src/views/PdfViewerPage.jsx');
    const vocab = read('src/views/VocabPage.jsx');
    expect(pdf).toContain("const [language, setLanguage] = useState('Japanese')");
    expect(pdf).toContain('const [hideKnown, setHideKnown] = useState(true)');
    expect(pdf).toMatch(/useEffect\(\(\) => \{[\s\S]*pdf_language[\s\S]*pdf_hideKnown[\s\S]*\}, \[\]\)/);
    expect(vocab).toContain("const [langFilter, setLangFilter] = useState('all')");
    expect(vocab).toContain("const [seriesFilter, setSeriesFilter] = useState('all')");
    expect(vocab).toContain("const [reviewMode, setReviewMode] = useState('auto')");
    expect(vocab).toContain('const [newPerDay, setNewPerDay] = useState(DEFAULT_NEW_PER_DAY)');
    expect(vocab).toContain('const [introIds, setIntroIds] = useState([])');
    expect(vocab).not.toContain('useState(loadIntroIds)');
  });

  it('V-11 MaterialsPage: 목록 오류가 성공한 빈 배열보다 먼저 분기된다', () => {
    const src = read('src/views/MaterialsPage.jsx');
    expect(src).toContain('error: materialsError');
    expect(src).toContain('refetch: refetchMaterials');
    // 순서 단언은 **둘 다 있는지 먼저** 확인한다 — 한쪽 앵커가 사라지면 indexOf가 -1이라
    // 「-1보다 크다」가 공허 통과한다(L축에서 실증한 함정). 빈 목록 분기 조건은 v2-P가
    // `filtered.length > 0` → `(filtered.length > 0 || visiblePdfs.length > 0)`로 넓혔다.
    const errAt = src.indexOf(') : materialsError ? (');
    const emptyAt = src.search(/\) : \(filtered\.length > 0/);
    expect(errAt, '오류 분기를 못 찾았다').toBeGreaterThan(-1);
    expect(emptyAt, '빈 목록 분기를 못 찾았다').toBeGreaterThan(-1);
    expect(errAt).toBeLessThan(emptyAt);
    expect(src).toContain('onClick={() => refetchMaterials()}');
  });

  it('V-12 GrammarReviewSession: 저장 성공 뒤에만 결과를 확정하고 실패 재시도를 제공한다', () => {
    const src = read('src/views/GrammarReviewSession.jsx');
    const awaitSave = src.indexOf('const updated = await gradeGrammarReview');
    const confirm = src.indexOf('setResults(prev => prev.length > idx');
    expect(awaitSave).toBeGreaterThan(-1);
    expect(confirm).toBeGreaterThan(awaitSave);
    expect(src).toContain("if (!updated) throw new Error('문법 복습 결과를 저장하지 못했습니다.')");
    expect(src).toContain('저장 다시 시도');
    expect(src).toContain('disabled={!graded || grading}');
  });

  it('V-13 ViewerPage: 모든 단어 저장이 공통 error 검사와 중복 클릭 가드를 통과한다', () => {
    const src = read('src/views/ViewerPage.jsx');
    expect(src.match(/\.upsert\(/g)).toHaveLength(1);
    expect(src).toContain("const { error } = await supabase.from('user_vocabulary').upsert(row, options)");
    expect(src).toContain('if (error) throw error');
    expect(src).toContain('if (inlineSaving[key]) return');
    // 리스트 행 1곳 — 팝업 저장 버튼은 카드 단일화(②)로 제거(카드 저장은 addToVocab 경로)
    expect(src.match(/onClick=\{\(\) => saveInlineVocabulary\(t\)\}/g)).toHaveLength(1);
  });

  it('V-13 보강 감사: 나머지 await mutation도 반환 error를 명시적으로 확인한다', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    const writing = read('src/views/WritingStudioPage.jsx');
    const materialAdd = read('src/views/MaterialAddPage.jsx');
    expect(viewer).toContain("const { error: logError } = await supabase.from('token_corrections').insert");
    expect(viewer).toContain("if (logError) console.warn('[correction log] failed:'");
    expect(writing).toContain('if (r2.error) throw r2.error');
    expect(materialAdd).toContain('const { error: suggestionLinkError } = await supabase');
    expect(materialAdd).toContain('if (suggestionLinkError)');
  });

  it('V-13 재감사: 비동기 mutation도 반환 error를 버리지 않는다', () => {
    const plan = read('src/views/StudyPlanPanel.jsx');
    const session = read('src/views/StudySessionPage.jsx');
    const materialAdd = read('src/views/MaterialAddPage.jsx');

    // 진도표는 v2-D R1에서 손 체크(study_plan_progress upsert)를 걷어내고 서버 진도를
    // 읽기만 한다. 검사할 mutation이 사라졌으니 같은 요구를 그 조회에 건다 —
    // 실패를 삼키면 "0/72 완주"라는 거짓 진도가 화면에 남는다.
    expect(plan).toMatch(/const \{ data, error \} = await supabase\s+\.from\('user_ref_progress'\)/);
    expect(plan).toContain('if (error) throw error;');
    expect(plan).toContain('진도를 불러오지 못했어요');
    expect(plan).not.toContain(').then(() => {}, () => {})');

    expect(session).toContain("const { error } = await supabase.from('writing_practice').insert(row)");
    expect(session).toContain("console.warn('[writing practice] history save failed:'");
    expect(session).not.toContain(').then(() => {}, () => {})');

    expect(materialAdd).toContain('const { error: pdfProgressError } = await supabase.from(\'uploaded_pdfs\')');
    expect(materialAdd).toContain('if (pdfProgressError) throw pdfProgressError');
    expect(materialAdd).toContain('자료는 저장됐지만 PDF 읽기 위치 동기화에 실패했어요.');
  });

  it('V-13 재감사: src/views 직접 await Supabase 조회가 error를 누락하지 않는다', () => {
    const viewDir = path.join(process.cwd(), 'src/views');
    const files = fs.readdirSync(viewDir)
      .filter(file => /\.(?:js|jsx)$/.test(file) && file !== 'AdminPage.jsx');
    const violations = [];

    for (const file of files) {
      const src = fs.readFileSync(path.join(viewDir, file), 'utf8');
      const destructured = /(?:const|let)\s+\{([^}]*)\}\s*=\s*await\s+supabase\s*\.from\s*\(/g;
      for (const match of src.matchAll(destructured)) {
        const errorField = match[1].match(/\berror\s*:\s*(\w+)/);
        const errorName = errorField?.[1] || (/\berror\b/.test(match[1]) ? 'error' : null);
        if (!errorName) {
          violations.push(`${file}: direct await omits error`);
          continue;
        }
        const nearby = src.slice(match.index + match[0].length, match.index + 900);
        if (!new RegExp(`\\b${errorName}\\b`).test(nearby)) {
          violations.push(`${file}: ${errorName} is destructured but unused`);
        }
      }

      const wholeResult = /const\s+(\w+)\s*=\s*await\s+supabase\s*\.from\s*\(/g;
      for (const match of src.matchAll(wholeResult)) {
        const nearby = src.slice(match.index, match.index + 900);
        if (!nearby.includes(`${match[1]}.error`)) {
          violations.push(`${file}: ${match[1]} result error unchecked`);
        }
      }
    }

    expect(violations).toEqual([]);

    const profile = read('src/views/ProfileStats.jsx');
    const pdfSection = read('src/views/MaterialAddPdfSection.jsx');
    expect(profile).toContain('if (heatmapResult.error) throw heatmapResult.error');
    expect(profile).toContain('if (vocabResult.error) throw vocabResult.error');
    expect(profile).toContain('학습 통계를 불러오지 못했어요.');
    expect(pdfSection).toContain('.then(({ count, error }) => {');
    expect(pdfSection).toContain('연결된 자료를 확인하지 못했습니다.');
  });
});
