import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EntityManagement } from '../EntityManagement';
import { useUIStore } from '../../../store/uiStore';

const mocks = vi.hoisted(() => ({
  getCompanies: vi.fn(),
  getGroupProjtables: vi.fn(),
  createCompany: vi.fn(),
  createUser: vi.fn(),
  updateCompany: vi.fn(),
  deleteCompany: vi.fn(),
}));

vi.mock('../../../services/api', () => ({
  api: {
    admin: {
      getCompanies: mocks.getCompanies,
      getGroupProjtables: mocks.getGroupProjtables,
      createCompany: mocks.createCompany,
      createUser: mocks.createUser,
      updateCompany: mocks.updateCompany,
      deleteCompany: mocks.deleteCompany,
    },
  },
}));

const TestHost: React.FC = () => {
  const drawerContent = useUIStore((state) => state.drawerContent);

  return (
    <>
      <EntityManagement />
      {drawerContent ? <div>{drawerContent}</div> : null}
    </>
  );
};

const renderEntityManagement = () => render(<TestHost />);

describe('EntityManagement', () => {
  beforeEach(() => {
    mocks.getCompanies.mockReset();
    mocks.getGroupProjtables.mockReset();
    mocks.createCompany.mockReset();
    mocks.createUser.mockReset();
    mocks.updateCompany.mockReset();
    mocks.deleteCompany.mockReset();
    mocks.getCompanies.mockResolvedValue([]);
    mocks.getGroupProjtables.mockResolvedValue([
      { name: 'Northwind Logistics', dataAreaId: 'DAT', projId: 'PRJ-1001' },
    ]);

    useUIStore.setState({
      isDrawerOpen: false,
      drawerContent: null,
      dashboardCompanyId: '',
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

  it('does not render the allowlisted domains input', async () => {
    renderEntityManagement();

    await waitFor(() => expect(mocks.getCompanies).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add entity/i }));
    });
    expect(screen.getByRole('heading', { name: /add entity/i })).toBeTruthy();

    expect(screen.queryByPlaceholderText(/arkas\.com\.tr/i)).toBeNull();
  });

  it('allows submitting a new entity without a contact email', async () => {
    renderEntityManagement();

    await waitFor(() => expect(mocks.getCompanies).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add entity/i }));
    });
    expect(screen.getByRole('heading', { name: /add entity/i })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByLabelText(/create company admin user/i));
      fireEvent.change(screen.getByPlaceholderText(/type to search firm name/i), {
        target: { value: 'Northwind Logistics' },
      });
    });

    await waitFor(() => expect(mocks.getGroupProjtables).toHaveBeenCalled());
    await act(async () => {
      await waitFor(() => expect(screen.getByDisplayValue('DAT')).toBeTruthy());
      fireEvent.click(screen.getByRole('button', { name: /create entity/i }));
    });

    await waitFor(() => expect(mocks.createCompany).toHaveBeenCalledTimes(1));
  });
});
