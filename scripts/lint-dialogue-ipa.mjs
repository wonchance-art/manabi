#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const TRACK_NAMES = ['chinese', 'english', 'french', 'japanese'];

function skipQuoted(source, start, quote) {
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === quote) {
      return index + 1;
    }
  }
  return source.length;
}

function skipTrivia(source, start) {
  let index = start;
  while (index < source.length) {
    if (/\s/u.test(source[index])) {
      index += 1;
    } else if (source[index] === '/' && source[index + 1] === '/') {
      const newline = source.indexOf('\n', index + 2);
      index = newline === -1 ? source.length : newline + 1;
    } else if (source[index] === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
    } else {
      break;
    }
  }
  return index;
}

function findObjectRanges(source) {
  const ranges = [];
  const stack = [];
  const issues = [];

  for (let index = 0; index < source.length;) {
    const char = source[index];
    if (char === '"' || char === "'" || char === '`') {
      index = skipQuoted(source, index, char);
      continue;
    }
    if (char === '/' && source[index + 1] === '/') {
      const newline = source.indexOf('\n', index + 2);
      index = newline === -1 ? source.length : newline + 1;
      continue;
    }
    if (char === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      if (end === -1) {
        issues.push('unterminated block comment');
        break;
      }
      index = end + 2;
      continue;
    }
    if (char === '{') {
      stack.push(index);
    } else if (char === '}') {
      const start = stack.pop();
      if (start === undefined) {
        issues.push(`unmatched closing brace at offset ${index}`);
      } else {
        ranges.push({ start, end: index });
      }
    }
    index += 1;
  }

  for (const start of stack) issues.push(`unmatched opening brace at offset ${start}`);
  return { ranges, issues };
}

function topLevelProperties(source, start, end) {
  const properties = new Map();
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;

  for (let index = start + 1; index < end;) {
    const char = source[index];
    if (char === '/' && source[index + 1] === '/') {
      const newline = source.indexOf('\n', index + 2);
      index = newline === -1 ? end : Math.min(newline + 1, end);
      continue;
    }
    if (char === '/' && source[index + 1] === '*') {
      const commentEnd = source.indexOf('*/', index + 2);
      index = commentEnd === -1 ? end : Math.min(commentEnd + 2, end);
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      const tokenEnd = Math.min(skipQuoted(source, index, char), end);
      if (braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
        const next = skipTrivia(source, tokenEnd);
        if (source[next] === ':') {
          const rawKey = source.slice(index + 1, tokenEnd - 1);
          if (rawKey === 'speaker' || rawKey === 'ipa') properties.set(rawKey, index);
        }
      }
      index = tokenEnd;
      continue;
    }
    if (char === '{') {
      braceDepth += 1;
      index += 1;
      continue;
    }
    if (char === '}') {
      braceDepth -= 1;
      index += 1;
      continue;
    }
    if (char === '[') {
      bracketDepth += 1;
      index += 1;
      continue;
    }
    if (char === ']') {
      bracketDepth -= 1;
      index += 1;
      continue;
    }
    if (char === '(') {
      parenDepth += 1;
      index += 1;
      continue;
    }
    if (char === ')') {
      parenDepth -= 1;
      index += 1;
      continue;
    }
    if (
      braceDepth === 0
      && bracketDepth === 0
      && parenDepth === 0
      && /[A-Za-z_$]/u.test(char)
    ) {
      let tokenEnd = index + 1;
      while (tokenEnd < end && /[A-Za-z0-9_$]/u.test(source[tokenEnd])) tokenEnd += 1;
      const key = source.slice(index, tokenEnd);
      const next = skipTrivia(source, tokenEnd);
      if ((key === 'speaker' || key === 'ipa') && source[next] === ':') {
        properties.set(key, index);
      }
      index = tokenEnd;
      continue;
    }
    index += 1;
  }

  return properties;
}

function lineNumberAt(lineStarts, offset) {
  let low = 0;
  let high = lineStarts.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (lineStarts[middle] <= offset) low = middle;
    else high = middle;
  }
  return low + 1;
}

export function scanDialogueIpaSource(source, file = '<source>') {
  const lineStarts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') lineStarts.push(index + 1);
  }

  const { ranges, issues } = findObjectRanges(source);
  const missing = [];
  let speakerObjects = 0;

  for (const { start, end } of ranges) {
    const properties = topLevelProperties(source, start, end);
    const speakerOffset = properties.get('speaker');
    if (speakerOffset === undefined) continue;
    speakerObjects += 1;
    if (!properties.has('ipa')) {
      missing.push({
        file,
        line: lineNumberAt(lineStarts, speakerOffset),
      });
    }
  }

  missing.sort((left, right) => left.line - right.line);
  return {
    file,
    speakerObjects,
    missing,
    issues: issues.map((message) => `${file}: ${message}`),
  };
}

async function listJavaScriptFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listJavaScriptFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
  }
  return files;
}

export async function runDialogueIpaLint({
  repoRoot = REPO_ROOT,
  tracks = TRACK_NAMES,
} = {}) {
  const reports = [];
  const issues = [];

  for (const track of [...tracks].sort()) {
    const grammarDirectory = path.join(repoRoot, 'src', 'content', track, 'grammar');
    let files;
    try {
      files = await listJavaScriptFiles(grammarDirectory);
    } catch (error) {
      issues.push(`${track}: grammar directory read failed (${error.message})`);
      reports.push({ track, speakerObjects: 0, missing: 0, files: [] });
      continue;
    }

    const fileReports = [];
    let speakerObjects = 0;
    let missing = 0;
    for (const fullPath of files) {
      const relativePath = path.relative(repoRoot, fullPath).split(path.sep).join('/');
      try {
        const result = scanDialogueIpaSource(await fs.readFile(fullPath, 'utf8'), relativePath);
        speakerObjects += result.speakerObjects;
        missing += result.missing.length;
        issues.push(...result.issues);
        if (result.missing.length > 0) fileReports.push(result);
      } catch (error) {
        issues.push(`${relativePath}: read/scan failed (${error.message})`);
      }
    }
    reports.push({ track, speakerObjects, missing, files: fileReports });
  }

  return { reports, issues };
}

export function formatDialogueIpaReport({ reports, issues }) {
  const lines = ['dialogue IPA coverage (report-only)'];
  let totalSpeakerObjects = 0;
  let totalMissing = 0;

  for (const report of reports) {
    totalSpeakerObjects += report.speakerObjects;
    totalMissing += report.missing;
    lines.push(`${report.track}: ${report.missing} missing / ${report.speakerObjects} speaker objects`);
    for (const fileReport of report.files) {
      lines.push(
        `  ${fileReport.file}: ${fileReport.missing.length} missing (lines ${fileReport.missing.map((item) => item.line).join(', ')})`,
      );
    }
  }
  for (const issue of issues) lines.push(`  warn: ${issue}`);
  lines.push(
    `summary: ${reports.length} tracks, ${totalMissing} missing / ${totalSpeakerObjects} speaker objects, ${issues.length} scan warnings`,
  );
  return lines.join('\n');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  try {
    console.log(formatDialogueIpaReport(await runDialogueIpaLint()));
  } catch (error) {
    console.warn(`dialogue IPA coverage scan failed (report-only): ${error.message}`);
  }
  process.exitCode = 0;
}
