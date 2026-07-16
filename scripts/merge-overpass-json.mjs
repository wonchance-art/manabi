import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPE_ORDER = Object.freeze({ node: 0, way: 1, relation: 2 });
const DOCUMENT_HEADER = Object.freeze({
  version: 0.6,
  generator: 'manabi deterministic Overpass partition merge v1',
  osm3s: Object.freeze({ copyright: 'The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.' }),
});
const RELEVANT_TAGS = Object.freeze([
  'building',
  'highway',
  'landuse',
  'leisure',
  'natural',
  'railway',
  'waterway',
]);

function sortElements(elements) {
  return elements.sort((a, b) => (
    (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99) || Number(a.id) - Number(b.id)
  ));
}

function geometryScore(element) {
  if (Array.isArray(element.geometry)) return element.geometry.length;
  if (Array.isArray(element.members)) {
    return element.members.reduce((sum, member) => sum + (Array.isArray(member.geometry) ? member.geometry.length : 0), 0);
  }
  return 0;
}

function compactGeometry(geometry) {
  if (!Array.isArray(geometry)) return undefined;
  return geometry.map(({ lat, lon }) => ({ lat, lon }));
}

function compactElement(element) {
  const compact = { type: element.type, id: element.id };
  if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
    compact.lat = element.lat;
    compact.lon = element.lon;
  }
  const tags = Object.fromEntries(RELEVANT_TAGS
    .filter((key) => element.tags?.[key] !== undefined)
    .map((key) => [key, element.tags[key]]));
  if (Object.keys(tags).length > 0) compact.tags = tags;
  const geometry = compactGeometry(element.geometry);
  if (geometry) compact.geometry = geometry;
  if (Array.isArray(element.members)) {
    compact.members = element.members.map((member) => {
      const compactMember = { type: member.type, ref: member.ref, role: member.role ?? '' };
      const memberGeometry = compactGeometry(member.geometry);
      if (memberGeometry) compactMember.geometry = memberGeometry;
      return compactMember;
    });
  }
  return compact;
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
      elements.set(key, canonicalCandidate(elements.get(key), compactElement(element)));
    }
  }
  return {
    ...DOCUMENT_HEADER,
    elements: sortElements([...elements.values()]),
  };
}

function writeMergedDocument(output, elements) {
  const descriptor = fs.openSync(output, 'w');
  try {
    const header = JSON.stringify(DOCUMENT_HEADER);
    fs.writeSync(descriptor, `${header.slice(0, -1)},"elements":[`);
    for (let index = 0; index < elements.length; index += 1) {
      if (index > 0) fs.writeSync(descriptor, ',');
      fs.writeSync(descriptor, JSON.stringify(elements[index]));
    }
    fs.writeSync(descriptor, ']}\n');
  } finally {
    fs.closeSync(descriptor);
  }
}

export function mergeOverpassFiles(inputs, output) {
  const elements = new Map();
  const sortedInputs = [...inputs].sort();
  for (const input of sortedInputs) {
    const document = JSON.parse(fs.readFileSync(input, 'utf8'));
    for (const element of document.elements ?? []) {
      const key = `${element.type}:${element.id}`;
      elements.set(key, canonicalCandidate(elements.get(key), compactElement(element)));
    }
  }
  const mergedElements = sortElements([...elements.values()]);
  writeMergedDocument(output, mergedElements);
  return { output, inputs: sortedInputs.length, elements: mergedElements.length, bytes: fs.statSync(output).size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex < 0 || !process.argv[outputIndex + 1] || outputIndex === 2) {
    throw new Error('Usage: node scripts/merge-overpass-json.mjs <input...> --output <output.json>');
  }
  console.log(JSON.stringify(mergeOverpassFiles(process.argv.slice(2, outputIndex), process.argv[outputIndex + 1])));
}
