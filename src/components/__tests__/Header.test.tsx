import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Header } from '../Header';
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
  addToast: vi.fn(),
  setDashboardCompanyId: vi.fn(),
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

vi.mock('../../store/uiStore', () => ({
  useUIStore: () => ({
    addToast: mocks.addToast,
    dashboardCompanyId: '',
    setDashboardCompanyId: mocks.setDashboardCompanyId,
  }),
}));

vi.mock('../../services/api', () => ({
  api: {
    admin: {
      getCompanies: mocks.getCompanies,
    },
  },
}));

const renderHeader = () =>
  render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>
  );

describe('Header', () => {
  beforeEach(() => {
    mocks.user = null;
    mocks.companies = [];
    mocks.isDarkMode = false;
    mocks.addToast.mockReset();
    mocks.setDashboardCompanyId.mockReset();
    mocks.toggleTheme.mockReset();
    mocks.getCompanies.mockReset();
    mocks.getCompanies.mockResolvedValue([]);
  });

  it('hides the unread badge when there are no unread notifications', async () => {
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
