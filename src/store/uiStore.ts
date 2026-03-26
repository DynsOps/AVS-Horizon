import React from 'react';
import { create } from 'zustand';

interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface UIState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isDrawerOpen: boolean;
  drawerContent: React.ReactNode | null;
  openDrawer: (content: React.ReactNode) => void;
  closeDrawer: () => void;
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const playToastSound = (type: ToastMessage['type']) => {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = type === 'success' ? 760 : type === 'error' ? 300 : 520;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.24);

    setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 320);
  } catch {
    // Keep silent fallback for browsers that block audio context.
  }
};

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  isDrawerOpen: false,
  drawerContent: null,
  openDrawer: (content) => set({ isDrawerOpen: true, drawerContent: content }),
  closeDrawer: () => set({ isDrawerOpen: false, drawerContent: null }),
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(7);
    playToastSound(toast.type);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, toast.type === 'error' ? 6200 : 4800);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
