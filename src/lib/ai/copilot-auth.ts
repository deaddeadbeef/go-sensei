// Exchanges a GitHub token (PAT or OAuth) for a short-lived Copilot API token
// Caches the token and refreshes when expired

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getCopilotToken(githubToken: string): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const resp = await fetch('https://api.github.com/copilot_internal/v2/token', {
    headers: {
      'authorization': `token ${githubToken}`,
      'editor-version': 'vscode/1.95.0',
      'editor-plugin-version': 'copilot/1.250.0',
      'user-agent': 'GithubCopilot/1.250.0',
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to get Copilot token (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  cachedToken = {
    token: data.token,
    expiresAt: data.expires_at ? data.expires_at * 1000 : Date.now() + 25 * 60 * 1000,
  };

  return cachedToken.token;
}

export function clearCopilotTokenCache() {
  cachedToken = null;
}
