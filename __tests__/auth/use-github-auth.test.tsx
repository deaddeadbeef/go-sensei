// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGitHubAuth } from '@/hooks/useGitHubAuth';

function AuthHarness() {
  const { authState, startLogin } = useGitHubAuth();

  return (
    <div>
      <button onClick={startLogin}>Login</button>
      <span>{authState.status}</span>
      {authState.error && <p>{authState.error}</p>}
    </div>
  );
}

describe('useGitHubAuth', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps production OAuth misconfiguration learner-safe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'AUTH_CONFIG_MISSING',
      error: 'GitHub sign-in is not configured for this deployment.',
      detail: 'GITHUB_OAUTH_CLIENT_ID must be set for production deploys.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })));

    render(<AuthHarness />);

    await act(async () => {
      screen.getByRole('button', { name: 'Login' }).click();
    });

    await waitFor(() => {
      expect(screen.getByText(/GitHub sign-in is not configured for this deployment yet/i)).toBeTruthy();
    });
    expect(screen.getByText(/guided lessons, problems, and local coaching/i)).toBeTruthy();
    expect(screen.queryByText(/GITHUB_OAUTH_CLIENT_ID/i)).toBeNull();
  });
});
