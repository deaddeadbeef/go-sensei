// Exchanges a GitHub token (PAT or OAuth) for a short-lived Copilot API token
// Caches the token and refreshes when expired

interface CopilotSession {
  token: string;
  expiresAt: number;
  apiUrl: string;
}

let cachedSession: CopilotSession | null = null;

export async function getCopilotSession(githubToken: string): Promise<CopilotSession> {
  // Return cached session if still valid (with 60s buffer)
  if (cachedSession && Date.now() < cachedSession.expiresAt - 60_000) {
    return cachedSession;
  }

  const resp = await fetch('https://api.github.com/copilot_internal/v2/token', {
    headers: {
      'authorization': `Bearer ${githubToken}`,
      'user-agent': 'GoSensei/1.0.0',
      'editor-version': 'vscode/1.96.0',
      'editor-plugin-version': 'copilot-chat/0.24.0',
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to get Copilot token (${resp.status}): ${text}`);
  }

  const data = await resp.json();

  // Extract the API URL from endpoints (critical — may be a regional endpoint)
  let apiUrl = 'https://api.githubcopilot.com';
  if (data.endpoints?.api) {
    apiUrl = data.endpoints.api;
  }

  cachedSession = {
    token: data.token,
    expiresAt: data.expires_at ? data.expires_at * 1000 : Date.now() + 25 * 60 * 1000,
    apiUrl,
  };

  return cachedSession;
}

// Backward compat
export async function getCopilotToken(githubToken: string): Promise<string> {
  const session = await getCopilotSession(githubToken);
  return session.token;
}

export function clearCopilotTokenCache() {
  cachedSession = null;
}
