import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Loopback only (SC2): the test server binds 127.0.0.1 on a dedicated port, and no run, local or
// CI, reuses a server that happens to be running.
// The port is PW_PORT, else derived from the repo path, so parallel worktrees do not collide.
const root = path.dirname(fileURLToPath(import.meta.url));
let hash = 0;
for (const char of root) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
const PORT = process.env.PW_PORT ? Number(process.env.PW_PORT) : 8700 + (hash % 200);

export default defineConfig({
  testDir: 'tests/browser',
  testMatch: '*.spec.mjs',
  reporter: 'list',
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    // Never attach to a server already on the port (it could serve another worktree): a busy
    // port fails loudly.
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'ignore',
  },
});
