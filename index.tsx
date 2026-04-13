import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { externalMsalInstance, workforceMsalInstance } from './src/auth/msalInstance';
import { clearHostedSignInProviderState } from './src/auth/providerSession';
import { useAuthStore } from './src/store/authStore';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const renderApp = () => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

const normalizeBootstrapError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : 'Microsoft sign-in could not be completed.';

  if (/AADSTS500207/i.test(message)) {
    return 'Sign in su anda External ID otoritesiyle eslesmiyor. External local account ayarlarini kontrol edelim.';
  }

  if (/AADSTS650059/i.test(message)) {
    return 'Continue with Microsoft icin kullandigin workforce SPA uygulamasi multitenant ya da dogru redirect ayariyla eslesmiyor.';
  }

  return message;
};

const safeHandleRedirectPromise = async (
  instanceLabel: 'external' | 'workforce',
  handler: () => Promise<any>
) => {
  try {
    return await handler();
  } catch (error) {
    const errorCode = (error as { errorCode?: string } | null)?.errorCode;
    if (errorCode === 'authority_mismatch') {
      console.warn(`Ignoring ${instanceLabel} redirect mismatch and continuing with the alternate MSAL authority.`, error);
      return null;
    }
    throw error;
  }
};

const bootstrap = async () => {
  try {
    await externalMsalInstance.initialize();
    await workforceMsalInstance.initialize();

    const externalRedirectResult = await safeHandleRedirectPromise('external', () => externalMsalInstance.handleRedirectPromise());
    if (externalRedirectResult?.account) {
      externalMsalInstance.setActiveAccount(externalRedirectResult.account);
      workforceMsalInstance.setActiveAccount(null);
    }

    const workforceRedirectResult = await safeHandleRedirectPromise('workforce', () => workforceMsalInstance.handleRedirectPromise());
    if (workforceRedirectResult?.account) {
      workforceMsalInstance.setActiveAccount(workforceRedirectResult.account);
      externalMsalInstance.setActiveAccount(null);
    }
  } catch (error) {
    clearHostedSignInProviderState();
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
