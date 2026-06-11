import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as startDeviceCode } from '@/app/api/auth/device-code/route';
import { POST as pollDeviceCode } from '@/app/api/auth/poll/route';

function mockJsonFetch(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function requestBody(fetchMock: ReturnType<typeof mockJsonFetch>) {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  if (!init?.body || typeof init.body !== 'string') {
    throw new Error('Expected JSON request body');
  }
  return JSON.parse(init.body) as Record<string, unknown>;
}

describe('OAuth routes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('starts the device flow with the configured GitHub OAuth client id', async () => {
    vi.stubEnv('GITHUB_OAUTH_CLIENT_ID', 'Iv1.productionClient');
    const fetchMock = mockJsonFetch({
      device_code: 'device-code',
      user_code: 'ABCD-EFGH',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    });

    const response = await startDeviceCode();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith('https://github.com/login/device/code', expect.any(Object));
    expect(requestBody(fetchMock)).toMatchObject({
      client_id: 'Iv1.productionClient',
      scope: 'read:user',
    });
  });

  it('polls the device flow with the configured GitHub OAuth client id', async () => {
    vi.stubEnv('GITHUB_OAUTH_CLIENT_ID', 'Iv1.productionClient');
    const fetchMock = mockJsonFetch({ access_token: 'gho_token', token_type: 'bearer', scope: 'read:user' });

    const response = await pollDeviceCode(new Request('http://localhost/api/auth/poll', {
      method: 'POST',
      body: JSON.stringify({ device_code: 'device-code' }),
    }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith('https://github.com/login/oauth/access_token', expect.any(Object));
    expect(requestBody(fetchMock)).toMatchObject({
      client_id: 'Iv1.productionClient',
      device_code: 'device-code',
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
  });
});
