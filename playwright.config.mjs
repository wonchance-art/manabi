import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const port = Number.parseInt(process.env.PLAYWRIGHT_PORT || '3100', 10);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'chrome';
const localChromiumPath = '/opt/pw-browsers/chromium';
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH
  || (existsSync(localChromiumPath) ? localChromiumPath : null);
const serverFetchMock = new URL('./e2e/server-fetch-mock.mjs', import.meta.url).href;
const nodeOptions = [process.env.NODE_OPTIONS, `--import="${serverFetchMock}"`]
  .filter(Boolean)
  .join(' ');

export default Object.freeze({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL,
    launchOptions: {
      headless: true,
      args: ['--enable-precise-memory-info'],
      ...(executablePath ? { executablePath } : { channel: browserChannel }),
    },
  },
  webServer: {
    command: 'npm',
    args: ['run', 'start', '--', '--hostname', '127.0.0.1', '--port', String(port)],
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    url: `${baseURL}/manifest.webmanifest`,
    timeout: 30000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://e2e.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'e2e-anon-key',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || baseURL,
      NODE_OPTIONS: nodeOptions,
    },
  },
});
