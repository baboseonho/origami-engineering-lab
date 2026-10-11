import { expect, test, type Page } from '@playwright/test';
import { LESSONS } from '../src/curriculum/lessons';

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

async function open(page: Page, lesson: string) {
  await page.goto('/#' + lesson);
  await page.reload();
  await page.waitForTimeout(1500);
}

test('every lesson loads without runtime errors', async ({ page }) => {
  const errors = collectErrors(page);
  for (const l of LESSONS) {
    await open(page, l.id);
    await expect(page.getByText(l.title).first()).toBeAttached();
  }
  expect(errors).toEqual([]);
});

test('Miura: driving one crease gives a rigid 1-DoF solution', async ({ page }) => {
  await open(page, 'l4-miura');
  const ok = page.getByText('강체 해 존재', { exact: true });
  await expect(ok).toBeVisible();
  await expect(page.getByText('DoF_local = 1').first()).toBeVisible();
  await page.getByRole('button', { name: '-90°', exact: true }).click();
  await expect(ok).toBeVisible();
  await expect(page.getByText('-90.00°').first()).toBeVisible();
});

test('Shopping bag: flat state closes, no crease can move rigidly', async ({ page }) => {
  await open(page, 'l3-bag');
  await page.getByRole('tab', { name: '형상', exact: true }).click();
  await page.getByRole('button', { name: '모든 크리스 ±5° 시험' }).click();
  await expect(page.getByText('0/19 크리스 이동 가능')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/‖C‖ = 1\.\d+e-15|‖C‖ = 0\.000/)).toBeVisible();
});

test('Kawasaki explorer: break and repair the theorem', async ({ page }) => {
  await open(page, 'l2-kawasaki');
  await page.getByRole('button', { name: '"정리 깨기" 프리셋' }).click();
  await expect(page.getByText('평탄 접힘 불가능', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /평탄 접힘 가능하게 수정/ }).click();
  await expect(page.getByText('평탄 접힘 가능한 섹터각', { exact: true })).toBeVisible();
});

test('1D strip: collision preset is reported as not flat-foldable', async ({ page }) => {
  await open(page, 'l2-strip');
  await page.getByRole('button', { name: '충돌', exact: true }).click();
  await expect(page.getByText('이 M/V 배정으로는 평탄 접힘 불가능', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '접힘 가능', exact: true }).click();
  await page.getByRole('button', { name: '자동 풀이' }).click();
  await expect(page.getByText(/단계 1:/)).toBeVisible();
});

test('Square twist: rigid drive is infeasible with an explicit reason', async ({ page }) => {
  await open(page, 'l2-terms');
  await page.getByRole('button', { name: '+45°', exact: true }).click();
  await expect(page.getByText('강체 해 없음 (infeasible)')).toBeVisible();
  await expect(page.getByText(/M\/V 배정 충돌/)).toBeVisible();
});

test('Kresling: energy experiment runs in the worker', async ({ page }) => {
  await open(page, 'l5-kresling');
  await page.getByRole('radio', { name: 'Energy', exact: true }).click();
  await page.getByRole('tab', { name: '에너지', exact: true }).click();
  await page.getByRole('button', { name: '축 압축 실험 (비틀림 자유)' }).click();
  await expect(page.getByText(/실험 프레임 u = 0\.5\d\d/)).toBeVisible({ timeout: 60_000 });
});
