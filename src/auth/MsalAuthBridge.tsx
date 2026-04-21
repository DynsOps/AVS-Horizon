import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { externalLocalIdentityTokenRequest } from './authConfig';
import { externalMsalInstance } from './msalInstance';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { getDefaultRouteForUser } from '../utils/rbac';

export const MsalAuthBridge: React.FC = () => {
  const { user, isAuthenticated, login, logout, beginAuthResolution, setAuthError, clearAuthFeedback } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const processedAccountRef = useRef<string | null>(null);
  const suppressedAccountRef = useRef<string | null>(null);
  const syncInFlightRef = useRef(false);
  const intervalRef = useRef<number | null>(null);
  const lastSyncedAtRef = useRef(0);

  useEffect(() => {
    const isSilentIframeContext =
      typeof window !== 'undefined' && (window.parent !== window || Boolean(window.opener));
    if (isSilentIframeContext) {
      return;
    }

    const syncHostedSession = async (options?: { force?: boolean }) => {
      if (syncInFlightRef.current) return;

      const activeAccount = externalMsalInstance.getActiveAccount() || externalMsalInstance.getAllAccounts()[0] || null;
      if (!activeAccount) {
        processedAccountRef.current = null;
        suppressedAccountRef.current = null;
        clearAuthFeedback();
        return;
      }

      const tokenRequest = { ...externalLocalIdentityTokenRequest, account: activeAccount };

      const accountKey = activeAccount.homeAccountId;
      if (!isAuthenticated && suppressedAccountRef.current === accountKey) {
        return;
      }

      const emailFromAccount = (activeAccount.username || '').toLowerCase();
      const alreadyAuthenticated = isAuthenticated && user?.email.toLowerCase() === emailFromAccount;
      const wasRecentlySynced = Date.now() - lastSyncedAtRef.current < 30_000;
      if (!options?.force && processedAccountRef.current === accountKey && alreadyAuthenticated && wasRecentlySynced) {
        return;
      }

      try {
        syncInFlightRef.current = true;
        processedAccountRef.current = accountKey;
        beginAuthResolution();

        const tokenResult = await externalMsalInstance.acquireTokenSilent(tokenRequest);
        const claims = tokenResult.idTokenClaims as Record<string, unknown> | undefined;
        const emailCandidate =
          (claims?.preferred_username as string | undefined) ||
          (claims?.email as string | undefined) ||
          activeAccount.username;

        if (!emailCandidate) {
          throw new Error('Sign-in token is missing an email claim.');
        }

        await api.auth.storeHostedToken({
          userEmail: emailCandidate,
          bearerToken: tokenResult.idToken,
          scope: tokenResult.scopes.join(' '),
          expiresAt: tokenResult.expiresOn?.toISOString(),
          provider: 'external_local',
        });

        const appUser = await api.auth.checkAccess(emailCandidate, tokenResult.idToken);

        login(appUser);
        processedAccountRef.current = accountKey;
        suppressedAccountRef.current = null;
        lastSyncedAtRef.current = Date.now();

        if (location.pathname === '/login') {
          navigate(getDefaultRouteForUser(appUser), { replace: true });
        }
      } catch (error) {
        const errorCode =
          error && typeof error === 'object' && 'errorCode' in error
            ? String((error as { errorCode?: unknown }).errorCode || '')
            : '';
        const shouldResetSession =
          /^(timed_out|monitor_window_timeout|block_iframe_reload|login_required|interaction_required)$/.test(errorCode);

        if (shouldResetSession) {
          processedAccountRef.current = null;
          suppressedAccountRef.current = accountKey;
          await api.auth.clearHostedToken(user?.email || activeAccount.username);
          logout();
          setAuthError('Oturum suresi doldu. Lutfen tekrar giris yapin.');
          if (location.pathname !== '/login') {
            navigate('/login', { replace: true });
          }
          return;
        }

        processedAccountRef.current = null;
        const errorMessage = error instanceof Error ? error.message : 'Sign-in could not be completed.';
        const normalizedMessage =
          /No access record found|not allowed|unauthorized|forbidden|401|403/i.test(errorMessage)
            ? 'Bu e-posta adresi icin portal erisim kaydi bulunamadi.'
            : errorMessage;
        setAuthError(normalizedMessage);
        console.error('External auth bridge failed:', error);
      } finally {
        syncInFlightRef.current = false;
      }
    };

    void syncHostedSession();

    intervalRef.current = window.setInterval(() => {
      void syncHostedSession({ force: true });
    }, 60_000);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [beginAuthResolution, clearAuthFeedback, isAuthenticated, location.pathname, login, logout, navigate, setAuthError, user?.email]);

  return null;
};
