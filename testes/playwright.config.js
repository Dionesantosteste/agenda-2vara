// Testes do sistema. Por padrão testam o index.html deste repositório (servido em localhost:4173).
// Para testar outro endereço (ex.: o sistema novo), use SITE_URL=http://localhost:3000 npm test
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
    command: 'node apoio/servidor.js',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI
  }
});
