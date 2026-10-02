import { fileURLToPath } from 'node:url';

const port = Number.parseInt(process.env.PLAYWRIGHT_PORT || '3100', 10);
// Next normalizes loopback middleware redirects to localhost. Keep the cookie origin
// identical before and after legacy/admin redirects so authenticated fixtures survive.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${port}`;
// Default to the lockfile's installed Chromium. Chrome/custom paths remain opt-in.
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
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
      ...(executablePath ? { executablePath } : browserChannel ? { channel: browserChannel } : {}),
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
