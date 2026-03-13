"use client";
import { useState, useCallback, useRef } from 'react';

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface AuthState {
  status: 'idle' | 'awaiting_user' | 'polling' | 'success' | 'error';
  userCode: string | null;
  verificationUri: string | null;
  error: string | null;
  token: string | null;
}

const STORAGE_KEY = 'go-sensei-github-token';
// Security: sessionStorage ensures tokens don't persist across browser sessions

export function useGitHubAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
    return {
      status: saved ? 'success' : 'idle',
      userCode: null,
      verificationUri: null,
      error: null,
      token: saved,
    };
  });

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deviceCodeRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startLogin = useCallback(async () => {
    stopPolling();
    setAuthState(s => ({ ...s, status: 'awaiting_user', error: null, userCode: null }));

    try {
      // Step 1: Request device code
      const resp = await fetch('/api/auth/device-code', { method: 'POST' });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || 'Failed to start login');
      }

      const deviceData: DeviceCodeResponse = await resp.json();
      deviceCodeRef.current = deviceData.device_code;

      setAuthState(s => ({
        ...s,
        status: 'awaiting_user',
        userCode: deviceData.user_code,
        verificationUri: deviceData.verification_uri,
      }));

      // Open GitHub device auth page
      window.open(deviceData.verification_uri, '_blank');

      // Step 2: Start polling
      let interval = (deviceData.interval || 5) * 1000;

      const poll = async () => {
        try {
          const pollResp = await fetch('/api/auth/poll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_code: deviceCodeRef.current }),
          });

          const data = await pollResp.json();

          if (data.access_token) {
            // Success!
            stopPolling();
            sessionStorage.setItem(STORAGE_KEY, data.access_token);
            setAuthState({
              status: 'success',
              userCode: null,
              verificationUri: null,
              error: null,
              token: data.access_token,
            });
            return;
          }

          if (data.error === 'authorization_pending') {
            // Keep polling — user hasn't authorized yet
            return;
          }

          if (data.error === 'slow_down') {
            // Increase polling interval
            stopPolling();
            interval += 5000;
            pollingRef.current = setInterval(poll, interval);
            return;
          }

          if (data.error === 'expired_token') {
            stopPolling();
            setAuthState(s => ({ ...s, status: 'error', error: 'Login expired. Please try again.' }));
            return;
          }

          if (data.error === 'access_denied') {
            stopPolling();
            setAuthState(s => ({ ...s, status: 'error', error: 'Access denied. Please authorize the app.' }));
            return;
          }

          // Unknown error
          if (data.error) {
            stopPolling();
            setAuthState(s => ({ ...s, status: 'error', error: data.error_description || data.error }));
          }
        } catch (err) {
          // Network error — keep polling, might be transient
          console.warn('Poll error:', err);
        }
      };

      setAuthState(s => ({ ...s, status: 'polling' }));
      pollingRef.current = setInterval(poll, interval);

    } catch (err) {
      setAuthState(s => ({
        ...s,
        status: 'error',
        error: (err as Error).message,
      }));
    }
  }, [stopPolling]);

  const logout = useCallback(() => {
    stopPolling();
    sessionStorage.removeItem(STORAGE_KEY);
    setAuthState({
      status: 'idle',
      userCode: null,
      verificationUri: null,
      error: null,
      token: null,
    });
  }, [stopPolling]);

  const isLoggedIn = authState.status === 'success' && !!authState.token;

  return {
    authState,
    isLoggedIn,
    startLogin,
    logout,
  };
}
