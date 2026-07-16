import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPE_ORDER = Object.freeze({ node: 0, way: 1, relation: 2 });

function geometryScore(element) {
  if (Array.isArray(element.geometry)) return element.geometry.length;
  if (Array.isArray(element.members)) {
    return element.members.reduce((sum, member) => sum + (Array.isArray(member.geometry) ? member.geometry.length : 0), 0);
  }
  return 0;
}

function canonicalCandidate(current, candidate) {
  if (!current) return candidate;
  const currentScore = geometryScore(current);
  const candidateScore = geometryScore(candidate);
  if (candidateScore !== currentScore) return candidateScore > currentScore ? candidate : current;
  const currentText = JSON.stringify(current);
  const candidateText = JSON.stringify(candidate);
  if (candidateText.length !== currentText.length) return candidateText.length > currentText.length ? candidate : current;
  return candidateText < currentText ? candidate : current;
}

export function mergeOverpassDocuments(documents) {
  const elements = new Map();
  for (const document of documents) {
    for (const element of document.elements ?? []) {
      const key = `${element.type}:${element.id}`;
      elements.set(key, canonicalCandidate(elements.get(key), element));
    }
  }
  return {
    version: 0.6,
    generator: 'manabi deterministic Overpass partition merge v1',
    osm3s: Object.freeze({ copyright: 'The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.' }),
    elements: [...elements.values()].sort((a, b) => (
      (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99) || Number(a.id) - Number(b.id)
    )),
  };
}

export function mergeOverpassFiles(inputs, output) {
  const elements = new Map();
  const sortedInputs = [...inputs].sort();
  for (const input of sortedInputs) {
    const document = JSON.parse(fs.readFileSync(input, 'utf8'));
    for (const element of document.elements ?? []) {
      const key = `${element.type}:${element.id}`;
      elements.set(key, canonicalCandidate(elements.get(key), element));
    }
  }
  const merged = mergeOverpassDocuments([{ elements: [...elements.values()] }]);
  fs.writeFileSync(output, `${JSON.stringify(merged)}\n`);
  return { output, inputs: sortedInputs.length, elements: merged.elements.length, bytes: fs.statSync(output).size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex < 0 || !process.argv[outputIndex + 1] || outputIndex === 2) {
    throw new Error('Usage: node scripts/merge-overpass-json.mjs <input...> --output <output.json>');
  }
  console.log(JSON.stringify(mergeOverpassFiles(process.argv.slice(2, outputIndex), process.argv[outputIndex + 1])));
}
