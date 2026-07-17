import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPE_ORDER = Object.freeze({ node: 0, way: 1, relation: 2 });

function decodeXml(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function attributes(source) {
  const result = {};
  for (const match of source.matchAll(/([\w:-]+)="([^"]*)"/g)) result[match[1]] = decodeXml(match[2]);
  return result;
}

function tags(body = '') {
  return Object.fromEntries([...body.matchAll(/<tag\s+([^>]*?)\s*\/>/g)].map((match) => {
    const tag = attributes(match[1]);
    return [tag.k, tag.v];
  }).filter(([key]) => key));
}

function elementBlocks(xml, type) {
  return [...xml.matchAll(new RegExp(`<${type}\\s+([^>]*?)(?:\\s*\\/>|>([\\s\\S]*?)<\\/${type}>)`, 'g'))];
}

export function convertOsmXmlToOverpass(xml) {
  const nodes = new Map();
  const taggedNodes = [];
  for (const match of elementBlocks(xml, 'node')) {
    const attr = attributes(match[1]);
    const point = { lat: Number(attr.lat), lon: Number(attr.lon) };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    nodes.set(Number(attr.id), point);
    const nodeTags = tags(match[2]);
    if (Object.keys(nodeTags).length > 0) taggedNodes.push({
      type: 'node', id: Number(attr.id), ...point, tags: nodeTags,
    });
  }

  const ways = new Map();
  for (const match of elementBlocks(xml, 'way')) {
    const attr = attributes(match[1]);
    const body = match[2] ?? '';
    const geometry = [...body.matchAll(/<nd\s+([^>]*?)\s*\/>/g)]
      .map((nodeMatch) => nodes.get(Number(attributes(nodeMatch[1]).ref)))
      .filter(Boolean);
    const wayTags = tags(body);
    ways.set(Number(attr.id), {
      type: 'way', id: Number(attr.id), ...(Object.keys(wayTags).length ? { tags: wayTags } : {}), geometry,
    });
  }

  const relations = [];
  for (const match of elementBlocks(xml, 'relation')) {
    const attr = attributes(match[1]);
    const body = match[2] ?? '';
    const relationTags = tags(body);
    const members = [...body.matchAll(/<member\s+([^>]*?)\s*\/>/g)].map((memberMatch) => {
      const member = attributes(memberMatch[1]);
      const referencedWay = member.type === 'way' ? ways.get(Number(member.ref)) : null;
      return {
        type: member.type,
        ref: Number(member.ref),
        role: member.role ?? '',
        ...(referencedWay?.geometry?.length ? { geometry: referencedWay.geometry } : {}),
      };
    });
    relations.push({
      type: 'relation', id: Number(attr.id), ...(Object.keys(relationTags).length ? { tags: relationTags } : {}), members,
    });
  }

  const elements = [
    ...taggedNodes,
    ...[...ways.values()].filter((way) => way.tags),
    ...relations.filter((relation) => relation.tags),
  ].sort((left, right) => (
    TYPE_ORDER[left.type] - TYPE_ORDER[right.type] || left.id - right.id
  ));
  return {
    version: 0.6,
    generator: 'manabi deterministic OSM XML conversion v1',
    osm3s: { copyright: 'OpenStreetMap contributors, ODbL 1.0' },
    elements,
  };
}

export function convertOsmXmlFile(input, output) {
  const document = convertOsmXmlToOverpass(fs.readFileSync(input, 'utf8'));
  fs.writeFileSync(output, `${JSON.stringify(document)}\n`);
  return { output, elements: document.elements.length, bytes: fs.statSync(output).size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: node scripts/convert-osm-xml-to-overpass.mjs <input.osm> <output.json>');
  console.log(JSON.stringify(convertOsmXmlFile(input, output)));
}
