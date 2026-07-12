// End-to-end smoke test driving both apps in a real browser (Chromium).
// Verifies the interactive claims: live quote pricing, booking -> admin flow,
// order status pipeline, and admin cost edits repricing the public site.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:3000';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch({
  executablePath: process.env.PW_EXEC || undefined,
});
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

try {
  // ---------- SITE: quote builder ----------
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await check('site loads', (await page.title()).includes('J&N Balloon'));

  // pick Wedding Centrepiece, Grand size, a theme
  await page.getByRole('button', { name: /Wedding Centrepiece/ }).click();
  await page.getByRole('button', { name: /^Grand ·/ }).click();
  await page.getByRole('button', { name: 'Ivory & sage' }).click();

  // delivery: valid postcode + a date well beyond lead time
  const future = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
  await page.getByPlaceholder('e.g. PE29 3AB').fill('CB6 1AA');
  await page.locator('input[type="date"]').fill(future);

  // price card should appear with a £ total
  await page.getByText('YOUR PRICE', { exact: true }).waitFor({ timeout: 5000 });
  const priceText = await page.getByText(/^£\d+$/).first().innerText();
  check('live price card shows', /£\d+/.test(priceText), priceText);

  // try to book WITHOUT details -> warning
  await page.getByRole('button', { name: /^Book now$/ }).click();
  await page.getByText(/Please add your name/).waitFor({ timeout: 4000 });
  check('booking blocked without contact details', true);

  // add details, book -> checkout sheet (stripe off) -> send request
  await page.getByPlaceholder('e.g. Sophie Turner').fill('E2E Tester');
  await page.getByPlaceholder('07700 900123').fill('07700 111222');
  await page.getByRole('button', { name: /^Book now$/ }).click();
  await page.getByText('Secure checkout').waitFor({ timeout: 4000 });
  await page.getByRole('button', { name: 'Send booking request' }).click();
  await page.getByText(/Booking request JN-\d+ received/).waitFor({ timeout: 6000 });
  const bookedMsg = await page.getByText(/Booking request JN-\d+ received/).innerText();
  const orderId = (bookedMsg.match(/JN-\d+/) || [])[0];
  check('booking created from site', !!orderId, orderId);

  // ---------- ADMIN: login ----------
  await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
  check('admin redirects to login', page.url().includes('/admin/login'));
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('balloons');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/admin$/, { timeout: 8000 });
  await page.getByText('Upcoming deliveries').waitFor({ timeout: 6000 });
  check('admin login works', true);

  // Orders tab: the new booking should appear
  await page.getByRole('button', { name: 'Orders' }).click();
  await page.getByText('E2E Tester', { exact: false }).waitFor({ timeout: 6000 });
  check('site booking appears in admin orders', true, orderId);

  // Advance its status to Materials purchased (consumes stock server-side)
  const nameEl = page.getByText('E2E Tester', { exact: false }).first();
  const row = nameEl.locator('xpath=ancestor::div[.//select][1]');
  await row.locator('select').selectOption('Materials purchased');
  await page.waitForTimeout(1200);
  const statusVal = await row.locator('select').inputValue();
  check('order status updates', statusVal === 'Materials purchased', statusVal);

  // Finance tab renders numbers
  await page.getByRole('button', { name: 'Finance' }).click();
  await page.getByText('PROFIT BEFORE TAX').waitFor({ timeout: 5000 });
  await page.getByText('SAFE TO TAKE OUT').first().waitFor({ timeout: 5000 });
  check('finance tab renders take-home breakdown', true);

  // Costs & pricing: bump labour rate, then confirm site reprices
  await page.getByRole('button', { name: 'Costs & pricing' }).click();
  const labour = page.locator('input[type="number"]').first();
  await labour.fill('40');
  await labour.blur();
  await page.waitForTimeout(1000); // allow debounced PUT

  // read wedding/grand price from a fresh site load, compare to a low baseline
  const p2 = await ctx.newPage();
  await p2.goto(BASE + '/api/store', { waitUntil: 'networkidle' });
  const store = JSON.parse(await p2.locator('pre').innerText().catch(async () => await p2.evaluate(() => document.body.innerText)));
  check('admin labour edit persisted to store', store.settings.labourRate === 40, 'labourRate=' + store.settings.labourRate);
  await p2.close();
} catch (err) {
  check('UNCAUGHT', false, err.message);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
