import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { externalMsalInstance } from './src/auth/msalInstance';
import { useAuthStore } from './src/store/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 60 * 1000,
      retry: 1,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const cleanupLegacyAuthStorage = () => {
  if (typeof window === 'undefined') return;

  const removeKeys = (storage: Storage, keys: string[]) => {
    keys.forEach((key) => storage.removeItem(key));
  };

  removeKeys(window.localStorage, ['avs_auth_current_provider']);
  removeKeys(window.sessionStorage, ['avs_auth_pending_provider']);

  const legacyWorkforceClientId = 'd2d4d4d0-1bd6-44be-bcde-a9e4a2650150';
  const cleanupMsalKeys = (storage: Storage) => {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key && key.includes(legacyWorkforceClientId)) {
        storage.removeItem(key);
      }
    }
  };

  cleanupMsalKeys(window.sessionStorage);
  cleanupMsalKeys(window.localStorage);
};

const renderApp = () => {
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>
  );
};

const normalizeBootstrapError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : 'Sign-in could not be completed.';

  if (/AADSTS500207/i.test(message)) {
    return 'Sign in su anda External ID otoritesiyle eslesmiyor. External local account ayarlarini kontrol edelim.';
  }

  return message;
};

const safeHandleRedirectPromise = async (handler: () => Promise<any>) => {
  try {
    return await handler();
  } catch (error) {
    const errorCode = (error as { errorCode?: string } | null)?.errorCode;
    if (errorCode === 'authority_mismatch') {
      console.warn('Ignoring redirect authority mismatch for External ID.', error);
      return null;
    }
    throw error;
  }
};

const bootstrap = async () => {
  try {
    cleanupLegacyAuthStorage();
    await externalMsalInstance.initialize();

    const externalRedirectResult = await safeHandleRedirectPromise(() => externalMsalInstance.handleRedirectPromise());
    if (externalRedirectResult?.account) {
      externalMsalInstance.setActiveAccount(externalRedirectResult.account);
    }
  } catch (error) {
    useAuthStore.getState().setAuthError(normalizeBootstrapError(error));
    console.error('MSAL bootstrap failed:', error);

    if (window.location.hash !== '#/login') {
      window.location.hash = '/login';
    }
  } finally {
    renderApp();
  }
};

void bootstrap();
