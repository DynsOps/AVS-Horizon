import { NavigateFunction } from 'react-router-dom';
import { externalMsalInstance } from '../auth/msalInstance';
import { api } from '../services/api';

type PerformSignOutArgs = {
  userEmail?: string;
  hasHostedSession: boolean;
  logout: () => void;
  navigate: NavigateFunction;
  addToast: (toast: { title: string; message: string; type: 'error' }) => void;
};

export const performSignOut = async ({
  userEmail,
  hasHostedSession,
  logout,
  navigate,
  addToast,
}: PerformSignOutArgs) => {
  try {
    if (userEmail) {
      await api.auth.clearHostedToken(userEmail);
    } else {
      await api.auth.clearHostedToken();
    }

    logout();

    if (hasHostedSession) {
      await externalMsalInstance.logoutRedirect({
        postLogoutRedirectUri: `${window.location.origin}/#/login`,
      });
      return;
    }

    navigate('/login', { replace: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sign out failed.';
    addToast({ title: 'Error', message, type: 'error' });
  }
};
