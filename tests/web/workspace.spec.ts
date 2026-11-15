import { test, expect, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const fixture = JSON.parse(readFileSync('.test-data/web-fixture.json', 'utf8'));
async function login(page: Page, username: string, password: string) {
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeVisible();
}
async function navigate(
  page: Page,
  label: string,
  title = label,
  mobile = false,
) {
  if (mobile) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page
      .getByRole('dialog', { name: 'Navigation', exact: true })
      .getByRole('link', { name: label, exact: true })
      .click();
  } else
    await page
      .getByRole('navigation', { name: 'Primary navigation', exact: true })
      .getByRole('link', { name: label, exact: true })
      .click();
  await expect(
    page.getByRole('heading', { name: title, exact: true, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true }),
  ).toBeVisible();
}
test('complete workspace: routes, forms, reviews, projections, access, mobile navigation and privacy', async ({
  page,
  browser,
}, testInfo) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  await login(
    page,
    process.env.AUTH_BOOTSTRAP_USERNAME || 'commander',
    process.env.AUTH_BOOTSTRAP_PASSWORD!,
  );
  await expect(
    page.getByRole('heading', {
      name: 'Mission Control',
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await expect(page.locator('.mission-hero')).toBeVisible();
  if (process.env.E2E_SCREENSHOT_DIR) {
    mkdirSync(process.env.E2E_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(process.env.E2E_SCREENSHOT_DIR, 'workspace-desktop.png'),
      fullPage: true,
    });
  }
  await navigate(page, 'Crew Overview');
  await page.getByLabel('Search crew').fill(fixture.crewName);
  await page.getByRole('link', { name: fixture.crewName, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Crew Profile', exact: true, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: fixture.crewName, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Breadcrumb' }),
  ).toContainText('Crew Profile');
  const headZone = page.getByRole('button', { name: /^Head & eyes\. Risk:/ });
  await headZone.focus();
  await page.keyboard.press('ArrowRight');
  const chestZone = page.getByRole('button', {
    name: /^Chest & cardiovascular\. Risk:/,
  });
  await expect(chestZone).toBeFocused();
  await expect(chestZone).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('End');
  await expect(
    page.getByRole('button', { name: /^Whole body & immune\. Risk:/ }),
  ).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await navigate(page, 'Daily Health Check');
  await page
    .getByLabel('Crew member', { exact: true })
    .selectOption(fixture.crewId);
  for (const [name, value] of [
    ['Mood', '8'],
    ['Stress', '3'],
    ['Fatigue', '4'],
    ['Sleep in the last 24 hours', '7.5'],
  ])
    await page.getByLabel(name, { exact: true }).fill(value);
  await page
    .getByLabel('Notes', { exact: true })
    .fill('Synthetic end-to-end daily report.');
  await page
    .getByRole('button', { name: 'Review daily check', exact: true })
    .click();
  let dialog = page.getByRole('dialog', {
    name: 'Review daily health check',
    exact: true,
  });
  await expect(dialog).toContainText(fixture.crewName);
  await dialog
    .getByRole('button', { name: 'Confirm and save', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: `Daily report saved for ${fixture.crewName}`,
      exact: true,
    }),
  ).toBeVisible();
  await navigate(page, 'Alerts');
  await page.getByLabel('Severity', { exact: true }).selectOption('ATTENTION');
  let row = page.getByRole('row').filter({ hasText: fixture.alertTitle });
  await row.getByRole('button', { name: 'Review warning' }).click();
  dialog = page.getByRole('dialog', { name: 'Warning review', exact: true });
  await dialog
    .getByLabel('Review note', { exact: true })
    .fill('Synthetic warning reviewed by browser test.');
  await dialog
    .getByRole('button', { name: 'Acknowledge warning', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel('Warning status', { exact: true }).selectOption('true');
  row = page.getByRole('row').filter({ hasText: fixture.alertTitle });
  await expect(row.getByRole('button', { name: 'View review' })).toBeVisible();
  await navigate(page, 'Countermeasure Protocols');
  const readButton = page
    .getByRole('button', { name: 'Read protocol →' })
    .first();
  await readButton.click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('listitem').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(readButton).toBeFocused();
  await page.route('**/api/v1/protocols?**', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 500,
        error: 'Internal Server Error',
        message: ['Synthetic API unavailable'],
        timestamp: new Date().toISOString(),
      }),
    }),
  );
  await page
    .getByLabel('Hazard category', { exact: true })
    .selectOption('SPACE_RADIATION');
  await expect(
    page.getByText('Synthetic API unavailable', { exact: true }),
  ).toBeVisible();
  await page.unroute('**/api/v1/protocols?**');
  await page.route('**/api/v1/protocols?**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'text/html',
      body: '<h1>Proxy unavailable</h1>',
    }),
  );
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(
    page.getByText('Unable to reach the AURA API.', { exact: true }),
  ).toBeVisible();
  await page.unroute('**/api/v1/protocols?**');
  await page.route('**/api/v1/protocols?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0, offset: 0, limit: 12 }),
    }),
  );
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'No protocols in this category',
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute('**/api/v1/protocols?**');
  await page.getByRole('button', { name: 'Refresh library' }).click();
  await expect(
    page.getByRole('button', { name: 'Read protocol →' }).first(),
  ).toBeVisible();
  await navigate(page, 'Mission Risk Simulator');
  await page
    .getByLabel('Crew member', { exact: true })
    .selectOption(fixture.crewId);
  await page
    .getByLabel('Assumed source', { exact: true })
    .selectOption('DIAGNOSTIC_DEVICE');
  await page
    .getByLabel('intraocularPressure (mmHg)', { exact: true })
    .fill('112');
  await page
    .getByRole('button', { name: 'Run baseline projection', exact: true })
    .click();
  const result = page.locator('section').filter({
    has: page.getByRole('heading', {
      name: 'Simulation result',
      exact: true,
    }),
  });
  await expect(
    result.getByRole('cell', { name: 'CRITICAL', exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(result).toContainText(
    'No measurements, clinical alerts or crew status were changed.',
  );
  await navigate(page, 'Settings / Access');
  await page
    .getByLabel('New username', { exact: true })
    .fill(fixture.createdUsername);
  await page
    .getByLabel('Initial password', { exact: true })
    .fill(`ui-created-${fixture.suffix}-password`);
  await page
    .getByLabel('Linked crew profile', { exact: true })
    .selectOption(fixture.crewId);
  await page
    .getByRole('button', { name: 'Review account', exact: true })
    .click();
  dialog = page.getByRole('dialog', {
    name: 'Confirm mission access',
    exact: true,
  });
  await expect(dialog).not.toContainText(
    `ui-created-${fixture.suffix}-password`,
  );
  await dialog
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page.locator('.success-panel')).toContainText(
    fixture.createdUsername,
  );
  await page
    .getByRole('button', { name: 'Notifications', exact: true })
    .click();
  dialog = page.getByRole('dialog', { name: 'Notifications', exact: true });
  await expect(
    dialog.getByRole('heading', { name: 'Recent activity', exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const label of [
    'Mission Control',
    'Crew Overview',
    'Daily Health Check',
    'Alerts',
    'Mission Risk Simulator',
    'Countermeasure Protocols',
    'Settings / Access',
  ]) {
    await navigate(page, label, label, true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `${label} mobile overflow`,
    ).toBe(true);
  }
  await navigate(page, 'Mission Control', 'Mission Control', true);
  if (process.env.E2E_SCREENSHOT_DIR)
    await page.screenshot({
      path: path.join(process.env.E2E_SCREENSHOT_DIR, 'workspace-mobile.png'),
      fullPage: true,
    });

  const memberContext = await browser.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    viewport: { width: 1440, height: 1000 },
  });
  const member = await memberContext.newPage();
  member.on('pageerror', (error) => pageErrors.push(error.message));
  await member.goto('/crew');
  await login(member, fixture.crewUsername, fixture.crewPassword);
  await expect(member.getByRole('row')).toHaveCount(2); // Header plus own profile only.
  await member
    .getByRole('link', { name: fixture.crewName, exact: true })
    .click();
  await expect(
    member.getByRole('heading', { name: fixture.crewName, exact: true }),
  ).toBeVisible();
  await expect(
    member.getByRole('heading', {
      name: 'Medical operator tools',
      exact: true,
    }),
  ).toHaveCount(0);
  await navigate(member, 'Mission Risk Simulator');
  await expect(
    member.getByText(
      'Simulation runs require Commander or Medical Officer access.',
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    member.getByRole('button', {
      name: 'Run baseline projection',
      exact: true,
    }),
  ).toHaveCount(0);
  await navigate(member, 'Settings / Access');
  await expect(
    member.getByRole('button', { name: 'Review account', exact: true }),
  ).toHaveCount(0);
  await member.goto(`/crew/${fixture.otherCrewId}`);
  await login(member, fixture.crewUsername, fixture.crewPassword);
  await expect(
    member
      .getByRole('alert')
      .filter({ hasText: 'Access to another crew profile is forbidden.' }),
  ).toBeVisible();
  await member.reload();
  await expect(
    member.getByRole('heading', { name: 'Sign in to AURA', exact: true }),
  ).toBeVisible();
  await expect(
    member.getByRole('heading', { name: fixture.crewName, exact: true }),
  ).toHaveCount(0);
  await memberContext.close();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Sign in to AURA', exact: true }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
});
