import React, { useEffect, useRef } from 'react';
import { InteractionStatus } from '@azure/msal-browser';
import { useMsal } from '@azure/msal-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { externalApiTokenRequest } from './authConfig';
import {
  clearCurrentHostedSignInProvider,
  clearPendingHostedSignInProvider,
  getCurrentHostedSignInProvider,
  getPendingHostedSignInProvider,
  HostedSignInProvider,
  setCurrentHostedSignInProvider,
} from './providerSession';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { getDefaultRouteForUser } from '../utils/rbac';

export const MsalAuthBridge: React.FC = () => {
  const { instance, accounts, inProgress } = useMsal();
  const { user, isAuthenticated, login, beginAuthResolution, setAuthError, clearAuthFeedback } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const processedAccountRef = useRef<string | null>(null);

  useEffect(() => {
    const syncMicrosoftSession = async () => {
      if (inProgress !== InteractionStatus.None) return;
      const activeAccount = instance.getActiveAccount() || accounts[0] || null;
      if (!activeAccount) {
        processedAccountRef.current = null;
        clearPendingHostedSignInProvider();
        clearCurrentHostedSignInProvider();
        clearAuthFeedback();
        return;
      }

      const pendingProvider = getPendingHostedSignInProvider();
      const currentProvider = getCurrentHostedSignInProvider();

      const resolveProvider = (): HostedSignInProvider | null => {
        if (pendingProvider === 'microsoft_federated' || pendingProvider === 'external_local') return pendingProvider;
        if (currentProvider === 'microsoft_federated' || currentProvider === 'external_local') return currentProvider;
        return 'external_local';
      };

      const selectedProvider = resolveProvider();
      if (!selectedProvider) {
        return;
      }

      const accountKey = activeAccount.homeAccountId;
      const alreadyAuthenticated = isAuthenticated && user?.email.toLowerCase() === (activeAccount.username || '').toLowerCase();
      if (processedAccountRef.current === accountKey && alreadyAuthenticated) {
        return;
      }

      try {
        // Mark account as processed before silent call to avoid repeated retries on render loops.
        processedAccountRef.current = accountKey;
        beginAuthResolution();
        const tokenResult = await instance.acquireTokenSilent({
          ...externalApiTokenRequest,
          account: activeAccount,
        });

        const claims = tokenResult.idTokenClaims as Record<string, unknown> | undefined;
        const emailCandidate =
          (claims?.preferred_username as string | undefined) ||
          (claims?.email as string | undefined) ||
          activeAccount.username;

        if (!emailCandidate) {
          throw new Error('Microsoft account email claim is missing.');
        }

        await api.auth.storeMicrosoftToken({
          userEmail: emailCandidate,
          accessToken: tokenResult.accessToken,
          scope: tokenResult.scopes.join(' '),
          expiresAt: tokenResult.expiresOn?.toISOString(),
        });
        const appUser = await api.auth.checkAccess(emailCandidate, tokenResult.accessToken);

        login(appUser);
        processedAccountRef.current = accountKey;
        setCurrentHostedSignInProvider(selectedProvider);
        clearPendingHostedSignInProvider();

        if (location.pathname === '/login') {
          navigate(getDefaultRouteForUser(appUser), { replace: true });
        }
      } catch (error) {
        processedAccountRef.current = null;
        clearPendingHostedSignInProvider();
        const errorMessage = error instanceof Error ? error.message : 'Sign-in could not be completed.';
        const normalizedMessage =
          /No access record found|not allowed|unauthorized|forbidden|401|403/i.test(errorMessage)
            ? 'Yetkisiz giris. Bu Microsoft hesabi icin portal erisim kaydi bulunamadi.'
            : errorMessage;
        setAuthError(normalizedMessage);
        console.error('Microsoft auth bridge failed:', error);
      }
    };

    void syncMicrosoftSession();
  }, [accounts, beginAuthResolution, clearAuthFeedback, inProgress, instance, isAuthenticated, location.pathname, login, navigate, setAuthError, user?.email]);

  return null;
};
