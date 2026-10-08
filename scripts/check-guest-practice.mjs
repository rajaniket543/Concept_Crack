import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
  await page.goto(origin);
  await page.getByRole('link', { name: 'Start Preparing Free' }).click();
  await page.waitForURL('**/try');
  await page.getByRole('button', { name: 'Practice Physics', exact: true }).click();
  await page.getByLabel('25 m', { exact: true }).check();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('7 N', { exact: true }).check();
  await page.getByRole('button', { name: 'Submit test', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm submission' }).click();
  await page.getByText('3 / 20', { exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Answers & explanations' }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'My results', exact: true }).click();
  await page.getByRole('button', { name: /Physics starter practice/ }).click();
  await page.getByText('3 / 20', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Back to practice' }).click();
  await page.getByRole('button', { name: 'NEET', exact: true }).click();
  await page.getByRole('button', { name: 'Practice Biology' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Practice Mathematics' }).count(), 0);
  await page.getByRole('button', { name: 'Mini mock test', exact: true }).click();
  await page.getByRole('button', { name: 'Start mini mock' }).click();
  await page.getByText('0 of 15 answered', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Exit test' }).click();
  await page.getByRole('button', { name: 'Discard and exit' }).click();
  // Expiry automatically submits, with no unanswered penalties.
  await page.clock.install();
  await page.getByRole('button', { name: 'Subject practice' }).click();
  await page.getByRole('button', { name: 'Practice Chemistry' }).click();
  await page.clock.fastForward(451000);
  await page.getByText('0 / 20', { exact: true }).waitFor();
  await page.clock.resume();
  await page.goto(`${origin}/student/practice`);
  await page.waitForURL('**/login');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin);
  await page.getByRole('button', { name: /menu/i }).click();
  await page.getByRole('link', { name: 'Start Free Trial', exact: true }).filter({ visible: true }).click();
  await page.waitForURL('**/try');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS: landing CTA, scoring, review, history reload, NEET subjects, mixed test, exit, timer expiry, protected route, mobile CTA and layout.');
} finally {
  await browser.close();
}
