import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EntityManagement } from '../EntityManagement';
import { useUIStore } from '../../../store/uiStore';

const mocks = vi.hoisted(() => ({
  getCompanies: vi.fn(),
  createCompany: vi.fn(),
  createUser: vi.fn(),
  updateCompany: vi.fn(),
  deleteCompany: vi.fn(),
}));

vi.mock('../../../services/api', () => ({
  api: {
    admin: {
      getCompanies: mocks.getCompanies,
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
    mocks.createCompany.mockReset();
    mocks.createUser.mockReset();
    mocks.updateCompany.mockReset();
    mocks.deleteCompany.mockReset();
    mocks.getCompanies.mockResolvedValue([]);

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

    fireEvent.click(screen.getByRole('button', { name: /add entity/i }));
    expect(screen.getByRole('heading', { name: /add entity/i })).toBeTruthy();

    expect(screen.queryByPlaceholderText(/arkas\.com\.tr/i)).toBeNull();
  });

  it('allows submitting a new entity without a contact email', async () => {
    renderEntityManagement();

    await waitFor(() => expect(mocks.getCompanies).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /add entity/i }));
    expect(screen.getByRole('heading', { name: /add entity/i })).toBeTruthy();

    fireEvent.click(screen.getByLabelText(/create company admin user/i));
    fireEvent.change(screen.getByPlaceholderText(/nordic hamburg/i), {
      target: { value: 'Northwind Logistics' },
    });
    fireEvent.change(screen.getByPlaceholderText(/germany/i), {
      target: { value: 'Germany' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create entity/i }));

    expect(mocks.createCompany).toHaveBeenCalledTimes(1);
  });
});
