// Stage only synthetic evidence. Never follow fixture dependency links.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function stageQaArtifacts(source, destination) {
  let files = 0, bytes = 0;
  if (!fs.existsSync(source)) return { files, bytes };
  if (!fs.lstatSync(source).isDirectory()) throw Error('qa_evidence_source_must_be_directory');
  const visit = (directory, relative = '') => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
      const from = path.join(directory, entry.name), next = path.join(relative, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', 'assets'].includes(entry.name)) visit(from, next);
      } else if (entry.isFile() && /\.(json|md|log|png|zip)$/.test(entry.name)) {
        const to = path.join(destination, next);
        fs.mkdirSync(path.dirname(to), { recursive: true });fs.copyFileSync(from, to);
        files++;bytes += fs.statSync(from).size;
      }
    }
  };
  visit(source);
  return { files, bytes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(stageQaArtifacts('.qa/runs', '.qa/evidence')));
}
