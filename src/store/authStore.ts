import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { User } from '../types';

export type AuthStatus = 'idle' | 'resolving' | 'error';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  authStatus: AuthStatus;
  authError: string | null;
  login: (user: User) => void;
  logout: () => void;
  beginAuthResolution: () => void;
  setAuthError: (message: string) => void;
  clearAuthFeedback: () => void;
}

// Mock initial user for dev convenience if needed, usually null
const initialUser: User | null = null; 

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: initialUser,
      isAuthenticated: !!initialUser,
      authStatus: 'idle',
      authError: null,
      login: (user) => set({ user, isAuthenticated: true, authStatus: 'idle', authError: null }),
      logout: () => set({ user: null, isAuthenticated: false, authStatus: 'idle', authError: null }),
      beginAuthResolution: () => set({ authStatus: 'resolving', authError: null }),
      setAuthError: (message) => set({ user: null, isAuthenticated: false, authStatus: 'error', authError: message }),
      clearAuthFeedback: () => set({ authStatus: 'idle', authError: null }),
    }),
    {
      name: 'avs_auth_store_v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        authStatus: state.authStatus,
        authError: state.authError,
      }),
    }
  )
);
