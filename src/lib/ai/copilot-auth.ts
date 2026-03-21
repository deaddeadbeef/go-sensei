// Exchanges a GitHub token (PAT or OAuth) for a short-lived Copilot API token
// Caches the token and refreshes when expired

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

interface CopilotSession {
  token: string;
  expiresAt: number;
  apiUrl: string;
}

// S1: Per-token cache to prevent cross-user session leakage
const sessionCache = new Map<string, CopilotSession>();

export async function getCopilotSession(githubToken: string): Promise<CopilotSession> {
  // Return cached session if still valid (with 60s buffer)
  const cached = sessionCache.get(githubToken);
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached;
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
    sessionCache.delete(githubToken);
    const text = await resp.text();
    if (resp.status === 401) {
      throw new AuthError('GitHub token expired or invalid. Please re-login.');
    }
    throw new AuthError(`Failed to authenticate with GitHub Copilot (${resp.status}): ${text}`);
  }

  const data = await resp.json();

  // Extract the API URL from endpoints (critical — may be a regional endpoint)
  let apiUrl = 'https://api.githubcopilot.com';
  if (data.endpoints?.api) {
    apiUrl = data.endpoints.api;
  }

  const session: CopilotSession = {
    token: data.token,
    expiresAt: data.expires_at ? data.expires_at * 1000 : Date.now() + 25 * 60 * 1000,
    apiUrl,
  };

  sessionCache.set(githubToken, session);
  return session;
}

// Backward compat
export async function getCopilotToken(githubToken: string): Promise<string> {
  const session = await getCopilotSession(githubToken);
  return session.token;
}

export function clearCopilotTokenCache() {
  sessionCache.clear();
}
