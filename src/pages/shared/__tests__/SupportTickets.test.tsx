import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupportTickets } from '../SupportTickets';
import { SupportTicket, User } from '../../../types';

const mocks = vi.hoisted(() => ({
  user: null as User | null,
  addToast: vi.fn(),
  getMyTickets: vi.fn<[], Promise<SupportTicket[]>>(),
  createTicket: vi.fn(),
  replyToMyTicket: vi.fn(),
}));

vi.mock('../../../store/authStore', () => ({
  useAuthStore: () => ({ user: mocks.user }),
}));

vi.mock('../../../store/uiStore', () => ({
  useUIStore: () => ({ addToast: mocks.addToast }),
}));

vi.mock('../../../services/api', () => ({
  api: {
    support: {
      getMyTickets: mocks.getMyTickets,
      createTicket: mocks.createTicket,
      replyToMyTicket: mocks.replyToMyTicket,
    },
  },
}));

describe('SupportTickets', () => {
  beforeEach(() => {
    mocks.user = {
      id: 'u-1',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'user',
      permissions: ['create:support-ticket'],
      status: 'Active',
    };

    mocks.addToast.mockReset();
    mocks.getMyTickets.mockReset();
    mocks.createTicket.mockReset();
    mocks.replyToMyTicket.mockReset();

    mocks.getMyTickets.mockResolvedValue([
      {
        id: 'TCK-100001',
        createdByUserId: 'u-1',
        createdByEmail: 'jane@example.com',
        subject: 'Invoice mismatch',
        description: 'Please check invoice line item.',
        category: 'Invoice',
        status: 'Resolved',
        createdAt: '2026-04-16T10:00:00Z',
        replies: [
          {
            id: 'REP-1',
            ticketId: 'TCK-100001',
            authorUserId: 'u-sup',
            authorRole: 'supadmin',
            message: 'Mismatch corrected. Please create a new ticket for further requests.',
            createdAt: '2026-04-16T10:10:00Z',
          },
        ],
      },
    ]);
  });

  it('shows support response in selected ticket detail', async () => {
    render(<SupportTickets />);

    await waitFor(() => expect(mocks.getMyTickets).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('Invoice mismatch'));

    expect(await screen.findByText('Support Response')).toBeTruthy();
    expect(screen.getByText('Mismatch corrected. Please create a new ticket for further requests.')).toBeTruthy();
  });

  it('does not render chat send action for users', async () => {
    render(<SupportTickets />);

    await waitFor(() => expect(mocks.getMyTickets).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('Invoice mismatch'));

    expect(screen.queryByRole('button', { name: /send message/i })).toBeNull();
    expect(await screen.findByText('To add new details after closure, please open a new support ticket.')).toBeTruthy();
    expect(mocks.replyToMyTicket).not.toHaveBeenCalled();
  });

  it('filters ticket history by status', async () => {
    mocks.getMyTickets.mockResolvedValueOnce([
      {
        id: 'TCK-100001',
        createdByUserId: 'u-1',
        createdByEmail: 'jane@example.com',
        subject: 'Open request',
        description: 'Open issue',
        category: 'General',
        status: 'Open',
        createdAt: '2026-04-16T10:00:00Z',
        replies: [],
      },
      {
        id: 'TCK-100002',
        createdByUserId: 'u-1',
        createdByEmail: 'jane@example.com',
        subject: 'Resolved request',
        description: 'Resolved issue',
        category: 'Technical',
        status: 'Resolved',
        createdAt: '2026-04-16T11:00:00Z',
        replies: [],
      },
    ]);

    render(<SupportTickets />);
    await waitFor(() => expect(mocks.getMyTickets).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Resolved' }));

    expect(screen.queryByText('Open request')).toBeNull();
    expect(screen.getAllByText('Resolved request').length).toBeGreaterThan(0);
  });
});
