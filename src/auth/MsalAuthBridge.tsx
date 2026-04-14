import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { externalLocalIdentityTokenRequest } from './authConfig';
import { externalMsalInstance } from './msalInstance';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { getDefaultRouteForUser } from '../utils/rbac';

export const MsalAuthBridge: React.FC = () => {
  const { user, isAuthenticated, login, beginAuthResolution, setAuthError, clearAuthFeedback } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const processedAccountRef = useRef<string | null>(null);

  useEffect(() => {
    const syncHostedSession = async () => {
      const activeAccount = externalMsalInstance.getActiveAccount() || externalMsalInstance.getAllAccounts()[0] || null;
      if (!activeAccount) {
        processedAccountRef.current = null;
        clearAuthFeedback();
        return;
      }

      const tokenRequest = { ...externalLocalIdentityTokenRequest, account: activeAccount };

      const accountKey = activeAccount.homeAccountId;
      const emailFromAccount = (activeAccount.username || '').toLowerCase();
      const alreadyAuthenticated = isAuthenticated && user?.email.toLowerCase() === emailFromAccount;
      if (processedAccountRef.current === accountKey && alreadyAuthenticated) {
        return;
      }

      try {
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

        if (location.pathname === '/login') {
          navigate(getDefaultRouteForUser(appUser), { replace: true });
        }
      } catch (error) {
        processedAccountRef.current = null;
        const errorMessage = error instanceof Error ? error.message : 'Sign-in could not be completed.';
        const normalizedMessage =
          /No access record found|not allowed|unauthorized|forbidden|401|403/i.test(errorMessage)
            ? 'Bu e-posta adresi icin portal erisim kaydi bulunamadi.'
            : errorMessage;
        setAuthError(normalizedMessage);
        console.error('External auth bridge failed:', error);
      }
    };

    void syncHostedSession();
  }, [beginAuthResolution, clearAuthFeedback, isAuthenticated, location.pathname, login, navigate, setAuthError, user?.email]);

  return null;
};
