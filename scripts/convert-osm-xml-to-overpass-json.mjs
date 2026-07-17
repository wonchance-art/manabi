import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function decodeXml(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function attributes(source) {
  const result = {};
  for (const match of source.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    result[match[1]] = decodeXml(match[2]);
  }
  return result;
}

function tags(body) {
  const result = {};
  for (const match of body.matchAll(/<tag\b([^>]*?)\s*\/>/g)) {
    const entry = attributes(match[1]);
    if (entry.k != null) result[entry.k] = entry.v ?? '';
  }
  return result;
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function convertOsmXml(xml) {
  const records = [];
  const nodes = new Map();
  const elementPattern = /<(node|way|relation)\b([^>]*?)(?:\s*\/>|>([\s\S]*?)<\/\1\s*>)/g;

  for (const match of xml.matchAll(elementPattern)) {
    const type = match[1];
    const attrs = attributes(match[2]);
    const body = match[3] ?? '';
    const id = Number(attrs.id);
    if (!Number.isSafeInteger(id)) throw new Error(`Invalid ${type} id: ${attrs.id}`);
    const record = { type, id, body, tags: tags(body) };
    if (type === 'node') {
      const lat = Number(attrs.lat);
      const lon = Number(attrs.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error(`Node ${id} is missing coordinates`);
      record.lat = lat;
      record.lon = lon;
      nodes.set(id, { lat, lon });
    } else if (type === 'way') {
      record.refs = [...body.matchAll(/<nd\b([^>]*?)\s*\/>/g)].map((entry) => {
        const ref = Number(attributes(entry[1]).ref);
        if (!Number.isSafeInteger(ref)) throw new Error(`Way ${id} has an invalid node reference`);
        return ref;
      });
    } else {
      record.members = [...body.matchAll(/<member\b([^>]*?)\s*\/>/g)].map((entry) => {
        const member = attributes(entry[1]);
        const ref = Number(member.ref);
        if (!['node', 'way', 'relation'].includes(member.type) || !Number.isSafeInteger(ref)) {
          throw new Error(`Relation ${id} has an invalid member`);
        }
        return { type: member.type, ref, role: member.role ?? '' };
      });
    }
    records.push(record);
  }

  const wayGeometry = new Map();
  for (const record of records) {
    if (record.type !== 'way') continue;
    const geometry = record.refs.map((ref) => {
      const point = nodes.get(ref);
      if (!point) throw new Error(`Way ${record.id} references missing node ${ref}`);
      return point;
    });
    wayGeometry.set(record.id, geometry);
  }

  const elements = records.map((record) => {
    const base = { type: record.type, id: record.id };
    if (record.type === 'node') {
      return { ...base, lat: record.lat, lon: record.lon, ...(Object.keys(record.tags).length ? { tags: record.tags } : {}) };
    }
    if (record.type === 'way') {
      return {
        ...base,
        nodes: record.refs,
        geometry: wayGeometry.get(record.id),
        ...(Object.keys(record.tags).length ? { tags: record.tags } : {}),
      };
    }
    return {
      ...base,
      members: record.members.map((member) => ({
        ...member,
        ...(member.type === 'way' && wayGeometry.has(member.ref)
          ? { geometry: wayGeometry.get(member.ref) }
          : {}),
      })),
      ...(Object.keys(record.tags).length ? { tags: record.tags } : {}),
    };
  });

  return { version: 0.6, generator: 'manabi-osm-xml-conversion-v1', elements };
}

function parseArgs(argv) {
  const read = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : null;
  };
  const input = read('--input');
  const output = read('--output');
  if (!input || !output) throw new Error('Usage: node scripts/convert-osm-xml-to-overpass-json.mjs --input <map.osm> --output <overpass.json>');
  return { input, output };
}

export function writeOverpassJson({ input, output }) {
  const xml = fs.readFileSync(input, 'utf8');
  const json = `${JSON.stringify(convertOsmXml(xml))}\n`;
  fs.writeFileSync(output, json);
  return {
    input: path.resolve(input),
    output: path.resolve(output),
    sourceSha256: hash(xml),
    outputSha256: hash(json),
    bytes: Buffer.byteLength(json),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(writeOverpassJson(parseArgs(process.argv.slice(2)))));
}
