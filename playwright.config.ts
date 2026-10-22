import {defineConfig,devices} from "@playwright/test";

export default defineConfig({
  testDir:"./apps/web/e2e",
  timeout:45_000,
  expect:{timeout:20_000},
  workers:process.env.CI?1:undefined,
  retries:process.env.CI?1:0,
  reporter:process.env.CI?"github":"list",
  use:{
    ...devices["Desktop Chrome"],
    baseURL:"http://127.0.0.1:3000",
    trace:"retain-on-failure",
  },
  webServer:{
    command:"npm run start --workspace @mossline/web -- -p 3000",
    url:"http://127.0.0.1:3000",
    reuseExistingServer:!process.env.CI,
    timeout:90_000
  }
});
