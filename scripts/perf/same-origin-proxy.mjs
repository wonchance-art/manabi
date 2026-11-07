#!/usr/bin/env node
// 같은 출처 앞단 — 첫 그림(FCP · LCP) A/B를 재는 유일한 방법(PERF-AB-001, 2026-11-07 KST). 설명 · 함정: docs/perf-measurement.md.
//
// 브라우저가 운영 주소(https://www.manabi.co.kr)를 그대로 열되, 연결은 이 로컬 HTTPS 서버로 온다(크로미엄 --host-resolver-rules).
// 서버는 요청을 운영으로 넘기고, 고른 팔(arm)만 HTML · Link 머리글 · 파일 몇 개를 바꿔 돌려준다. 바꾼 바이트도 진짜 네트워크
// 응답이라 DevTools 대역 제한을 그대로 탄다 — Playwright route.fulfill로 채운 응답은 대역 제한을 타지 않아 FCP 비용이 사라진다
// (VOCAB-GUEST-CLS-001 실측: fulfill로 잰 FCP 1.94s가 실제로는 +0.26s 늦었다).
//
//   NODE_USE_ENV_PROXY=1 node scripts/perf/same-origin-proxy.mjs --arms ./my-arms.mjs [--port 18443] [--origin https://www.manabi.co.kr]
//
// 팔 파일(ESM): export default { A: {}, B: { html: (html) => html.replace(…), link: (value) => value, files: { '/x.woff2': '/abs/x.woff2' } } }
// 팔 바꾸기: GET https://127.0.0.1:<port>/__arm/<이름> (first-paint-ab.mjs가 판마다 부른다).
// 모든 팔이 같은 앞단 · 같은 연결 조건(HTTP/2 · br 재압축 · 정적 자산 메모리 캐시)을 지나므로 팔 사이 비교만 뜻이 있다(절대값은 운영과 조금 다르다).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http2 from 'node:http2';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

// HTTP/2에서 금지된 연결 머리글과, 다시 압축 · 길이를 정하는 머리글은 넘기지 않는다.
const HOP = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'keep-alive', 'upgrade', 'proxy-connection', 'te', 'strict-transport-security', 'alt-svc']);
const TEXT = /text|javascript|json|css|x-component|svg|xml/;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

/** 자체 서명 인증서(브라우저는 --ignore-certificate-errors로 연다). */
function certificate() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manabi-perf-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${dir}/key.pem`, '-out', `${dir}/cert.pem`, '-days', '2', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  return { key: fs.readFileSync(`${dir}/key.pem`), cert: fs.readFileSync(`${dir}/cert.pem`) };
}

export async function startProxy({ origin = 'https://www.manabi.co.kr', port = 18443, arms = { A: {} } } = {}) {
  let current = Object.keys(arms)[0];
  const cache = new Map(); // 정적 자산(HTML 아닌 200 응답) — 판마다 운영을 다시 부르지 않게
  // HTTP/2(ALPN, 1.1도 받음) — 운영처럼 한 연결에 여러 요청을 싣는다. HTTP/1.1 앞단은 연결 6개 제한 때문에 next/font의 Manrope가
  // 늦게 와 운영에 없는 이동(단추 줄 0.0172)이 생겼다(VOCAB-SUBSET-SMALL-001 실측).
  const server = http2.createSecureServer({ ...certificate(), allowHTTP1: true }, async (req, res) => {
    try {
      if (req.url.startsWith('/__arm/')) {
        const next = decodeURIComponent(req.url.slice(7));
        if (!arms[next]) { res.writeHead(404); res.end(`모르는 팔: ${next}`); return; }
        current = next; res.end(`arm ${current}`); return;
      }
      const arm = arms[current] || {};
      const pathname = req.url.split('?')[0];
      if (arm.files?.[pathname]) {
        res.writeHead(200, { 'content-type': arm.contentType?.[pathname] || 'font/woff2', 'cache-control': 'public, max-age=31536000, immutable' });
        res.end(fs.readFileSync(arm.files[pathname]));
        return;
      }
      if (arm.block?.test(pathname)) { res.writeHead(404, { 'cache-control': 'no-store' }); res.end(); return; }
      const accept = String(req.headers.accept || '');
      const isDocument = req.headers['sec-fetch-dest'] === 'document' || accept.includes('text/html');
      let hit = !isDocument && cache.get(req.url);
      if (!hit) {
        const r = await fetch(origin + req.url, { headers: { 'user-agent': req.headers['user-agent'] || 'manabi-perf', accept: accept || '*/*', 'accept-language': 'ko' }, redirect: 'manual' });
        const headers = {}; r.headers.forEach((v, k) => { if (!HOP.has(k)) headers[k] = v; });
        hit = { status: r.status, headers, body: Buffer.from(await r.arrayBuffer()) };
        if (!isDocument && r.status === 200) cache.set(req.url, hit);
      }
      let { status, body } = hit;
      // 문서만 no-store로 — 정적 자산까지 no-store면 브라우저가 미리 받은(preload) 응답을 다시 쓰지 않고 글꼴을 또 받는다(실측: /vocab 글꼴이
      // 4.1s에 다시 와서 운영에 없는 이동이 생겼다). 판마다 새 브라우저 맥락이라 자산 캐시가 판을 넘지 않는다.
      const headers = isDocument ? { ...hit.headers, 'cache-control': 'no-store' } : { ...hit.headers };
      if (isDocument) {
        if (arm.html) body = Buffer.from(arm.html(body.toString('utf8')));
        if (arm.link && headers.link) headers.link = arm.link(headers.link);
      }
      // 운영처럼 압축해서 보낸다 — 압축 없이 보내면 CSS · JS가 몇 배로 커져 FCP가 7초대로 밀린다(실측).
      if (TEXT.test(String(headers['content-type'] || '')) && body.length > 512) {
        const key = '__br';
        const enc = !isDocument && hit[key] ? hit[key] : zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } });
        if (!isDocument) hit[key] = enc;
        body = enc; headers['content-encoding'] = 'br';
      }
      res.writeHead(status, headers); res.end(body);
    } catch (error) {
      res.writeHead(502); res.end(String(error));
    }
  });
  await new Promise((ok) => server.listen(port, '127.0.0.1', ok));
  return { server, port, origin, arms: Object.keys(arms) };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (process.env.NODE_USE_ENV_PROXY !== '1' && (process.env.HTTPS_PROXY || process.env.https_proxy)) {
    process.stderr.write('HTTPS_PROXY가 있는 환경이면 NODE_USE_ENV_PROXY=1로 띄운다(운영으로 넘기는 fetch가 프록시를 타야 한다).\n');
  }
  const armsFile = arg('arms');
  const arms = armsFile ? (await import(pathToFileURL(path.resolve(armsFile)).href)).default : { A: {} };
  const { port } = await startProxy({ origin: arg('origin', 'https://www.manabi.co.kr'), port: Number(arg('port', 18443)), arms });
  process.stdout.write(`같은 출처 앞단: 127.0.0.1:${port} · 팔 ${Object.keys(arms).join(', ')}\n`);
}
