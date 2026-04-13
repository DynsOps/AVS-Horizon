export type HostedSignInProvider = 'microsoft_federated' | 'external_local';

const CURRENT_PROVIDER_KEY = 'avs_auth_current_provider';
const PENDING_PROVIDER_KEY = 'avs_auth_pending_provider';

const canUseStorage = (): boolean => typeof window !== 'undefined';

const readValue = (key: string): HostedSignInProvider | null => {
  if (!canUseStorage()) return null;
  const value = window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
  return value === 'microsoft_federated' || value === 'external_local' ? value : null;
};

const writeSessionValue = (key: string, value: HostedSignInProvider): void => {
  if (!canUseStorage()) return;
  window.sessionStorage.setItem(key, value);
};

const writeLocalValue = (key: string, value: HostedSignInProvider): void => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, value);
};

const clearValue = (key: string): void => {
  if (!canUseStorage()) return;
  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
};

export const getPendingHostedSignInProvider = (): HostedSignInProvider | null => readValue(PENDING_PROVIDER_KEY);
export const setPendingHostedSignInProvider = (provider: HostedSignInProvider): void => writeSessionValue(PENDING_PROVIDER_KEY, provider);
export const clearPendingHostedSignInProvider = (): void => clearValue(PENDING_PROVIDER_KEY);

export const getCurrentHostedSignInProvider = (): HostedSignInProvider | null => readValue(CURRENT_PROVIDER_KEY);
export const setCurrentHostedSignInProvider = (provider: HostedSignInProvider): void => writeLocalValue(CURRENT_PROVIDER_KEY, provider);
export const clearCurrentHostedSignInProvider = (): void => clearValue(CURRENT_PROVIDER_KEY);

export const clearHostedSignInProviderState = (): void => {
  clearPendingHostedSignInProvider();
  clearCurrentHostedSignInProvider();
};
