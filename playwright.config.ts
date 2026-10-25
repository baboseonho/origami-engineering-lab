import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:5297',
    viewport: { width: 1600, height: 950 },
    // the tests read the Korean interface; English is checked by its own test
    locale: 'ko-KR',
    launchOptions: { args: ['--use-gl=angle', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'npx vite --port 5297 --strictPort',
    url: 'http://localhost:5297',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
