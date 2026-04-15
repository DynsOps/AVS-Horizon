import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Header } from '../Header';
import { AppShell } from '../../layouts/AppShell';
import { defaultNotifications, useUIStore } from '../../store/uiStore';
import { Company, User } from '../../types';

vi.mock('lucide-react', async () => {
  const actual = await vi.importActual<typeof import('lucide-react')>('lucide-react');
  return {
    ...actual,
    Bell: () => <svg data-testid="notifications-icon" />,
  };
});

const mocks = vi.hoisted(() => ({
  user: null as User | null,
  companies: [] as Company[],
  isDarkMode: false,
  toggleTheme: vi.fn(),
  getCompanies: vi.fn(),
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({ user: mocks.user }),
}));

vi.mock('../../store/themeStore', () => ({
  useThemeStore: () => ({
    isDarkMode: mocks.isDarkMode,
    toggleTheme: mocks.toggleTheme,
  }),
}));

vi.mock('../../services/api', () => ({
  api: {
    admin: {
      getCompanies: mocks.getCompanies,
    },
  },
}));

vi.mock('../../components/Sidebar', () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}));

const renderHeader = () =>
  render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>
  );

const renderShell = (initialEntry = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
          <Route path="/orders" element={<div>Orders page</div>} />
          <Route path="/profile" element={<div>Profile page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe('Header', () => {
  beforeEach(() => {
    mocks.user = null;
    mocks.companies = [];
    mocks.isDarkMode = false;
    mocks.toggleTheme.mockReset();
    mocks.getCompanies.mockReset();
    mocks.getCompanies.mockResolvedValue([]);
    (useUIStore as any).setState({
      isSidebarOpen: true,
      isDrawerOpen: false,
      drawerTitle: 'Details',
      drawerContent: null,
      toasts: [],
      dashboardCompanyId: '',
      notifications: [],
      confirmDialog: {
        isOpen: false,
        title: 'Confirm Action',
        message: '',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        tone: 'default',
      },
      confirmDialogResolver: null,
    });
  });

  it('notification badge stays hidden when there are no unread notifications', async () => {
    mocks.user = {
      id: 'u-1',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'admin',
      permissions: [],
      status: 'Active',
    };

    renderHeader();

    await waitFor(() => expect(screen.getByRole('button', { name: /jane/i })).toBeTruthy());

    const notificationButton = screen.getByTestId('notifications-icon').closest('button');

    expect(notificationButton).toBeTruthy();
    expect(notificationButton?.querySelector(':scope > span')).toBeNull();
  });

  it('seeds the app with unread notifications by default', () => {
    expect(defaultNotifications.length).toBeGreaterThan(0);
    expect(useUIStore.getInitialState().notifications).toEqual(defaultNotifications);
    expect(defaultNotifications.some((notification) => !notification.isRead)).toBe(true);
  });

  it('shows the unread badge when unread notifications exist', async () => {
    mocks.user = {
      id: 'u-1',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'admin',
      permissions: [],
      status: 'Active',
    };
    (useUIStore as any).setState({
      notifications: [
        {
          id: 'notif-1',
          title: 'Order approved',
          message: 'Order ORD-100 is approved.',
          targetRoute: '/orders',
          isRead: false,
        },
      ],
    });

    renderHeader();

    await waitFor(() => expect(screen.getByRole('button', { name: /jane/i })).toBeTruthy());

    const notificationButton = screen.getByTestId('notifications-icon').closest('button');

    expect(notificationButton).toBeTruthy();
    expect(notificationButton?.querySelector(':scope > span')).toBeTruthy();
  });

  it('opens the notifications drawer from the bell button', async () => {
    mocks.user = {
      id: 'u-4',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'admin',
      permissions: [],
      status: 'Active',
    };
    (useUIStore as any).setState({
      notifications: [
        {
          id: 'notif-1',
          title: 'Order approved',
          message: 'Order ORD-100 is approved.',
          targetRoute: '/orders',
          isRead: false,
        },
      ],
    });

    renderShell();

    fireEvent.click(await screen.findByRole('button', { name: /notifications/i }));

    expect(await screen.findByRole('dialog', { name: /notifications/i })).toBeTruthy();
    expect(screen.getByText(/order approved/i)).toBeTruthy();
    expect(screen.getByText(/order ord-100 is approved/i)).toBeTruthy();
  });

  it('focuses the drawer close button and closes on Escape', async () => {
    mocks.user = {
      id: 'u-6',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'admin',
      permissions: [],
      status: 'Active',
    };
    (useUIStore as any).setState({
      notifications: [
        {
          id: 'notif-1',
          title: 'Order approved',
          message: 'Order ORD-100 is approved.',
          targetRoute: '/orders',
          isRead: false,
        },
      ],
    });

    renderShell();

    fireEvent.click(await screen.findByRole('button', { name: /notifications/i }));

    const closeButton = await screen.findByRole('button', { name: /close notifications/i });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /notifications/i })).toBeNull();
    });
  });

  it('marks a notification as read, closes the drawer, and navigates to its target route', async () => {
    mocks.user = {
      id: 'u-5',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'admin',
      permissions: [],
      status: 'Active',
    };
    (useUIStore as any).setState({
      notifications: [
        {
          id: 'notif-1',
          title: 'Order approved',
          message: 'Order ORD-100 is approved.',
          targetRoute: '/orders',
          isRead: false,
        },
      ],
    });

    renderShell();

    fireEvent.click(await screen.findByRole('button', { name: /notifications/i }));
    fireEvent.click(await screen.findByRole('button', { name: /order approved/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /notifications/i })).toBeNull();
    });
    expect(await screen.findByText(/orders page/i)).toBeTruthy();
    expect((useUIStore as any).getState().notifications).toEqual([
      expect.objectContaining({ id: 'notif-1', isRead: true }),
    ]);
  });

  it('renders the company picker as readonly for admin users', async () => {
    mocks.user = {
      id: 'u-2',
      name: 'Portal Admin',
      email: 'admin@example.com',
      role: 'admin',
      permissions: [],
      status: 'Active',
    };
    mocks.companies = [
      {
        id: 'c-1',
        name: 'Northwind',
        type: 'Customer',
        country: 'Germany',
        contactEmail: 'ops@northwind.example',
        status: 'Active',
      },
    ];
    mocks.getCompanies.mockResolvedValue(mocks.companies);

    renderHeader();

    const picker = await screen.findByRole('combobox');
    expect((picker as HTMLSelectElement).disabled).toBe(true);
  });

  it('exposes My Profile and Sign Out from the profile menu', async () => {
    mocks.user = {
      id: 'u-3',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'user',
      companyId: 'c-1',
      permissions: [],
      status: 'Active',
    };

    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /jane/i }));

    expect(await screen.findByText(/my profile/i)).toBeTruthy();
    expect(await screen.findByText(/sign out/i)).toBeTruthy();
  });
});
