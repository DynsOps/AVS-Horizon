import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  externalLocalIdentityTokenRequest,
  workforceIdentityTokenRequest,
} from './authConfig';
import { externalMsalInstance, workforceMsalInstance } from './msalInstance';
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
  const { user, isAuthenticated, login, beginAuthResolution, setAuthError, clearAuthFeedback } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const processedAccountRef = useRef<string | null>(null);

  useEffect(() => {
    const syncMicrosoftSession = async () => {
      const externalAccount = externalMsalInstance.getActiveAccount() || externalMsalInstance.getAllAccounts()[0] || null;
      const workforceAccount = workforceMsalInstance.getActiveAccount() || workforceMsalInstance.getAllAccounts()[0] || null;

      if (!externalAccount && !workforceAccount) {
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
        if (workforceAccount) return 'microsoft_federated';
        if (externalAccount) return 'external_local';
        return null;
      };

      const selectedProvider = resolveProvider();
      if (!selectedProvider) return;

      const activeAccount = selectedProvider === 'microsoft_federated' ? workforceAccount : externalAccount;
      if (!activeAccount) return;

      const instance = selectedProvider === 'microsoft_federated' ? workforceMsalInstance : externalMsalInstance;
      const tokenRequest =
        selectedProvider === 'microsoft_federated'
          ? { ...workforceIdentityTokenRequest, account: activeAccount }
          : { ...externalLocalIdentityTokenRequest, account: activeAccount };

      const accountKey = `${selectedProvider}:${activeAccount.homeAccountId}`;
      const emailFromAccount = (activeAccount.username || '').toLowerCase();
      const alreadyAuthenticated = isAuthenticated && user?.email.toLowerCase() === emailFromAccount;
      if (processedAccountRef.current === accountKey && alreadyAuthenticated) {
        return;
      }

      try {
        processedAccountRef.current = accountKey;
        beginAuthResolution();

        const tokenResult = await instance.acquireTokenSilent(tokenRequest);
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
          provider: selectedProvider,
        });

        const appUser = await api.auth.checkAccess(emailCandidate, tokenResult.idToken);

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
            ? 'Bu e-posta adresi icin portal erisim kaydi bulunamadi.'
            : errorMessage;
        setAuthError(normalizedMessage);
        console.error('Hosted auth bridge failed:', error);
      }
    };

    void syncMicrosoftSession();
  }, [beginAuthResolution, clearAuthFeedback, isAuthenticated, location.pathname, login, navigate, setAuthError, user?.email]);

  return null;
};
