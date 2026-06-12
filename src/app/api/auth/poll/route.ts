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

export async function POST(req: Request) {
  try {
    const { device_code } = await req.json();

    if (!device_code) {
      return NextResponse.json({ error: 'device_code required' }, { status: 400 });
    }
    const clientId = getGitHubOAuthClientId();

    const resp = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `GitHub error: ${text}` }, { status: resp.status });
    }

    const data = await resp.json();
    // Possible responses:
    // { access_token, token_type, scope } — SUCCESS
    // { error: "authorization_pending" } — keep polling
    // { error: "slow_down", interval } — increase interval
    // { error: "expired_token" } — start over
    // { error: "access_denied" } — user denied
    return NextResponse.json(data);
  } catch (err) {
    return authErrorResponse(err);
  }
}
