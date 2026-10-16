// Testes do sistema. Por padrão montam o site (Next.js, pasta acima) e testam em localhost:4173:
// o endereço principal entrega o sistema atual (public/legado.html) e /novo a base nova.
// Para testar um site que já está rodando, use SITE_URL=http://localhost:3000 npm test
const { defineConfig, devices } = require('@playwright/test');

const SITE_URL = process.env.SITE_URL;

module.exports = defineConfig({
  testDir: './casos',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: SITE_URL || 'http://localhost:4173',
    locale: 'pt-BR',
    timezoneId: 'America/Cuiaba',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'computador', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }
  ],
  webServer: SITE_URL ? undefined : {
    command: 'npm --prefix .. run build && npm --prefix .. run start -- -p 4173',
    url: 'http://localhost:4173/novo',
    timeout: 180000,
    reuseExistingServer: !process.env.CI,
    env: { NEXT_TELEMETRY_DISABLED: '1' }
  }
});
