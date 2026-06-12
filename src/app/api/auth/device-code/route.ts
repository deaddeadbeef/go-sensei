import { NextResponse } from 'next/server';
import { getGitHubOAuthClientId, GitHubOAuthConfigError } from '@/lib/ai/github-oauth';

function authErrorResponse(err: unknown) {
  if (err instanceof GitHubOAuthConfigError) {
    return NextResponse.json({
      code: err.code,
      error: 'GitHub sign-in is not configured for this deployment.',
      detail: err.message,
    }, { status: 500 });
  }

  return NextResponse.json({ error: (err as Error).message }, { status: 500 });
}

export async function POST() {
  try {
    const clientId = getGitHubOAuthClientId();
    const resp = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        scope: 'read:user',
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `GitHub error: ${text}` }, { status: resp.status });
    }

    const data = await resp.json();
    // Returns: { device_code, user_code, verification_uri, expires_in, interval }
    return NextResponse.json(data);
  } catch (err) {
    return authErrorResponse(err);
  }
}
