import { useCallback, useEffect, useRef, useState } from 'react';

import type { PinAuthState, PinAuthStatus } from '@/types/integrations';

export interface PinAuthProvider {
  /** Start the device/PIN auth flow — returns codes + polling config */
  requestCode: () => Promise<{
    userCode: string;
    deviceCode: string;
    verificationUrl: string;
    pollConfig: {
      /** Polling interval in ms */
      intervalMs: number;
      /** Time until expiry in ms */
      expiresMs: number;
    };
  }>;
  /** Poll once for the token. Return the result object if ready, null if still pending. */
  pollToken: (codes: {
    userCode: string;
    deviceCode: string;
  }) => Promise<Record<string, unknown> | null>;
  /** Check whether a poll result indicates success */
  isSuccess: (result: Record<string, unknown>) => boolean;
}

/**
 * Generic PIN / device-code auth hook.
 *
 * Each provider (Trakt, Simkl, ...) supplies a thin adapter object that
 * maps its API calls to the common `requestCode` / `pollToken` / `isSuccess`
 * shape. The hook handles all timer management, status transitions and
 * cleanup.
 */
export function usePinAuth(
  provider: PinAuthProvider,
  onSuccess: (result: Record<string, unknown>) => void
): PinAuthState {
  const [status, setStatus] = useState<PinAuthStatus>('idle');
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always-accurate provider reference to avoid stale closures
  const providerRef = useRef(provider);
  providerRef.current = provider;

  const clearTimers = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    clearTimers();
    setStatus('idle');
    setUserCode(null);
    setVerificationUrl(null);
  }, [clearTimers]);

  const start = useCallback(async () => {
    try {
      cancel();
      setStatus('pending');

      const pinData = await providerRef.current.requestCode();
      setUserCode(pinData.userCode);
      setVerificationUrl(pinData.verificationUrl);

      // Start polling
      pollIntervalRef.current = setInterval(async () => {
        try {
          const result = await providerRef.current.pollToken({
            userCode: pinData.userCode,
            deviceCode: pinData.deviceCode,
          });
          if (result && providerRef.current.isSuccess(result)) {
            clearTimers();
            setStatus('success');
            onSuccess(result);
          }
        } catch {
          // Polling errors are expected while waiting — continue polling
        }
      }, pinData.pollConfig.intervalMs);

      // Expire after given time
      timeoutRef.current = setTimeout(() => {
        clearTimers();
        setStatus('expired');
      }, pinData.pollConfig.expiresMs);
    } catch {
      setStatus('idle');
    }
  }, [cancel, clearTimers, onSuccess]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  return { userCode, verificationUrl, status, start, cancel };
}
