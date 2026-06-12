export const DEVELOPMENT_COPILOT_CLIENT_ID = 'Iv1.b507a08c87ecfe98';
export const OAUTH_CONFIG_MISSING_CODE = 'AUTH_CONFIG_MISSING';

type GitHubOAuthEnv = Record<string, string | undefined>;

export class GitHubOAuthConfigError extends Error {
  code = OAUTH_CONFIG_MISSING_CODE;

  constructor() {
    super('GITHUB_OAUTH_CLIENT_ID must be set for production deploys. Register a dedicated GitHub OAuth App with Device Flow enabled.');
  }
}

// Production deploys should set GITHUB_OAUTH_CLIENT_ID to a dedicated GitHub OAuth App client id.
// The fallback keeps local development compatible with the existing Copilot device flow.
export function getGitHubOAuthClientId(env: GitHubOAuthEnv = process.env) {
  const configuredClientId = env.GITHUB_OAUTH_CLIENT_ID?.trim();
  if (configuredClientId) return configuredClientId;
  if (env.NODE_ENV === 'production') {
    throw new GitHubOAuthConfigError();
  }
  return DEVELOPMENT_COPILOT_CLIENT_ID;
}
