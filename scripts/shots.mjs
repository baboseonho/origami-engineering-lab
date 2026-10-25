// Screenshot a few sheets in both languages: node scripts/shots.mjs <outDir> [baseUrl]
import { chromium } from '@playwright/test';

const out = process.argv[2] ?? '.';
const base = process.argv[3] ?? 'http://localhost:5173/';
const shots = [
  // [file, hash, lang, width, height, setup]
  ['w_ko', 'l0-welcome', 'ko', 1440, 900],
  ['atlas_en', 'l0-atlas', 'en', 1440, 900],
  ['bag_ko', 'l3-bag', 'ko', 1440, 900],
  ['tube_en', 'l6-wbtube', 'en', 1440, 900],
  ['proj_ko', 'l4-miura', 'ko', 1440, 900, async (p) => { await p.getByRole('radio', { name: /투영/ }).click(); await p.waitForTimeout(1500); }],
  ['hypar_ko', 'l6-hypar', 'ko', 1440, 900],
  ['phone_en', 'l0-welcome', 'en', 390, 844],
];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
for (const [file, hash, lang, w, h, setup] of shots) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: lang === 'ko' ? 'ko-KR' : 'en-US' });
  const p = await ctx.newPage();
  await p.goto(`${base}#${hash}`);
  await p.waitForTimeout(4500);
  if (setup) await setup(p);
  await p.screenshot({ path: `${out}/${file}.png` });
  await ctx.close();
  console.log('shot', file);
}
await browser.close();
