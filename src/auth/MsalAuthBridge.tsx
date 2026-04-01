import React, { useEffect, useRef } from 'react';
import { InteractionStatus } from '@azure/msal-browser';
import { useMsal } from '@azure/msal-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiTokenRequest } from './authConfig';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { getDefaultRouteForUser } from '../utils/rbac';

export const MsalAuthBridge: React.FC = () => {
  const { instance, accounts, inProgress } = useMsal();
  const { user, isAuthenticated, login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const processedAccountRef = useRef<string | null>(null);
  const failedAccountRef = useRef<string | null>(null);

  useEffect(() => {
    const syncMicrosoftSession = async () => {
      if (inProgress !== InteractionStatus.None) return;
      if (!accounts.length) {
        processedAccountRef.current = null;
        failedAccountRef.current = null;
        return;
      }

      const activeAccount = instance.getActiveAccount() || accounts[0];
      if (!activeAccount) return;

      const accountKey = activeAccount.homeAccountId;
      const alreadyAuthenticated = isAuthenticated && user?.email.toLowerCase() === (activeAccount.username || '').toLowerCase();
      if (failedAccountRef.current === accountKey && !alreadyAuthenticated) {
        return;
      }
      if (processedAccountRef.current === accountKey && alreadyAuthenticated) {
        return;
      }

      try {
        // Mark account as processed before silent call to avoid repeated retries on render loops.
        processedAccountRef.current = accountKey;
        const tokenResult = await instance.acquireTokenSilent({
          ...apiTokenRequest,
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
        failedAccountRef.current = null;

        if (location.pathname === '/login') {
          navigate(getDefaultRouteForUser(appUser), { replace: true });
        }
      } catch (error) {
        const errorCode = (error as { errorCode?: string } | null)?.errorCode;
        if (errorCode === 'timed_out' || errorCode === 'monitor_window_timeout') {
          failedAccountRef.current = accountKey;
        } else {
          processedAccountRef.current = null;
        }
        console.error('Microsoft auth bridge failed:', error);
      }
    };

    void syncMicrosoftSession();
  }, [accounts, inProgress, instance, isAuthenticated, location.pathname, login, navigate, user?.email]);

  return null;
};
