import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MsalAuthBridge } from '../MsalAuthBridge';

const mocks = vi.hoisted(() => ({
  user: { id: 'u-1', name: 'Test User', email: 'user@example.com', role: 'admin', permissions: [], status: 'Active' as const },
  isAuthenticated: true,
  beginAuthResolution: vi.fn(),
  setAuthError: vi.fn(),
  clearAuthFeedback: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  acquireTokenSilent: vi.fn(),
  getActiveAccount: vi.fn(),
  getAllAccounts: vi.fn(),
  storeHostedToken: vi.fn(),
  clearHostedToken: vi.fn(),
  checkAccess: vi.fn(),
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: mocks.user,
    isAuthenticated: mocks.isAuthenticated,
    beginAuthResolution: mocks.beginAuthResolution,
    setAuthError: mocks.setAuthError,
    clearAuthFeedback: mocks.clearAuthFeedback,
    login: mocks.login,
    logout: mocks.logout,
  }),
}));

vi.mock('../../auth/msalInstance', () => ({
  externalMsalInstance: {
    acquireTokenSilent: mocks.acquireTokenSilent,
    getActiveAccount: mocks.getActiveAccount,
    getAllAccounts: mocks.getAllAccounts,
  },
}));

vi.mock('../../services/api', () => ({
  api: {
    auth: {
      storeHostedToken: mocks.storeHostedToken,
      clearHostedToken: mocks.clearHostedToken,
      checkAccess: mocks.checkAccess,
    },
  },
}));

describe('MsalAuthBridge', () => {
  const activeAccount = { homeAccountId: 'home-1', username: 'user@example.com' };
  const originalParent = window.parent;
  const originalOpener = window.opener;

  beforeEach(() => {
    vi.useFakeTimers();
    mocks.beginAuthResolution.mockReset();
    mocks.setAuthError.mockReset();
    mocks.clearAuthFeedback.mockReset();
    mocks.login.mockReset();
    mocks.logout.mockReset();
    mocks.acquireTokenSilent.mockReset();
    mocks.getActiveAccount.mockReset();
    mocks.getAllAccounts.mockReset();
    mocks.storeHostedToken.mockReset();
    mocks.clearHostedToken.mockReset();
    mocks.checkAccess.mockReset();

    mocks.getActiveAccount.mockReturnValue(activeAccount);
    mocks.getAllAccounts.mockReturnValue([activeAccount]);
    mocks.acquireTokenSilent.mockResolvedValue({
      idToken: 'token-1',
      idTokenClaims: { preferred_username: 'user@example.com' },
      scopes: ['openid', 'profile', 'email'],
      expiresOn: new Date(Date.now() + 60 * 60 * 1000),
    });
    mocks.storeHostedToken.mockResolvedValue(undefined);
    mocks.clearHostedToken.mockResolvedValue(undefined);
    mocks.checkAccess.mockResolvedValue(mocks.user);
  });

  afterEach(() => {
    mocks.isAuthenticated = true;
    vi.useRealTimers();
    Object.defineProperty(window, 'parent', { configurable: true, value: originalParent });
    Object.defineProperty(window, 'opener', { configurable: true, value: originalOpener });
  });

  it('skips silent sync inside iframe contexts', async () => {
    Object.defineProperty(window, 'parent', { configurable: true, value: {} });
    Object.defineProperty(window, 'opener', { configurable: true, value: null });

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <MsalAuthBridge />
      </MemoryRouter>
    );

    await vi.runOnlyPendingTimersAsync();
    expect(mocks.acquireTokenSilent).not.toHaveBeenCalled();
    expect(mocks.beginAuthResolution).not.toHaveBeenCalled();
  });

  it('keeps syncing silently on interval for active sessions', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <MsalAuthBridge />
      </MemoryRouter>
    );

    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.acquireTokenSilent).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(61_000);
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.acquireTokenSilent).toHaveBeenCalledTimes(2);
  });

  it('clears local hosted token and forces re-login when silent refresh times out', async () => {
    mocks.isAuthenticated = false;
    mocks.acquireTokenSilent.mockRejectedValue({
      errorCode: 'timed_out',
      message: 'timed_out',
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <MsalAuthBridge />
      </MemoryRouter>
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.clearHostedToken).toHaveBeenCalledWith('user@example.com');
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(mocks.setAuthError).toHaveBeenCalledWith('Oturum suresi doldu. Lutfen tekrar giris yapin.');

    // Suppressed for same stale account while unauthenticated: should not loop.
    await vi.advanceTimersByTimeAsync(61_000);
    expect(mocks.acquireTokenSilent).toHaveBeenCalledTimes(1);
  });
});
