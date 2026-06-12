"use client";
import { useState, useCallback, useRef, useEffect } from 'react';

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
const AUTH_CONFIG_MISSING_CODE = 'AUTH_CONFIG_MISSING';
const AUTH_CONFIG_MISSING_MESSAGE = 'GitHub sign-in is not configured for this deployment yet. You can still use guided lessons, problems, and local coaching without signing in.';
// Security: sessionStorage ensures tokens don't persist across browser sessions

type AuthErrorPayload = {
  code?: string;
  error?: string;
  error_description?: string;
};

function authErrorMessage(data: AuthErrorPayload, fallback: string): string {
  if (data.code === AUTH_CONFIG_MISSING_CODE) return AUTH_CONFIG_MISSING_MESSAGE;
  return data.error_description || data.error || fallback;
}

async function copyUserCodeToClipboard(userCode: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(userCode);
      return true;
    }
  } catch {
    // Fall through to the textarea fallback below.
  }

  const textarea = document.createElement('textarea');
  textarea.value = userCode;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.left = '-1000px';

  try {
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, userCode.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

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

  // Validate saved token on mount
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (!saved) return;

    fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${saved}` },
    }).then((resp) => {
      if (resp.status === 401) {
        sessionStorage.removeItem(STORAGE_KEY);
        setAuthState({
          status: 'idle',
          userCode: null,
          verificationUri: null,
          error: null,
          token: null,
        });
      }
    }).catch(() => {
      // Network error — keep token, might be transient
    });
  }, []);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deviceCodeRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const startLogin = useCallback(async () => {
    stopPolling();
    setAuthState(s => ({ ...s, status: 'awaiting_user', error: null, userCode: null }));

    try {
      // Step 1: Request device code
      const resp = await fetch('/api/auth/device-code', { method: 'POST' });
      if (!resp.ok) {
        const data = await resp.json() as AuthErrorPayload;
        throw new Error(authErrorMessage(data, 'Failed to start login'));
      }

      const deviceData: DeviceCodeResponse = await resp.json();
      deviceCodeRef.current = deviceData.device_code;

      setAuthState(s => ({
        ...s,
        status: 'awaiting_user',
        userCode: deviceData.user_code,
        verificationUri: deviceData.verification_uri,
      }));

      // Copy the user-facing code before sending them to GitHub.
      await copyUserCodeToClipboard(deviceData.user_code);

      // Open GitHub device auth page.
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
            setAuthState(s => ({ ...s, status: 'error', error: authErrorMessage(data, data.error) }));
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
