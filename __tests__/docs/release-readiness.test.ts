import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const releaseReadiness = readFileSync(
  new URL('../../docs/release/1.0.0-readiness.md', import.meta.url),
  'utf8',
);
const releaseNotes = readFileSync(
  new URL('../../docs/release/v1.0.0-notes.md', import.meta.url),
  'utf8',
);

describe('release readiness documentation', () => {
  it('keeps the 1.0.0 checklist linked from the README', () => {
    expect(readme).toContain('docs/release/1.0.0-readiness.md');
    expect(readme).toContain('npm run release:check');
  });

  it('documents the release gate and production prerequisites', () => {
    expect(releaseReadiness).toContain('npm run release:check');
    expect(releaseReadiness).toContain('GitHub CI');
    expect(releaseReadiness).toContain('Pull request state');
    expect(releaseReadiness).toContain('package.json');
    expect(releaseReadiness).toContain('GITHUB_OAUTH_CLIENT_ID');
    expect(releaseReadiness).toContain('Production smoke');
    expect(releaseReadiness).toContain('Release notes');
  });

  it('keeps draft 1.0.0 release notes ready for the final release PR', () => {
    expect(readme).toContain('docs/release/v1.0.0-notes.md');
    expect(releaseReadiness).toContain('docs/release/v1.0.0-notes.md');
    expect(releaseNotes).toContain('## Learner-Facing Changes');
    expect(releaseNotes).toContain('## Setup Requirements');
    expect(releaseNotes).toContain('## Verification');
    expect(releaseNotes).toContain('## Known Limitations');
    expect(releaseNotes).toContain('GITHUB_OAUTH_CLIENT_ID');
    expect(releaseNotes).toContain('npm run release:check');
    expect(releaseNotes).toContain('production smoke');
  });
});
