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
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.scrollTo(0, 0);
    });
    await page.mouse.move(1, 1);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.screenshot({
      path: path.join(process.env.DEMO_SCREENSHOTS, name + '.png'),
      fullPage: true,
      style: '.toast-stack { visibility: hidden; }',
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
  await expect(
    page.getByRole('heading', { name: 'Welcome aboard.', exact: true }),
  ).toBeVisible();
  await capture('00-crew-entry');
  await page
    .getByRole('button', { name: 'Enter mission →', exact: true })
    .click();
  await expect(page.locator('.mission-hero')).toContainText('ARES I');
  await capture('01-mission-control');
  await nav('Crew Overview');
  await expect(page.locator('.crew-card')).toHaveCount(6);
  await expect(page.locator('.portrait-credit a')).toHaveCount(6);
  expect(
    await page
      .locator('.crew-card-photo')
      .first()
      .evaluate((image) => getComputedStyle(image).filter),
  ).toBe('none');
  await capture('02-crew-overview');
  await page.locator('.crew-card a').first().click();
  await expect(page.locator('.body-map')).toBeVisible();
  await expect(page.locator('.body-reference-image image')).toHaveAttribute(
    'href',
    /body-reference\.png$/,
  );
  const zone = page.getByRole('button', { name: /^Head & eyes\. Risk:/ });
  await zone.focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('button', { name: /^Chest & cardiovascular\. Risk:/ }),
  ).toBeFocused();
  await expect(page.locator('.zone-card-grid article')).toHaveCount(1);
  await expect(page.locator('.zone-card-grid article')).toHaveAttribute(
    'aria-label',
    'Chest & cardiovascular',
  );
  await capture('03-crew-profile');
  if (process.env.DEMO_SCREENSHOTS)
    await page.locator('.health-zone-layout').screenshot({
      path: path.join(process.env.DEMO_SCREENSHOTS, '14-body-map.png'),
    });
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
  ]) {
    const input = page.getByLabel(label, { exact: true });
    if ((await input.getAttribute('type')) === 'range') {
      await input.focus();
      await input.press('Home');
      for (let i = 1; i < Number(value); i++) await input.press('ArrowRight');
    } else await input.fill(value);
  }
  await expect(page.getByLabel('Mood', { exact: true })).toHaveAttribute(
    'aria-valuetext',
    '8 out of 10, Good',
  );
  await capture('04-daily-check');
  await page
    .getByRole('button', { name: 'Review daily check', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm and save', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: /^Daily report saved for/ }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Begin memory check', exact: true })
    .click();
  for (let round = 0; round < 3; round++) {
    const sequence = await page.getByTestId('memory-sequence').textContent();
    if (round === 0) await capture('11-memory-check');
    const input = page.getByLabel('Remembered digits', { exact: true });
    await expect(input).toBeVisible();
    await input.fill(sequence!);
    await page
      .getByRole('button', {
        name: round === 2 ? 'Finish mind check' : 'Next round',
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole('heading', { name: 'Mind check complete', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('3 / 3 recalled', { exact: true })).toBeVisible();
  await capture('12-memory-result');
  await nav('Crew Overview');
  await expect(page.locator('.crew-card').first()).toContainText('1,570 XP');
  await page.reload();
  await expect(page.locator('.crew-card').first()).toContainText('1,570 XP');
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
  await page.getByLabel('Eye pressure (mmHg)', { exact: true }).fill('20');
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
  await expect(
    page.getByText('2 / 2 rituals complete', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '30 days', exact: true }).click();
  await page.getByRole('button', { name: 'Temperature', exact: true }).click();
  await page
    .getByRole('button', { name: 'Switch to light theme', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await capture('13-light-mission');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page
    .getByRole('button', { name: 'Switch to dark theme', exact: true })
    .click();
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
  for (const name of [
    'Crew Overview',
    'Daily Health Check',
    'Mission Risk Simulator',
    'Countermeasure Protocols',
    'Settings / Access',
    'Mission Control',
  ]) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page
      .getByRole('dialog', { name: 'Navigation', exact: true })
      .getByRole('link', { name, exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name, level: 1, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `${name} mobile overflow`,
    ).toBe(true);
  }
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('crew selection replaces the report, resets fields and keeps all sliders interactive', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./daily-check/');
  await page
    .getByRole('button', { name: 'Enter mission →', exact: true })
    .click();
  const report = page.getByRole('heading', { name: /^Report for / });
  await expect(report).toHaveText('Report for Elena Vasquez');
  for (const label of ['Mood', 'Stress', 'Fatigue']) {
    const slider = page.getByRole('slider', { name: label, exact: true });
    const box = await slider.boundingBox();
    if (!box) throw new Error('Slider is not visible');
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
    const value = await slider.inputValue();
    expect(Number(value), label + ' pointer drag').toBeGreaterThanOrEqual(8);
    await expect(slider.locator('..').locator('output')).toContainText(value);
  }
  await page
    .getByLabel('Notes', { exact: true })
    .fill('This draft must not follow another crew member.');
  await page
    .getByLabel('Sleep in the last 24 hours', { exact: true })
    .fill('8');
  const names = [
    'Elena Vasquez',
    'Marcus Chen',
    'Amara Okafor',
    'Luca Moretti',
    'Sofia Andersson',
    'Noah Patel',
  ];
  for (const index of [1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0]) {
    const id = '10000000-0000-4000-8000-' + String(index + 1).padStart(12, '0');
    await page
      .getByLabel('Active crew member', { exact: true })
      .selectOption(id);
    await expect(report).toHaveCount(1);
    await expect(report).toHaveText('Report for ' + names[index]);
    await expect(page.locator('form')).toHaveCount(1);
    await expect(page.getByLabel('Mood', { exact: true })).toHaveValue('7');
    await expect(page.getByLabel('Stress', { exact: true })).toHaveValue('4');
    await expect(page.getByLabel('Fatigue', { exact: true })).toHaveValue('4');
    await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('');
    await expect(
      page.getByLabel('Sleep in the last 24 hours', { exact: true }),
    ).toHaveValue('');
  }
  await page.reload();
  await expect(report).toHaveText('Report for Elena Vasquez');
  await expect(
    page.getByLabel('Active crew member', { exact: true }),
  ).toHaveValue('10000000-0000-4000-8000-000000000001');
  await page.goto(
    './daily-check/?crewMemberId=10000000-0000-4000-8000-000000000002',
  );
  await expect(report).toHaveText('Report for Marcus Chen');
  await page
    .getByLabel('Active crew member', { exact: true })
    .selectOption('10000000-0000-4000-8000-000000000003');
  await expect(page).not.toHaveURL(/crewMemberId=/);
  await expect(report).toHaveText('Report for Amara Okafor');
  await expect(report).toHaveCount(1);
  expect(errors).toEqual([]);
});
