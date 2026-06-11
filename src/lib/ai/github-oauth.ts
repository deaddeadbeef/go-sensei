export const DEVELOPMENT_COPILOT_CLIENT_ID = 'Iv1.b507a08c87ecfe98';

type GitHubOAuthEnv = Record<string, string | undefined>;

// Production deploys should set GITHUB_OAUTH_CLIENT_ID to a dedicated GitHub OAuth App client id.
// The fallback keeps local development compatible with the existing Copilot device flow.
export function getGitHubOAuthClientId(env: GitHubOAuthEnv = process.env) {
  const configuredClientId = env.GITHUB_OAUTH_CLIENT_ID?.trim();
  return configuredClientId || DEVELOPMENT_COPILOT_CLIENT_ID;
}
