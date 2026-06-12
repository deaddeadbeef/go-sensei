import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');

describe('README', () => {
  it('describes test coverage without stale hardcoded counts', () => {
    expect(readme).not.toMatch(/Tests-\d+%20passing/);
    expect(readme).not.toMatch(/\b\d+\s+tests\b/i);
  });
});
