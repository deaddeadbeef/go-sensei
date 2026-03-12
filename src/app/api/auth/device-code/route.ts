import { NextResponse } from 'next/server';

// GitHub OAuth App client ID for Copilot integrations
// This is the well-known public client used by VS Code Copilot
const CLIENT_ID = 'Iv1.b507a08c87ecfe98';

export async function POST() {
  try {
    const resp = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
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
