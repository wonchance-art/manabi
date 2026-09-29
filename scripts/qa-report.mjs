// Publish only the generated synthetic summary, never credentials or auth state.
import fs from 'node:fs';
import path from 'node:path';
let summary = 'manabi 합성 검수 보고서가 없습니다. 검수 미실행/시작 실패 여부를 확인하세요.\n';
if (fs.existsSync('.qa/latest.json')) {
  const latest = JSON.parse(fs.readFileSync('.qa/latest.json'));
  const file = path.resolve(latest.report);
  if (!file.startsWith(path.resolve('.qa/runs') + path.sep)) throw Error('invalid_qa_report_path');
  summary = fs.readFileSync(path.join(path.dirname(file), 'summary.md'), 'utf8');
}
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
