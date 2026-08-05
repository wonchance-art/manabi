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

  it('V-07 LearnPage: 조회 오류를 빈 상태로 바꾸지 않고 absent/ready 문구를 분리한다', () => {
    const src = read('src/views/LearnPage.jsx');
    expect(src).toContain('if (error) throw error');
    expect(src).toContain('if (latestUsedResult.error) throw latestUsedResult.error');
    expect(src).toContain("episodeState: episode == null ? 'absent' : 'ready'");
    expect(src).toContain('if (error) return (');
    expect(src).not.toContain('이야기 한 편이 준비됐어요');
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
    expect(src.indexOf(') : materialsError ? (')).toBeLessThan(src.indexOf(') : filtered.length > 0 ? ('));
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
    expect(src.match(/onClick=\{\(\) => saveInlineVocabulary\(t\)\}/g)).toHaveLength(2);
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
});
