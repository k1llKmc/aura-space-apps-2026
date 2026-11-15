import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
test('public mission: no login, all routes, local writes, simulation, reload and mobile', async ({
  page,
}) => {
  const errors: string[] = [],
    apiRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/api/v1')) apiRequests.push(request.url());
  });
  async function capture(name: string) {
    if (!process.env.DEMO_SCREENSHOTS) return;
    mkdirSync(process.env.DEMO_SCREENSHOTS, { recursive: true });
    await page.screenshot({
      path: path.join(process.env.DEMO_SCREENSHOTS, name + '.png'),
      fullPage: true,
    });
  }
  async function nav(name: string) {
    await page
      .getByRole('navigation', { name: 'Primary navigation', exact: true })
      .getByRole('link', { name, exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name, level: 1, exact: true }),
    ).toBeVisible();
  }
  await page.goto('./');
  await expect(page.locator('.mission-hero')).toContainText('ARES I');
  await capture('01-mission-control');
  await nav('Crew Overview');
  await expect(page.locator('.crew-card')).toHaveCount(6);
  await capture('02-crew-overview');
  await page.locator('.crew-card a').first().click();
  await expect(page.locator('.body-map')).toBeVisible();
  const zone = page.getByRole('button', { name: /^Head & eyes\. Risk:/ });
  await zone.focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('button', { name: /^Chest & cardiovascular\. Risk:/ }),
  ).toBeFocused();
  await capture('03-crew-profile');
  await page.reload();
  await expect(page.locator('.body-map')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await capture('09-mobile-profile');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav('Daily Health Check');
  for (const [label, value] of [
    ['Mood', '8'],
    ['Stress', '3'],
    ['Fatigue', '4'],
    ['Sleep in the last 24 hours', '7.5'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await capture('04-daily-check');
  await page
    .getByRole('button', { name: 'Review daily check', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm and save', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: /^Daily report saved for/ })).toBeVisible();
  await nav('Alerts');
  await capture('05-alerts');
  await page.getByRole('button', { name: 'Review warning' }).first().click();
  await page
    .getByLabel('Review note', { exact: true })
    .fill('Reviewed during the public demonstration.');
  await page
    .getByRole('button', { name: 'Acknowledge warning', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Warning review' }),
  ).not.toBeVisible();
  await nav('Mission Risk Simulator');
  await page
    .getByLabel('Assumed source', { exact: true })
    .selectOption('DIAGNOSTIC_DEVICE');
  await page
    .getByLabel('intraocularPressure (mmHg)', { exact: true })
    .fill('20');
  await page
    .getByRole('button', { name: 'Run baseline projection', exact: true })
    .click();
  await expect(
    page.getByRole('cell', { name: 'CRITICAL', exact: true }),
  ).toBeVisible();
  await capture('06-simulator');
  await nav('Countermeasure Protocols');
  await capture('07-protocols');
  await page.getByRole('button', { name: 'Read protocol →' }).first().click();
  await expect(
    page.getByRole('dialog').getByRole('listitem').first(),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await nav('Settings / Access');
  await expect(
    page.getByText('Public mission workspace', { exact: true }),
  ).toBeVisible();
  await capture('08-settings');
  await nav('Mission Control');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture('10-mobile-mission');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page
    .getByRole('dialog', { name: 'Navigation', exact: true })
    .getByRole('link', { name: 'Alerts', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Alerts', level: 1, exact: true }),
  ).toBeVisible();
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
});
