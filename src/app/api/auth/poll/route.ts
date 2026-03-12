import { NextResponse } from 'next/server';

const CLIENT_ID = 'Iv1.b507a08c87ecfe98';

export async function POST(req: Request) {
  try {
    const { device_code } = await req.json();

    if (!device_code) {
      return NextResponse.json({ error: 'device_code required' }, { status: 400 });
    }

    const resp = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
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
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
