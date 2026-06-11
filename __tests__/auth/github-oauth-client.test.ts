import { describe, expect, it } from 'vitest';
import { DEVELOPMENT_COPILOT_CLIENT_ID, getGitHubOAuthClientId } from '@/lib/ai/github-oauth';

describe('GitHub OAuth client configuration', () => {
  it('uses a configured dedicated OAuth app client id', () => {
    expect(getGitHubOAuthClientId({ GITHUB_OAUTH_CLIENT_ID: '  Iv1.productionClient  ' })).toBe('Iv1.productionClient');
  });

  it('falls back to the development Copilot OAuth client id', () => {
    expect(getGitHubOAuthClientId({})).toBe(DEVELOPMENT_COPILOT_CLIENT_ID);
  });
});
