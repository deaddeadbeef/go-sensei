import { NextResponse } from 'next/server';
import { getGitHubOAuthClientId } from '@/lib/ai/github-oauth';

export async function POST() {
  const clientId = getGitHubOAuthClientId();
  try {
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
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
