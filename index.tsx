import React from 'react';
import ReactDOM from 'react-dom/client';
import { MsalProvider } from '@azure/msal-react';
import App from './App';
import { msalInstance } from './src/auth/msalInstance';
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
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>
  );
};

const normalizeBootstrapError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : 'Microsoft sign-in could not be completed.';

  if (/AADSTS500207/i.test(message)) {
    return 'Continue with Microsoft su anda External ID tenantindaki federated Microsoft provider ile eslesmiyor.';
  }

  return message;
};

const safeHandleRedirectPromise = async (
  instanceLabel: 'external',
  handler: () => Promise<Awaited<ReturnType<typeof msalInstance.handleRedirectPromise>>>
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
    await msalInstance.initialize();
    const redirectResult = await safeHandleRedirectPromise('external', () => msalInstance.handleRedirectPromise());
    if (redirectResult?.account) {
      msalInstance.setActiveAccount(redirectResult.account);
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
