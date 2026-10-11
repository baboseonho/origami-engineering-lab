import { expect, test, type Page } from '@playwright/test';
import { LESSONS } from '../src/curriculum/lessons';

/**
 * Whole-app audit: every lesson is opened and exercised (views, solvers,
 * analysis tabs, fold buttons, presets, lab controls); any page error or
 * console error fails the run, with the lesson and step that caused it.
 */
const IGNORE = [/THREE\.Clock/, /React DevTools/, /\[vite\]/];

function collect(page: Page, where: { step: string }) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`[${where.step}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const t = m.text();
    if (IGNORE.some((r) => r.test(t))) return;
    errors.push(`[${where.step}] ${m.type()}: ${t.slice(0, 300)}`);
  });
  return errors;
}

async function clickIf(page: Page, name: string | RegExp, opts: { role?: 'button' | 'radio' | 'tab'; exact?: boolean } = {}) {
  const loc = page.getByRole(opts.role ?? 'button', { name, exact: opts.exact ?? true }).first();
  if (await loc.count() && await loc.isVisible() && await loc.isEnabled()) { await loc.click(); return true; }
  return false;
}

async function exerciseModel(page: Page, where: { step: string }, id: string) {
  for (const v of ['3D', '전개도', '분할']) { where.step = `${id}: view ${v}`; await clickIf(page, new RegExp(v), { role: 'radio', exact: false }); await page.waitForTimeout(250); }
  // fold with the inspector (the default drive crease is selected on load)
  where.step = `${id}: fold buttons`;
  if (await clickIf(page, '0.25×', { role: 'radio' })) { /* slow */ }
  await clickIf(page, '1×', { role: 'radio' });
  if (await clickIf(page, '끝까지 접기')) await page.waitForTimeout(1600);
  if (await clickIf(page, '펴기')) await page.waitForTimeout(1600);
  if (await clickIf(page, '+45°')) await page.waitForTimeout(700);
  // analysis tabs
  for (const t of ['접힘각', '구속조건', '자유도 DoF', '에너지', '변형률', '형상', '이론']) {
    where.step = `${id}: tab ${t}`;
    await clickIf(page, t, { role: 'tab' });
    await page.waitForTimeout(250);
  }
  // presets / experiment on the geometry and energy tabs
  where.step = `${id}: solver Energy`;
  await clickIf(page, 'Energy', { role: 'radio' });
  await page.waitForTimeout(1200);
  where.step = `${id}: relax`;
  await clickIf(page, '이완 (FIRE)');
  await page.waitForTimeout(400);
  where.step = `${id}: solver Rigid`;
  await clickIf(page, 'Rigid', { role: 'radio' });
  await page.waitForTimeout(500);
  where.step = `${id}: undo/redo/reset`;
  await clickIf(page, '실행취소');
  await clickIf(page, '다시실행');
  await clickIf(page, '초기화');
  await page.waitForTimeout(300);
}

test('audit: every lesson, exercised, without errors', async ({ page }) => {
  test.setTimeout(1_200_000);
  const where = { step: 'boot' };
  const errors = collect(page, where);
  await page.goto('/');
  await page.waitForTimeout(1500);
  // cover sheet opens on a first visit and closes with Escape
  await expect(page.getByRole('dialog', { name: '도면 목록' })).toBeVisible();
  await page.keyboard.press('Escape');

  const only = process.env.AUDIT_KIND;
  for (const l of LESSONS.filter((x) => !only || x.kind === only)) {
    where.step = `${l.id}: open`;
    console.log('AUDIT', l.id);
    await page.goto('/#' + l.id);
    await page.reload();
    await page.waitForTimeout(1800);
    await expect(page.getByText(l.title).first()).toBeAttached();
    if (l.kind === 'model') await exerciseModel(page, where, l.id);
    else {
      where.step = `${l.id}: lab controls`;
      for (const b of ['수납', '중간', '펼치기', '자동 압축', '처음으로', '"정리 깨기" 프리셋', '자동 풀이']) {
        if (await clickIf(page, b, { exact: false })) await page.waitForTimeout(900);
      }
      // nudge every range input in the lab
      const ranges = page.locator('main input[type=range]');
      const n = await ranges.count();
      for (let i = 0; i < n; i++) {
        const r = ranges.nth(i);
        if (!(await r.isVisible()) || !(await r.isEnabled())) continue;
        console.log('AUDIT range', l.id, i);
        await r.focus();
        for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowRight');
      }
      await page.waitForTimeout(800);
    }
  }
  expect(errors).toEqual([]);
});

test('audit: phone layout, drawers and cover', async ({ page }) => {
  const where = { step: 'phone' };
  const errors = collect(page, where);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#l4-miura');
  await page.reload();
  await page.waitForTimeout(1800);
  // no horizontal page scroll
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  where.step = 'phone: index drawer';
  await page.getByRole('button', { name: '도면 목록 열기' }).click();
  await expect(page.getByRole('dialog', { name: '도면 목록' }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  where.step = 'phone: inspector drawer';
  await page.getByRole('button', { name: '검사' }).first().click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  where.step = 'phone: cover';
  await page.getByRole('button', { name: '도면 목록 (표지) 열기' }).click();
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});
