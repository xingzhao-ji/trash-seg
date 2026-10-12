import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { startLocalApp, ids } from './local-app.js';

let app;
const binId = () => new app.ObjectId(ids.selectedBin);
const postReport = (request, body) => request.post(`${app.apiUrl}/api/bins/report-fullness`, { data: body });

async function evidence(testInfo, name, body, contentType) {
  const file = testInfo.outputPath(name);
  await writeFile(file, body);
  await testInfo.attach(name, { path: file, contentType });
}

test.beforeAll(async () => {
  test.setTimeout(60000);
  app = await startLocalApp();
});

test.afterAll(async () => { await app?.stop(); });
test.beforeEach(async () => { await app.seed(); });

async function openReport(page) {
  // No map tiles, location services, model downloads, or external services in this suite.
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort());
  await page.goto(app.url);
  await page.getByRole('button', { name: 'Report bin fullness' }).click();
}

test('explicitly chosen second bin is saved end to end and survives reload', async ({ page, request }, testInfo) => {
  await openReport(page);
  await expect(page.getByLabel('Bin to report')).toHaveValue('');
  await page.getByRole('button', { name: '3/4 Full', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeDisabled();
  await page.getByLabel('Bin to report').selectOption(ids.selectedBin);

  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/bins/report-fullness'));
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).toEqual({ binId: ids.selectedBin, level: '3/4 Full' });
  const payload = await response.json();
  await expect(page.getByRole('status')).toHaveText('Thanks! B — Selected bin was reported as 3/4 Full.');

  const report = await app.db.collection('fullnessreports').findOne({ _id: new app.ObjectId(payload.id) });
  expect(report.bin.toString()).toBe(ids.selectedBin);
  expect(report.station).toBeUndefined();
  expect(report.level).toBe('3/4 Full');
  expect(await app.db.collection('fullnessreports').countDocuments()).toBe(1);
  const savedBin = await app.db.collection('bins').findOne({ _id: binId() });
  expect(savedBin.fullness).toBe(75);
  expect(savedBin.level).toBe('Warning');
  expect(savedBin.lastReported.toISOString()).toBe(report.createdAt.toISOString());
  expect(savedBin.fullnessHistory).toHaveLength(1);
  expect(savedBin.fullnessHistory[0].fullness).toBe(75);
  expect((await app.db.collection('bins').findOne({ _id: new app.ObjectId(ids.firstBin) })).fullness).toBe(10);

  const stats = await (await request.get(`${app.apiUrl}/api/bins/${ids.selectedBin}/stats`)).json();
  expect(stats.todayReports).toBe(1);
  expect(stats.currentFullness).toBe(75);
  expect(stats.avgFullnessLastWeek).toBe(75);
  const overview = await (await request.get(`${app.apiUrl}/api/admin/overview`)).json();
  expect(overview.find(stat => stat.statId === 'scansToday').value).toBe(1);
  await evidence(testInfo, 'saved-report-and-bin.json',
    JSON.stringify({ request: response.request().postDataJSON(), report, savedBin, stats }, null, 2), 'application/json');
  await evidence(testInfo, 'saved-confirmation.png', await page.screenshot({ fullPage: true, animations: 'disabled' }), 'image/png');

  await page.reload();
  await page.getByRole('button', { name: 'See nearby bins' }).click();
  const card = page.locator('.bin-card').filter({ hasText: 'B — Selected bin' });
  await expect(card).toContainText('Warning');
  await card.getByRole('button', { name: 'Investigate' }).click();
  await expect(page.getByText('75%', { exact: true })).toBeVisible();
  await evidence(testInfo, 'persisted-after-reload.png', await page.screenshot({ fullPage: true, animations: 'disabled' }), 'image/png');
});

test('Use This Bin preselects that bin and the user can change it', async ({ page }) => {
  await page.goto(app.url);
  await page.getByRole('button', { name: 'See nearby bins' }).click();
  await page.locator('.bin-card').filter({ hasText: 'B — Selected bin' }).getByRole('button', { name: 'Use This Bin' }).click();
  await page.getByRole('button', { name: 'Report bin fullness' }).click();
  await expect(page.getByLabel('Bin to report')).toHaveValue(ids.selectedBin);
  await page.getByLabel('Bin to report').selectOption(ids.firstBin);
  await page.getByRole('button', { name: 'Half Full', exact: true }).click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('A — First bin was reported as Half Full.');
  expect((await app.db.collection('bins').findOne({ _id: binId() })).fullness).toBe(20);
  expect((await app.db.collection('fullnessreports').findOne()).bin.toString()).toBe(ids.firstBin);
});

test('a real 404 is visible, preserves the selection, and permits a successful retry', async ({ page }, testInfo) => {
  await openReport(page);
  await page.getByLabel('Bin to report').selectOption(ids.selectedBin);
  await page.getByRole('button', { name: '3/4 Full', exact: true }).click();
  const removed = await app.db.collection('bins').findOneAndDelete({ _id: binId() });
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/bins/report-fullness'));
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  expect((await responsePromise).status()).toBe(404);
  await expect(page.getByRole('alert')).toHaveText('Could not save your report: Bin not found');
  await expect(page.getByLabel('Bin to report')).toHaveValue(ids.selectedBin);
  await expect(page.getByRole('button', { name: '3/4 Full', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeEnabled();
  expect(await app.db.collection('fullnessreports').countDocuments()).toBe(0);
  await evidence(testInfo, 'visible-save-error.png', await page.screenshot({ fullPage: true, animations: 'disabled' }), 'image/png');

  await app.db.collection('bins').insertOne(removed);
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('was reported as 3/4 Full.');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await app.db.collection('fullnessreports').countDocuments()).toBe(1);
});

test('saving disables controls and duplicate clicks create only one report', async ({ page }) => {
  await openReport(page);
  await page.getByLabel('Bin to report').selectOption(ids.selectedBin);
  await page.getByRole('button', { name: '3/4 Full', exact: true }).click();
  let releaseRequest;
  const heldRequest = new Promise(resolve => { releaseRequest = resolve; });
  await page.route('**/api/bins/report-fullness', async route => { await heldRequest; await route.continue(); });
  try {
    await page.getByRole('button', { name: 'Submit', exact: true }).evaluate(button => { button.click(); button.click(); });
    await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await expect(page.getByLabel('Bin to report')).toBeDisabled();
    await expect(page.getByRole('button', { name: '3/4 Full', exact: true })).toBeDisabled();
  } finally { releaseRequest(); }
  await expect(page.getByRole('status')).toContainText('was reported as 3/4 Full.');
  expect(await app.db.collection('fullnessreports').countDocuments()).toBe(1);
});

test('an empty bin list cannot submit a station report', async ({ page }) => {
  await app.db.collection('bins').deleteMany({});
  await openReport(page);
  await expect(page.getByLabel('Bin to report')).toHaveValue('');
  await expect(page.getByText('No bins are available. Reload nearby bins before reporting.')).toBeVisible();
  await page.getByRole('button', { name: '3/4 Full', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeDisabled();
});

test('invalid IDs, station IDs, inactive bins and levels are rejected without writes', async ({ request }) => {
  for (const [body, status] of [
    [{ level: '3/4 Full' }, 400],
    [{ binId: 'not-an-id', level: '3/4 Full' }, 400],
    [{ binId: ids.station, level: '3/4 Full' }, 404],
    [{ binId: '000000000000000000000099', level: '3/4 Full' }, 404],
    [{ binId: ids.selectedBin, level: 'unknown' }, 400],
    [{ binId: ids.selectedBin, level: 'toString' }, 400],
    [{ binId: ids.selectedBin, level: { value: 'Full' } }, 400],
  ]) {
    expect((await postReport(request, body)).status()).toBe(status);
  }
  await app.db.collection('bins').updateOne({ _id: binId() }, { $set: { active: false } });
  expect((await postReport(request, { binId: ids.selectedBin, level: '3/4 Full' })).status()).toBe(404);
  expect(await app.db.collection('fullnessreports').countDocuments()).toBe(0);
  expect((await app.db.collection('bins').findOne({ _id: binId() })).fullness).toBe(20);
});

test('all six fullness levels save with their expected percentage and status', async ({ request }) => {
  for (const [level, fullness, status] of [
    ['Empty', 0, 'Good'], ['1/4 Full', 25, 'Good'], ['Half Full', 50, 'Good'],
    ['3/4 Full', 75, 'Warning'], ['Full', 90, 'Critical'], ['Overflowing', 100, 'Critical'],
  ]) {
    const response = await postReport(request, { binId: ids.selectedBin, level });
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.bin.fullness).toBe(fullness);
    expect(body.bin.level).toBe(status);
    expect(await app.db.collection('fullnessreports').findOne({ _id: new app.ObjectId(body.id) })).toMatchObject({ level });
  }
  expect(await app.db.collection('fullnessreports').countDocuments()).toBe(6);
  expect((await app.db.collection('bins').findOne({ _id: binId() })).fullnessHistory).toHaveLength(6);
});

test('report insert failure leaves the bin unchanged', async ({ request }) => {
  await app.db.command({ collMod: 'fullnessreports', validator: { level: { $eq: 'Empty' } }, validationLevel: 'strict' });
  try {
    expect((await postReport(request, { binId: ids.selectedBin, level: '3/4 Full' })).status()).toBe(500);
    expect(await app.db.collection('fullnessreports').countDocuments()).toBe(0);
    expect((await app.db.collection('bins').findOne({ _id: binId() })).fullness).toBe(20);
  } finally { await app.db.command({ collMod: 'fullnessreports', validator: {} }); }
});

test('bin update failure removes the newly created report', async ({ request }) => {
  await app.db.command({ collMod: 'bins', validator: { fullness: { $lt: 50 } }, validationLevel: 'strict' });
  try {
    expect((await postReport(request, { binId: ids.selectedBin, level: '3/4 Full' })).status()).toBe(500);
    expect(await app.db.collection('fullnessreports').countDocuments()).toBe(0);
    const bin = await app.db.collection('bins').findOne({ _id: binId() });
    expect(bin.fullness).toBe(20);
    expect(bin.fullnessHistory).toHaveLength(0);
  } finally { await app.db.command({ collMod: 'bins', validator: {} }); }
});

test('bin statistics include historical records without conflating station IDs', async ({ request }) => {
  await app.db.collection('fullnessreports').insertMany([
    { station: binId(), level: 'Half Full', createdAt: new Date() },
    { station: new app.ObjectId(ids.station), level: 'Overflowing', createdAt: new Date() },
  ]);
  expect((await postReport(request, { binId: ids.selectedBin, level: 'Overflowing' })).status()).toBe(201);
  const stats = await (await request.get(`${app.apiUrl}/api/bins/${ids.selectedBin}/stats`)).json();
  expect(stats.todayReports).toBe(2);
  expect(stats.avgFullnessLastWeek).toBe(75);
  expect(stats.overflowsThisMonth).toBe(1);
  const facilities = await (await request.get(`${app.apiUrl}/api/facilities/report`)).json();
  expect(facilities.details.find(bin => bin._id === ids.selectedBin)).toMatchObject({
    binName: 'B — Selected bin', totalReports: 2, overflowCount: 1, avgFullness: 75,
  });
});
