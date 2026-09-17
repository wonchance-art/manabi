import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { validateEvidence } from './qa-profiles.mjs';

export const digest = value => crypto.createHash('sha256').update(value).digest('hex');
export function relevantFile(file) {
  if (file === 'public/pdf.worker.min.mjs') return false; // derived from the pinned pdfjs-dist package
  return /^(src|public|scripts|e2e|supabase)\//.test(file)
    || /^(package(-lock)?\.json|.*config\.[cm]?[jt]s|\.github\/workflows\/)/.test(file);
}
export function sourceFingerprint(cwd) {
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd }).toString().split('\0').filter(Boolean);
  const hash = crypto.createHash('sha256');
  for (const file of [...new Set(files)].filter(relevantFile).sort()) {
    // Even an accidentally tracked credential file must never be read by QA.
    if (/(^|\/)\.env(?:\.|$)/.test(file)) continue;
    const target = path.join(cwd, file);
    hash.update(file + '\0');
    let bytes = fs.existsSync(target) ? fs.readFileSync(target) : Buffer.from('<deleted>');
    if (file === 'public/sw.js') bytes = Buffer.from(bytes.toString().replace(/^const CACHE_NAME = ['"`][^'"`]+['"`];/m, 'const CACHE_NAME = "CONTENT_HASH";'));
    hash.update(bytes);hash.update('\0');
  }
  hash.update(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch }));
  return hash.digest('hex');
}
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp';fs.writeFileSync(temporary, JSON.stringify(value, null, 2));fs.renameSync(temporary, file);
}
export function resumeStep(step, old, fingerprint, root) {
  if (!old || old.fingerprint !== fingerprint || !['passed', 'failed'].includes(old.status)) return null;
  const item = old.steps.find(item => item.id === step.id && item.status === 'passed');
  if (!item || item.exitCode !== 0 || !item.reportPath || !item.reportHash) return null;
  const file = path.resolve(root, item.reportPath);
  if (!file.startsWith(path.resolve(root, '.qa/runs') + path.sep)) return null;
  try {
    const bytes = fs.readFileSync(file);
    if (digest(bytes) !== item.reportHash) return null;
    const report = JSON.parse(bytes);validateEvidence(step, report, item.exitCode);
    return item;
  } catch { return null; }
}
export function reportMarkdown(report) {
  return [`# manabi 검수 · ${report.profile}`, '',
    `결과: **${report.status}** · 기준 커밋: \`${report.head}\`${report.dirty ? ' · 미커밋 변경 포함(입력 지문 참조)' : ''}`,
    `생성: ${new Date(report.finishedAt || report.startedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })} KST`, '',
    '| 검사 | 결과 | 증거 |', '|---|---|---|',
    ...report.steps.map(step => `| ${step.id} | ${step.status}${step.reused ? ' (동일 입력 증거 재사용)' : ''} | ${step.evidence} |`), '',
    '합성 인증·HTTP와 로컬 PostgreSQL/UI 검수입니다. 실제 사용자 로그인·실제 AI 정확도·물리 iPad/Pencil·운영 배포 완료를 의미하지 않습니다.', '',
    ...(report.failure ? [`실패: ${report.failure}`, ''] : []),
  ].join('\n');
}
