import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { C, cssVarName } from '../theme/tokens';

describe('design tokens', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
  for (const [k, v] of Object.entries(C)) {
    it(`${k} matches ${cssVarName(k)} in @theme`, () => {
      const m = css.match(new RegExp(cssVarName(k) + ':[ \\t]*(#[0-9a-fA-F]{6})'));
      expect(m, `${cssVarName(k)} missing from index.css`).not.toBeNull();
      expect(m![1].toLowerCase()).toBe(v);
    });
  }
});

describe('chart series', () => {
  it('never use mountain red or valley blue for a generic series', async () => {
    const { SERIES } = await import('../theme/tokens');
    const used = SERIES.map((s) => s.toLowerCase());
    expect(used).not.toContain(C.mountain);
    expect(used).not.toContain(C.valley);
    expect(new Set(used).size).toBe(used.length);
  });
});
