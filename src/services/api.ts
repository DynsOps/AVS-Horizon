
import { KPI, Order, Shipment, Invoice, Vessel, LogEntry, User, Company, Permission, SupportTicket, GuestRFQ, SuggestedItem, UserRole, AnalysisReport } from '../types';
import { getDefaultPermissionsForRole } from '../utils/rbac';
import { useAuthStore } from '../store/authStore';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const LOCAL_DB_KEY = 'avs_horizon_local_db_v2';
const MS_ACCESS_TOKEN_KEY = 'avs_ms_access_token';
const FUNCTION_API_BASE_URL = (import.meta.env.VITE_FUNCTION_API_BASE_URL || '').replace(/\/+$/, '');
const FORCE_FUNCTION_API = String(import.meta.env.VITE_FORCE_FUNCTION_API || '').toLowerCase() === 'true';
const DEV_BYPASS_AUTH = String(import.meta.env.VITE_DEV_BYPASS_AUTH || '').toLowerCase() === 'true';
const DISABLE_MOCK_DATA = String(import.meta.env.VITE_DISABLE_MOCK_DATA ?? 'true').toLowerCase() !== 'false';

const getStoredMicrosoftAccessToken = (): string => {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(MS_ACCESS_TOKEN_KEY) || '';
};

const shouldUseFunctionApi = (): boolean => {
  if (FUNCTION_API_BASE_URL) return true;
  if (DISABLE_MOCK_DATA) {
    throw new Error('Mock data is disabled. Set VITE_FUNCTION_API_BASE_URL and run Function API.');
  }
  if (FORCE_FUNCTION_API) return true;
  return false;
};

const ensureMockAllowed = (feature: string): void => {
  if (DISABLE_MOCK_DATA) {
    throw new Error(`Mock data is disabled for ${feature}. This endpoint must come from DB/API.`);
  }
};

const callFunctionApi = async <T = any>(path: string, init?: RequestInit): Promise<T> => {
  if (!FUNCTION_API_BASE_URL) {
    throw new Error('Function API base URL is not configured.');
  }

  const token = getStoredMicrosoftAccessToken();
  const devUserEmail = useAuthStore.getState().user?.email || '';
  const canUseDevBypass = DEV_BYPASS_AUTH && Boolean(devUserEmail);
  if (!token && !canUseDevBypass) {
    throw new Error('Microsoft access token is missing. Please sign in with Microsoft again.');
  }

  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const response = await fetch(`${FUNCTION_API_BASE_URL}/${normalizedPath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(canUseDevBypass ? { 'x-dev-user-email': devUserEmail } : {}),
      ...(init?.headers || {}),
    },
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error || payload?.message || `Function API request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
};

const callFunctionApiPublic = async <T = any>(path: string, init?: RequestInit): Promise<T> => {
  if (!FUNCTION_API_BASE_URL) {
    throw new Error('Function API base URL is not configured.');
  }

  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const response = await fetch(`${FUNCTION_API_BASE_URL}/${normalizedPath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error || payload?.message || `Function API request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
};

type LocalDbSnapshot = {
  companies: Company[];
  users: User[];
  passwords: Record<string, string>;
  microsoftTokens: MicrosoftTokenRecord[];
  supportTickets: SupportTicket[];
  guestRFQs: GuestRFQ[];
  analysisReports: AnalysisReport[];
  orders: Order[];
  shipments: Shipment[];
  invoices: Invoice[];
  vessels: Vessel[];
  logs: LogEntry[];
};

type MicrosoftTokenRecord = {
  userEmail: string;
  accessToken: string;
  scope: string;
  expiresAt?: string;
  updatedAt: string;
};

type SystemHealthService = {
  key: string;
  label: string;
  status: 'ok' | 'warn' | 'error';
  details?: string;
  latencyMs?: number | null;
};

type SystemHealthPayload = {
  generatedAt: string;
  services: SystemHealthService[];
  logs: LogEntry[];
};

// --- Initial Mock Data (Stateful) ---

let mockCompanies: Company[] = [
  { id: 'C-001', name: 'Global Shipping Co.', type: 'Customer', country: 'Singapore', contactEmail: 'ops@globalshipping.com', status: 'Active' },
  { id: 'S-001', name: 'Marine Supplies Ltd.', type: 'Supplier', country: 'Netherlands', contactEmail: 'sales@marinesupplies.com', status: 'Active' },
  { id: 'C-002', name: 'Pacific Liners', type: 'Customer', country: 'USA', contactEmail: 'admin@pacificliners.com', status: 'Inactive' },
  { id: 'C-003', name: 'NORDIC HAMBURG', type: 'Customer', country: 'Germany', contactEmail: 'ops@nordic-hamburg.com', status: 'Active' },
];

let mockUsers: User[] = [
  { 
    id: 'u1', 
    name: 'System Super Admin', 
    email: 'supadmin@avs.com', 
    role: 'supadmin', 
    status: 'Active', 
    permissions: getDefaultPermissionsForRole('supadmin'),
    powerBiAccess: 'editor',
    powerBiWorkspaceId: 'c3caf2ac-32d0-4dfa-a227-8461df9bf2d4',
    powerBiReportId: '1caac551-0e9f-45ad-9619-48e7d8f74c43',
    lastLogin: '2023-10-24T08:30:00Z',
    passwordLastChangedAt: '2023-10-01T08:30:00Z',
  },
  { 
    id: 'u2', 
    name: 'Portal Admin', 
    email: 'admin@avs.com', 
    role: 'admin', 
    status: 'Active', 
    permissions: getDefaultPermissionsForRole('admin'),
    powerBiAccess: 'editor',
    powerBiWorkspaceId: 'c3caf2ac-32d0-4dfa-a227-8461df9bf2d4',
    powerBiReportId: '1caac551-0e9f-45ad-9619-48e7d8f74c43',
    lastLogin: '2023-10-23T14:15:00Z',
    passwordLastChangedAt: '2023-10-05T14:15:00Z',
  },
  { 
    id: 'u3', 
    name: 'John Doe', 
    email: 'cust@shipping.com', 
    role: 'user', 
    companyId: 'C-001', 
    status: 'Active', 
    permissions: getDefaultPermissionsForRole('user'),
    powerBiAccess: 'viewer',
    powerBiWorkspaceId: 'c3caf2ac-32d0-4dfa-a227-8461df9bf2d4',
    powerBiReportId: '1caac551-0e9f-45ad-9619-48e7d8f74c43',
    lastLogin: '2023-10-24T09:00:00Z',
    passwordLastChangedAt: '2023-10-08T09:00:00Z',
  },
  { 
    id: 'u4', 
    name: 'Jane Smith', 
    email: 'supp@vendor.com', 
    role: 'user', 
    companyId: 'S-001', 
    status: 'Active', 
    permissions: [...getDefaultPermissionsForRole('user'), 'view:supplier'],
    powerBiAccess: 'viewer',
    powerBiWorkspaceId: 'c3caf2ac-32d0-4dfa-a227-8461df9bf2d4',
    powerBiReportId: '1caac551-0e9f-45ad-9619-48e7d8f74c43',
    lastLogin: '2023-10-24T11:00:00Z',
    passwordLastChangedAt: '2023-10-07T11:00:00Z',
  },
  {
    id: 'u5',
    name: 'Guest User',
    email: 'guest@global.com',
    role: 'user',
    isGuest: true,
    status: 'Active',
    permissions: ['submit:rfq', 'create:support-ticket'],
    powerBiAccess: 'none',
    powerBiWorkspaceId: '',
    powerBiReportId: '',
    lastLogin: '2023-10-24T12:00:00Z',
    passwordLastChangedAt: '2023-10-09T12:00:00Z',
  },
  {
    id: 'u6',
    name: 'Nordic Operations User',
    email: 'ops@nordic-hamburg.com',
    role: 'user',
    companyId: 'C-003',
    status: 'Active',
    permissions: getDefaultPermissionsForRole('user'),
    powerBiAccess: 'viewer',
    powerBiWorkspaceId: 'f9d80c47-f6d8-4b58-9bcb-95de4b6382a1',
    powerBiReportId: '29f3aaf6-45b0-4b46-9f14-4f35016b6d72',
    lastLogin: '2023-10-24T10:30:00Z',
    passwordLastChangedAt: '2023-10-06T10:30:00Z',
  },
  {
    id: 'u7',
    name: 'Nordic Company Admin',
    email: 'admin@nordic-hamburg.com',
    role: 'admin',
    companyId: '',
    status: 'Active',
    permissions: getDefaultPermissionsForRole('admin'),
    powerBiAccess: 'editor',
    powerBiWorkspaceId: 'f9d80c47-f6d8-4b58-9bcb-95de4b6382a1',
    powerBiReportId: '29f3aaf6-45b0-4b46-9f14-4f35016b6d72',
    lastLogin: '2023-10-24T10:55:00Z',
    passwordLastChangedAt: '2023-10-07T10:55:00Z',
  },
];

const mockPasswords: Record<string, string> = {
  u1: 'AVS-SUPADMIN-INIT',
  u2: 'AVS-ADMIN-INIT',
  u3: 'AVS-USER-INIT',
  u4: 'AVS-USER-INIT',
  u5: 'AVS-GUEST-INIT',
  u6: 'AVS-NORDIC-USER-INIT',
  u7: 'AVS-NORDIC-ADMIN-INIT',
};
let mockMicrosoftTokens: MicrosoftTokenRecord[] = [];

let mockSupportTickets: SupportTicket[] = [
  {
    id: 'TCK-900001',
    createdByUserId: 'u6',
    createdByEmail: 'ops@nordic-hamburg.com',
    subject: 'Nordic Aurora spare parts request follow-up',
    description: 'Need ETA confirmation for critical spare parts before docking.',
    category: 'Operational',
    status: 'In Progress',
    createdAt: '2023-10-12T08:15:00Z',
  },
  {
    id: 'TCK-900002',
    createdByUserId: 'u7',
    createdByEmail: 'admin@nordic-hamburg.com',
    subject: 'Invoice discrepancy for PO-9933',
    description: 'Please review invoice line item mismatch against RFQ.',
    category: 'Invoice',
    status: 'Open',
    createdAt: '2023-10-15T09:45:00Z',
  },
  {
    id: 'TCK-900003',
    createdByUserId: 'u2',
    createdByEmail: 'admin@avs.com',
    subject: 'Identity sync status',
    description: 'Validate nightly Entra ID sync completion logs.',
    category: 'Technical',
    status: 'Resolved',
    createdAt: '2023-10-14T07:20:00Z',
  },
];
let mockGuestRFQs: GuestRFQ[] = [
  {
    id: 'RFQ-800001',
    createdByUserId: 'u5',
    createdByEmail: 'guest@global.com',
    vesselName: 'Global Guest Vessel',
    port: 'Hamburg',
    details: 'Initial guest RFQ sample for onboarding.',
    suggestedItems: ['Marine Lubricant Pack x10', 'Deck Safety Kit x4'],
    attachments: [{ name: 'guest-rfq-spec.pdf', mimeType: 'application/pdf', sizeKb: 212 }],
    createdAt: '2023-10-11T10:00:00Z',
  },
];

let mockAnalysisReports: AnalysisReport[] = [
  {
    id: 'AR-001',
    name: 'Contracted Analysis',
    description: 'Category distribution for contracted usage.',
    permissionKey: 'view:analysis-report:contracted',
    isActive: true,
    createdAt: '2023-10-01T09:00:00Z',
  },
  {
    id: 'AR-002',
    name: 'BI Overview',
    description: 'Embedded Power BI overview report.',
    permissionKey: 'view:analysis-report:bi-overview',
    isActive: true,
    createdAt: '2023-10-02T09:00:00Z',
  },
];

let mockOrders: Order[] = [
  { id: 'ORD-001', companyId: 'C-001', vesselName: 'Avs Titan', port: 'Singapore', date: '2023-10-01', status: 'In Transit', amount: 15000, currency: 'USD' },
  { id: 'ORD-002', companyId: 'C-001', vesselName: 'Avs Neptune', port: 'Rotterdam', date: '2023-10-05', status: 'Pending', amount: 4500, currency: 'USD' },
  { id: 'ORD-003', companyId: 'C-002', vesselName: 'Avs Apollo', port: 'Houston', date: '2023-09-28', status: 'Delivered', amount: 8200, currency: 'USD' },
  { id: 'ORD-004', companyId: 'C-001', vesselName: 'Avs Titan', port: 'Jebel Ali', date: '2023-10-10', status: 'Approved', amount: 12300, currency: 'USD' },
  { id: 'ORD-005', companyId: 'C-002', vesselName: 'Avs Mercury', port: 'Shanghai', date: '2023-10-12', status: 'Cancelled', amount: 2000, currency: 'USD' },
  { id: 'ORD-006', companyId: 'C-003', vesselName: 'Nordic Aurora', port: 'Hamburg', date: '2023-10-03', status: 'Delivered', amount: 9700, currency: 'EUR' },
  { id: 'ORD-007', companyId: 'C-003', vesselName: 'Nordic Breeze', port: 'Rotterdam', date: '2023-10-08', status: 'Approved', amount: 12100, currency: 'EUR' },
  { id: 'ORD-008', companyId: 'C-003', vesselName: 'Nordic Aurora', port: 'Antwerp', date: '2023-10-12', status: 'In Transit', amount: 8600, currency: 'EUR' },
];

let mockShipments: Shipment[] = [
  { id: 'SHP-101', companyId: 'C-001', orderId: 'ORD-001', origin: 'Busan', destination: 'Singapore', eta: '2023-10-15', status: 'On Time' },
  { id: 'SHP-102', companyId: 'C-002', orderId: 'ORD-003', origin: 'Hamburg', destination: 'Houston', eta: '2023-09-30', status: 'Arrived' },
  { id: 'SHP-103', companyId: 'C-001', orderId: 'ORD-004', origin: 'Dubai', destination: 'Jebel Ali', eta: '2023-10-11', status: 'Delayed' },
  { id: 'SHP-104', companyId: 'C-003', orderId: 'ORD-007', origin: 'Oslo', destination: 'Rotterdam', eta: '2023-10-14', status: 'On Time' },
  { id: 'SHP-105', companyId: 'C-003', orderId: 'ORD-008', origin: 'Hamburg', destination: 'Antwerp', eta: '2023-10-16', status: 'Delayed' },
];

let mockInvoices: Invoice[] = [
  { id: 'INV-2023-001', companyId: 'C-001', reference: 'PO-9921', issueDate: '2023-09-01', dueDate: '2023-10-01', amount: 15000, status: 'Paid' },
  { id: 'INV-2023-005', companyId: 'C-002', reference: 'PO-9925', issueDate: '2023-09-15', dueDate: '2023-10-15', amount: 8200, status: 'Overdue' },
  { id: 'INV-2023-008', companyId: 'C-001', reference: 'PO-9928', issueDate: '2023-10-01', dueDate: '2023-10-31', amount: 4500, status: 'Pending' },
  { id: 'INV-2023-012', companyId: 'C-003', reference: 'PO-9932', issueDate: '2023-10-02', dueDate: '2023-11-02', amount: 9700, status: 'Paid' },
  { id: 'INV-2023-013', companyId: 'C-003', reference: 'PO-9933', issueDate: '2023-10-10', dueDate: '2023-11-10', amount: 12100, status: 'Pending' },
];

let mockVessels: Vessel[] = [
  { id: 'V-001', companyId: 'C-001', name: 'Avs Titan', imo: '9876543', type: 'Container' },
  { id: 'V-002', companyId: 'C-001', name: 'Avs Neptune', imo: '1234567', type: 'Bulker' },
  { id: 'V-003', companyId: 'C-002', name: 'Avs Apollo', imo: '5544332', type: 'Tanker' },
  { id: 'V-004', companyId: 'C-003', name: 'Nordic Aurora', imo: '4499112', type: 'Container' },
  { id: 'V-005', companyId: 'C-003', name: 'Nordic Breeze', imo: '4499113', type: 'Bulker' },
];

const mockLogs: LogEntry[] = [
  { id: 'L-1', timestamp: new Date().toISOString(), level: 'INFO', message: 'User login successful', service: 'AuthService' },
  { id: 'L-2', timestamp: new Date(Date.now() - 60000).toISOString(), level: 'WARN', message: 'High latency detected', service: 'OrderAPI' },
  { id: 'L-3', timestamp: new Date(Date.now() - 120000).toISOString(), level: 'INFO', message: 'Batch job completed', service: 'FinanceWorker' },
  { id: 'L-4', timestamp: new Date(Date.now() - 180000).toISOString(), level: 'ERROR', message: 'Database connection timeout', service: 'CoreDB' },
];

const makeSnapshot = (): LocalDbSnapshot => ({
  companies: [...mockCompanies],
  users: [...mockUsers],
  passwords: { ...mockPasswords },
  microsoftTokens: [...mockMicrosoftTokens],
  supportTickets: [...mockSupportTickets],
  guestRFQs: [...mockGuestRFQs],
  analysisReports: [...mockAnalysisReports],
  orders: [...mockOrders],
  shipments: [...mockShipments],
  invoices: [...mockInvoices],
  vessels: [...mockVessels],
  logs: [...mockLogs],
});

const hydrateFromLocalDb = () => {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(LOCAL_DB_KEY);
    if (!raw) {
      window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(makeSnapshot()));
      return;
    }
    const parsed = JSON.parse(raw) as Partial<LocalDbSnapshot>;
    if (parsed.companies) mockCompanies = parsed.companies;
    if (parsed.users) mockUsers = parsed.users;
    if (parsed.passwords) {
      Object.keys(mockPasswords).forEach((k) => delete mockPasswords[k]);
      Object.assign(mockPasswords, parsed.passwords);
    }
    if (parsed.microsoftTokens) mockMicrosoftTokens = parsed.microsoftTokens;
    if (parsed.supportTickets) mockSupportTickets = parsed.supportTickets;
    if (parsed.guestRFQs) mockGuestRFQs = parsed.guestRFQs;
    if (parsed.analysisReports) mockAnalysisReports = parsed.analysisReports;
    if (parsed.orders) mockOrders = parsed.orders;
    if (parsed.shipments) mockShipments = parsed.shipments;
    if (parsed.invoices) mockInvoices = parsed.invoices;
    if (parsed.vessels) mockVessels = parsed.vessels;
    if (parsed.logs) {
      mockLogs.length = 0;
      mockLogs.push(...parsed.logs);
    }
  } catch {
    // If parsing fails, keep defaults.
  }
};

const persistLocalDb = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(makeSnapshot()));
  } catch {
    // Ignore persistence errors in restricted environments.
  }
};

hydrateFromLocalDb();

const byCompanyScope = <T extends { companyId?: string }>(rows: T[], companyId?: string): T[] => {
  if (!companyId) return [];
  return rows.filter((row) => row.companyId === companyId);
};

const getActorRole = (): UserRole | undefined => {
  return useAuthStore.getState().user?.role;
};

const getActorUser = (): User | null => {
  return useAuthStore.getState().user;
};

const toPermissionSlug = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
};

const canManageRole = (actorRole: UserRole | undefined, targetRole: UserRole): boolean => {
  if (actorRole === 'supadmin') return true;
  if (actorRole === 'admin') return targetRole !== 'supadmin';
  return false;
};

const assertCanAssignRole = (targetRole: UserRole): void => {
  const actorRole = getActorRole();
  if (!canManageRole(actorRole, targetRole)) {
    throw new Error('Only supadmin can assign supadmin role.');
  }
};

const assertCanManageUser = (targetUser: User, action: 'update' | 'delete'): void => {
  const actor = getActorUser();
  const actorRole = actor?.role;
  if (!canManageRole(actorRole, targetUser.role)) {
    const actionText = action === 'delete' ? 'delete' : 'update';
    throw new Error(`Only supadmin can ${actionText} supadmin users.`);
  }
  if (actorRole === 'admin') {
    if (!actor?.companyId) throw new Error('Admin user is not linked to a company.');
    if ((targetUser.companyId || '') !== actor.companyId) {
      throw new Error('Admin can only manage users in their own company.');
    }
  }
};

const BOOTSTRAP_SUPADMIN_EMAILS = ['dynamicsops14@avsglobalsupply.com'];
const LOWEST_AUTO_PERMISSIONS: Permission[] = ['view:dashboard'];
const SUPADMIN_CONTROLLED_PERMISSIONS: Permission[] = [
  'system:settings',
  'view:finance',
  'view:sustainability',
  'view:business',
  'manage:reports',
];

const getEmailDomain = (email: string): string => {
  const parts = email.split('@');
  return parts.length > 1 ? parts[1].toLowerCase() : '';
};

const buildAutoProvisionedUser = (params: { email: string; role: UserRole; companyId?: string; permissions: Permission[] }): User => {
  const domain = getEmailDomain(params.email);
  const inferredName = params.email.split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();

  return {
    id: `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: inferredName || params.email,
    email: params.email,
    role: params.role,
    status: 'Active',
    companyId: params.companyId || '',
    permissions: params.permissions,
    isGuest: false,
    powerBiAccess: 'none',
    powerBiWorkspaceId: '',
    powerBiReportId: '',
    lastLogin: new Date().toISOString(),
    passwordLastChangedAt: new Date().toISOString(),
  };
};

const findExistingDomainUser = (domain: string): User | undefined => {
  return mockUsers.find((user) => getEmailDomain(user.email) === domain);
};

const createAutoAccessRequestTicket = (user: User): void => {
  const ticket: SupportTicket = {
    id: `TCK-${Date.now().toString().slice(-6)}`,
    createdByUserId: user.id,
    createdByEmail: user.email,
    subject: 'Auto access request created',
    description: `User ${user.email} was auto-provisioned with lowest permissions based on corporate domain match.`,
    category: 'Technical',
    status: 'Open',
    createdAt: new Date().toISOString(),
  };
  mockSupportTickets.unshift(ticket);
};

const assertPermissionGrantPolicy = (targetPermissions: Permission[], existingPermissions: Permission[] = []): void => {
  const actorRole = getActorRole();
  const actorPermissions = useAuthStore.getState().user?.permissions || [];
  if (actorRole === 'supadmin') return;

  if (actorRole === 'admin') {
    const actorPermissionSet = new Set(actorPermissions);
    const existingSet = new Set(existingPermissions);
    const disallowedByActor = targetPermissions.filter(
      (permission) => !actorPermissionSet.has(permission) && !existingSet.has(permission)
    );
    if (disallowedByActor.length > 0) {
      throw new Error(`Admin can only grant permissions they already have: ${disallowedByActor.join(', ')}`);
    }
  }

  const existingSet = new Set(existingPermissions);
  const disallowed = targetPermissions.filter(
    (permission) => SUPADMIN_CONTROLLED_PERMISSIONS.includes(permission) && !existingSet.has(permission)
  );
  if (disallowed.length > 0) {
    throw new Error(`Only supadmin can grant controlled permissions: ${disallowed.join(', ')}`);
  }
};

// --- API Implementation ---

export const api = {
  auth: {
    checkAccess: async (email: string, accessToken?: string): Promise<User> => {
      return api.auth.loginWithMicrosoft(email, accessToken);
    },
    loginWithMicrosoft: async (email: string, accessToken?: string): Promise<User> => {
      const normalizedEmail = email.trim().toLowerCase();
      if (FUNCTION_API_BASE_URL) {
        const token = accessToken || getStoredMicrosoftAccessToken();
        const canUseDevBypass = DEV_BYPASS_AUTH && Boolean(normalizedEmail);
        if (!token && !canUseDevBypass) {
          throw new Error('Microsoft access token is missing. Please sign in with Microsoft again.');
        }

        const response = await fetch(`${FUNCTION_API_BASE_URL}/api/auth/me`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(canUseDevBypass ? { 'x-dev-user-email': normalizedEmail } : {}),
          },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || `Function API request failed (${response.status})`);
        }
        const backendUser = payload.user as User;
        const existingIdx = mockUsers.findIndex((u) => u.id === backendUser.id);
        if (existingIdx === -1) {
          mockUsers.push({ ...backendUser });
        } else {
          mockUsers[existingIdx] = { ...mockUsers[existingIdx], ...backendUser };
        }
        persistLocalDb();
        return { ...backendUser };
      }

      ensureMockAllowed('Microsoft login');
      await delay(800);
      throw new Error('No Function API configured.');
    },
    storeMicrosoftToken: async (payload: { userEmail: string; accessToken: string; scope: string; expiresAt?: string }): Promise<void> => {
      await delay(100);
      const normalizedEmail = payload.userEmail.trim().toLowerCase();
      const nextToken: MicrosoftTokenRecord = {
        userEmail: normalizedEmail,
        accessToken: payload.accessToken,
        scope: payload.scope,
        expiresAt: payload.expiresAt,
        updatedAt: new Date().toISOString(),
      };
      const idx = mockMicrosoftTokens.findIndex((token) => token.userEmail === normalizedEmail);
      if (idx === -1) {
        mockMicrosoftTokens.push(nextToken);
      } else {
        mockMicrosoftTokens[idx] = nextToken;
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(MS_ACCESS_TOKEN_KEY, payload.accessToken);
      }
      persistLocalDb();
    },
    getMicrosoftToken: async (userEmail: string): Promise<MicrosoftTokenRecord | null> => {
      await delay(50);
      const normalizedEmail = userEmail.trim().toLowerCase();
      return mockMicrosoftTokens.find((token) => token.userEmail === normalizedEmail) || null;
    },
    clearMicrosoftToken: async (userEmail?: string): Promise<void> => {
      await delay(50);
      if (userEmail) {
        const normalizedEmail = userEmail.trim().toLowerCase();
        mockMicrosoftTokens = mockMicrosoftTokens.filter((token) => token.userEmail !== normalizedEmail);
      } else {
        mockMicrosoftTokens = [];
      }
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(MS_ACCESS_TOKEN_KEY);
      }
      persistLocalDb();
    },
    loginWithPassword: async (email: string, password: string): Promise<User> => {
      if (FUNCTION_API_BASE_URL) {
        const normalizedEmail = email.trim().toLowerCase();
        const payload = await callFunctionApiPublic<{ user: User }>('api/auth/login-password', {
          method: 'POST',
          body: JSON.stringify({
            email: normalizedEmail,
            password,
          }),
        });

        const backendUser = payload.user;
        const existingIdx = mockUsers.findIndex((u) => u.id === backendUser.id);
        if (existingIdx === -1) {
          mockUsers.push({ ...backendUser });
        } else {
          mockUsers[existingIdx] = { ...mockUsers[existingIdx], ...backendUser };
        }
        persistLocalDb();
        return { ...backendUser };
      }

      ensureMockAllowed('Password login');
      await delay(700);
      const normalizedEmail = email.trim().toLowerCase();
      const user = mockUsers.find((u) => u.email.toLowerCase() === normalizedEmail);

      if (!user) {
        throw new Error('Invalid email or password.');
      }
      if (user.status !== 'Active') {
        throw new Error('This account is not active.');
      }
      if (!password) {
        throw new Error('Password is required.');
      }
      if (mockPasswords[user.id] !== password) {
        throw new Error('Invalid email or password.');
      }

      user.lastLogin = new Date().toISOString();
      persistLocalDb();
      return { ...user };
    },
    // Backward compatible alias (used by earlier screens)
    login: async (email: string): Promise<User> => {
      return api.auth.loginWithMicrosoft(email);
    },
    updateProfile: async (userId: string, data: Partial<User>): Promise<User> => {
        if (FUNCTION_API_BASE_URL) {
          const storedToken = getStoredMicrosoftAccessToken();
          const payload = storedToken
            ? await callFunctionApi<{ user: User }>('api/auth/profile', {
                method: 'PATCH',
                body: JSON.stringify({
                  name: (data.name || '').trim(),
                }),
              })
            : await callFunctionApiPublic<{ user: User }>('api/auth/profile-password', {
                method: 'PATCH',
                body: JSON.stringify({
                  email: (useAuthStore.getState().user?.email || '').trim().toLowerCase(),
                  name: (data.name || '').trim(),
                }),
              });
          const updatedUser = payload.user;
          const index = mockUsers.findIndex((u) => u.id === userId);
          if (index !== -1) {
            mockUsers[index] = { ...mockUsers[index], ...updatedUser };
            persistLocalDb();
          }
          return { ...updatedUser };
        }
        ensureMockAllowed('Profile update');
        await delay(500);
        const index = mockUsers.findIndex(u => u.id === userId);
        if (index !== -1) {
            if (data.email && data.email.toLowerCase() !== mockUsers[index].email.toLowerCase()) {
              throw new Error('Email is managed by Microsoft identity and cannot be changed here.');
            }
            const { email, ...safeUpdates } = data;
            mockUsers[index] = { ...mockUsers[index], ...safeUpdates };
            persistLocalDb();
            return mockUsers[index];
        }
        throw new Error('User not found');
    },
    changePassword: async (userId: string, currentPassword: string, newPassword: string): Promise<void> => {
      if (FUNCTION_API_BASE_URL) {
        const storedToken = getStoredMicrosoftAccessToken();
        if (storedToken) {
          await callFunctionApi('api/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({
              currentPassword,
              newPassword,
            }),
          });
        } else {
          const activeUser = useAuthStore.getState().user;
          if (!activeUser?.email) {
            throw new Error('Authenticated user context is missing.');
          }
          await callFunctionApiPublic('api/auth/change-password-password', {
            method: 'POST',
            body: JSON.stringify({
              email: activeUser.email,
              currentPassword,
              newPassword,
            }),
          });
        }

        const user = mockUsers.find((u) => u.id === userId);
        if (user) {
          user.passwordLastChangedAt = new Date().toISOString();
          user.temporaryPassword = undefined;
          persistLocalDb();
        }
        return;
      }

      ensureMockAllowed('Password change');
      await delay(500);
      const user = mockUsers.find((u) => u.id === userId);
      if (!user) throw new Error('User not found');
      if (!currentPassword || !newPassword) throw new Error('Current and new password are required.');
      if (newPassword.length < 8) throw new Error('New password must be at least 8 characters.');
      if (mockPasswords[userId] !== currentPassword) throw new Error('Current password is incorrect.');
      if (currentPassword === newPassword) throw new Error('New password must be different from current password.');

      mockPasswords[userId] = newPassword;
      user.passwordLastChangedAt = new Date().toISOString();
      user.temporaryPassword = undefined;
      persistLocalDb();
    },
  },
  admin: {
    getUsers: async (): Promise<User[]> => {
      if (shouldUseFunctionApi()) {
        const payload = await callFunctionApi<{ users: User[] }>('api/identity/users');
        mockUsers = payload.users.map((u) => ({ ...u }));
        persistLocalDb();
        return payload.users;
      }
      await delay(400);
      const actor = getActorUser();
      if (actor?.role === 'admin') {
        return mockUsers.filter((u) => (u.companyId || '') === (actor.companyId || ''));
      }
      return [...mockUsers];
    },
    createUser: async (user: Omit<User, 'id'>): Promise<{ user: User; temporaryPassword: string }> => {
        if (shouldUseFunctionApi()) {
            const payload = await callFunctionApi<{ user: User; temporaryPassword: string }>('api/identity/users', {
                method: 'POST',
                body: JSON.stringify(user),
            });
            const createdUser = payload.user;
            const existingIdx = mockUsers.findIndex((u) => u.id === createdUser.id);
            if (existingIdx === -1) mockUsers.push({ ...createdUser });
            else mockUsers[existingIdx] = { ...createdUser };
            persistLocalDb();
            return payload;
        }
        await delay(500);
        assertCanAssignRole(user.role);
        const actor = getActorUser();
        const sanitizedIsGuest = user.role === 'user' ? Boolean(user.isGuest) : false;
        if (actor?.role === 'admin') {
            if (!actor.companyId) throw new Error('Admin user is not linked to a company.');
            if (user.role === 'user' && sanitizedIsGuest) throw new Error('Admin cannot create guest users.');
            if (user.companyId && user.companyId !== actor.companyId) throw new Error('Admin can only create users for their own company.');
        }
        const requestedPermissions = user.permissions?.length ? user.permissions : getDefaultPermissionsForRole(user.role);
        assertPermissionGrantPolicy(requestedPermissions);
        const emailExists = mockUsers.some(u => u.email.toLowerCase() === user.email.toLowerCase());
        if (emailExists) {
            throw new Error('A user with this email already exists.');
        }
        const hasCompanyAdminPermissions = Boolean(user.permissions?.includes('manage:users') || user.permissions?.includes('manage:companies'));
        const scopedCompanyId = actor?.role === 'admin' ? (actor.companyId || '') : (user.companyId || '');
        const companyRequired = (user.role === 'user' && !sanitizedIsGuest) || user.role === 'admin';
        if (companyRequired && !scopedCompanyId) {
            throw new Error('Company is required for role "admin" and non-guest "user".');
        }
        if (user.role === 'user' && hasCompanyAdminPermissions && (!scopedCompanyId || sanitizedIsGuest)) {
            throw new Error('Company Admin users must be non-guest and linked to a company.');
        }
        const temporaryPassword = `AVS-${Math.random().toString(36).slice(-8)}`;
        const newUser: User = { 
            ...user, 
            id: `u-${Date.now()}`, 
            temporaryPassword,
            permissions: requestedPermissions,
            isGuest: sanitizedIsGuest,
            companyId: user.role === 'supadmin' ? '' : scopedCompanyId,
            passwordLastChangedAt: new Date().toISOString(),
        };
        mockUsers.push(newUser);
        mockPasswords[newUser.id] = temporaryPassword;
        persistLocalDb();
        return { user: newUser, temporaryPassword };
    },
    updateUser: async (id: string, updates: Partial<User>): Promise<User> => {
        if (shouldUseFunctionApi()) {
            await callFunctionApi<{ success: boolean }>(`api/identity/users/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(updates),
            });
            const refreshed = await api.admin.getUsers();
            const updated = refreshed.find((u) => u.id === id);
            if (!updated) throw new Error('User not found after update.');
            return updated;
        }
        await delay(400);
        const index = mockUsers.findIndex(u => u.id === id);
        if (index === -1) throw new Error("User not found");

        const currentUser = mockUsers[index];
        assertCanManageUser(currentUser, 'update');
        const normalizedEmail = updates.email?.trim().toLowerCase();
        if (normalizedEmail && normalizedEmail !== currentUser.email.toLowerCase()) {
            const emailExists = mockUsers.some(u => u.id !== id && u.email.toLowerCase() === normalizedEmail);
            if (emailExists) throw new Error('A user with this email already exists.');
        }

        const targetRole = updates.role || currentUser.role;
        assertCanAssignRole(targetRole);
        const actor = getActorUser();
        const targetIsGuest = targetRole === 'user'
            ? (typeof updates.isGuest === 'boolean' ? updates.isGuest : currentUser.isGuest)
            : false;
        const targetCompanyId = updates.companyId ?? currentUser.companyId;
        if (actor?.role === 'admin') {
            if (!actor.companyId) throw new Error('Admin user is not linked to a company.');
            if (targetRole === 'user' && targetIsGuest) throw new Error('Admin cannot assign guest scope.');
            if (targetCompanyId && targetCompanyId !== actor.companyId) throw new Error('Admin can only assign users to their own company.');
        }
        const scopedTargetCompanyId = actor?.role === 'admin' ? (actor.companyId || '') : (targetCompanyId || '');
        if ((targetRole === 'user' && !targetIsGuest && !scopedTargetCompanyId) || (targetRole === 'admin' && !scopedTargetCompanyId)) {
            throw new Error('Company is required for role "admin" and non-guest "user".');
        }

        const roleSafeCompanyId = targetRole === 'supadmin' ? '' : (targetRole === 'user' && targetIsGuest ? '' : scopedTargetCompanyId);
        const nextPermissions = updates.permissions?.length
            ? updates.permissions
            : (updates.role && updates.role !== currentUser.role ? getDefaultPermissionsForRole(updates.role) : currentUser.permissions);
        assertPermissionGrantPolicy(nextPermissions, currentUser.permissions);
        const hasCompanyAdminPermissions = Boolean(nextPermissions?.includes('manage:users') || nextPermissions?.includes('manage:companies'));
        if (targetRole === 'user' && hasCompanyAdminPermissions && (!targetCompanyId || targetIsGuest)) {
            throw new Error('Company Admin users must be non-guest and linked to a company.');
        }
        mockUsers[index] = {
            ...currentUser,
            ...updates,
            email: normalizedEmail || currentUser.email,
            companyId: roleSafeCompanyId,
            permissions: nextPermissions,
        };
        persistLocalDb();
        return mockUsers[index];
    },
    deleteUser: async (id: string): Promise<void> => {
      if (shouldUseFunctionApi()) {
        await callFunctionApi<{ success: boolean }>(`api/identity/users/${id}`, {
          method: 'DELETE',
        });
        mockUsers = mockUsers.filter((u) => u.id !== id);
        persistLocalDb();
        return;
      }
      await delay(400);
      const targetUser = mockUsers.find((u) => u.id === id);
      if (!targetUser) throw new Error('User not found');
      assertCanManageUser(targetUser, 'delete');
      mockUsers = mockUsers.filter(u => u.id !== id);
      mockMicrosoftTokens = mockMicrosoftTokens.filter((token) => token.userEmail !== targetUser.email.toLowerCase());
      persistLocalDb();
    },
    resetUserPassword: async (id: string): Promise<{ email: string; temporaryPassword: string }> => {
      if (shouldUseFunctionApi()) {
        const payload = await callFunctionApi<{ email: string; temporaryPassword: string }>(`api/identity/users/${id}/reset-password`, {
          method: 'POST',
        });
        const user = mockUsers.find((u) => u.id === id);
        if (user) {
          user.temporaryPassword = payload.temporaryPassword;
          user.passwordLastChangedAt = new Date().toISOString();
        }
        persistLocalDb();
        return payload;
      }
      await delay(300);
      const targetUser = mockUsers.find((u) => u.id === id);
      if (!targetUser) throw new Error('User not found');
      assertCanManageUser(targetUser, 'update');
      const temporaryPassword = `AVS-${Math.random().toString(36).slice(-8)}`;
      targetUser.temporaryPassword = temporaryPassword;
      targetUser.passwordLastChangedAt = new Date().toISOString();
      mockPasswords[id] = temporaryPassword;
      persistLocalDb();
      return { email: targetUser.email, temporaryPassword };
    },
    getCompanies: async (): Promise<Company[]> => {
        if (shouldUseFunctionApi()) {
            const payload = await callFunctionApi<{ companies: Company[] }>('api/identity/companies');
            mockCompanies = payload.companies.map((c) => ({ ...c }));
            persistLocalDb();
            return payload.companies;
        }
        await delay(400);
        const actor = getActorUser();
        if (actor?.role === 'admin') {
            return mockCompanies.filter((c) => c.id === actor.companyId);
        }
        return [...mockCompanies];
    },
    createCompany: async (company: Omit<Company, 'id'>): Promise<Company> => {
        const actor = getActorUser();
        if (actor?.role === 'admin') {
            throw new Error('Admin cannot create companies.');
        }
        if (shouldUseFunctionApi()) {
            const payload = await callFunctionApi<{ company: Company }>('api/identity/companies', {
                method: 'POST',
                body: JSON.stringify(company),
            });
            mockCompanies.push({ ...payload.company });
            persistLocalDb();
            return payload.company;
        }
        await delay(500);
        const newCompany = { ...company, id: `${company.type === 'Customer' ? 'C' : 'S'}-${Date.now().toString().slice(-3)}` };
        mockCompanies.push(newCompany);
        persistLocalDb();
        return newCompany;
    },
    updateCompany: async (id: string, updates: Partial<Company>): Promise<Company> => {
        const actor = getActorUser();
        if (actor?.role === 'admin' && actor.companyId !== id) {
            throw new Error('Admin can only manage their own company.');
        }
        if (shouldUseFunctionApi()) {
            await callFunctionApi<{ success: boolean }>(`api/identity/companies/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(updates),
            });
            const refreshed = await api.admin.getCompanies();
            const updated = refreshed.find((c) => c.id === id);
            if (!updated) throw new Error('Company not found after update.');
            return updated;
        }
        await delay(400);
        const index = mockCompanies.findIndex(c => c.id === id);
        if (index === -1) throw new Error("Company not found");
        mockCompanies[index] = { ...mockCompanies[index], ...updates };
        persistLocalDb();
        return mockCompanies[index];
    },
    deleteCompany: async (id: string): Promise<void> => {
        const actor = getActorUser();
        if (actor?.role === 'admin') {
            throw new Error('Admin cannot delete companies.');
        }
        if (shouldUseFunctionApi()) {
            await callFunctionApi<{ success: boolean }>(`api/identity/companies/${id}`, {
                method: 'DELETE',
            });
            mockCompanies = mockCompanies.filter(c => c.id !== id);
            persistLocalDb();
            return;
        }
        await delay(400);
        mockCompanies = mockCompanies.filter(c => c.id !== id);
        persistLocalDb();
    },
    getAnalysisReports: async (): Promise<AnalysisReport[]> => {
      if (shouldUseFunctionApi()) {
        const payload = await callFunctionApi<{ reports: AnalysisReport[] }>('api/identity/reports');
        mockAnalysisReports = payload.reports.map((report) => ({ ...report }));
        persistLocalDb();
        return payload.reports;
      }
      await delay(250);
      return [...mockAnalysisReports].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    createAnalysisReport: async (payload: { name: string; description?: string; embedUrl?: string; workspaceId?: string; reportId?: string; datasetId?: string; defaultRoles?: string[] }): Promise<AnalysisReport> => {
      if (shouldUseFunctionApi()) {
        const created = await callFunctionApi<{ report: AnalysisReport }>('api/identity/reports', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        mockAnalysisReports.push({ ...created.report });
        persistLocalDb();
        return created.report;
      }
      await delay(300);
      const actor = getActorUser();
      if (actor?.role !== 'supadmin') {
        throw new Error('Only supadmin can create analysis reports.');
      }
      const normalizedName = payload.name.trim();
      if (!normalizedName) throw new Error('Report name is required.');
      const slug = toPermissionSlug(normalizedName);
      if (!slug) throw new Error('Report name must include alphanumeric characters.');
      const permissionKey = `view:analysis-report:${slug}` as Permission;
      const exists = mockAnalysisReports.some((r) => r.permissionKey === permissionKey || r.name.toLowerCase() === normalizedName.toLowerCase());
      if (exists) throw new Error('A report with the same name/permission already exists.');

      const report: AnalysisReport = {
        id: `AR-${Date.now().toString().slice(-6)}`,
        name: normalizedName,
        description: payload.description?.trim() || '',
        permissionKey,
        embedUrl: payload.embedUrl?.trim() || '',
        workspaceId: payload.workspaceId?.trim() || '',
        reportId: payload.reportId?.trim() || '',
        datasetId: payload.datasetId?.trim() || '',
        defaultRoles: Array.isArray(payload.defaultRoles) ? payload.defaultRoles : [],
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      mockAnalysisReports.push(report);
      persistLocalDb();
      return report;
    },
    updateAnalysisReport: async (id: string, payload: { name: string; description?: string; embedUrl?: string; workspaceId?: string; reportId?: string; datasetId?: string; defaultRoles?: string[] }): Promise<AnalysisReport> => {
      if (shouldUseFunctionApi()) {
        const updated = await callFunctionApi<{ report: AnalysisReport }>(`api/identity/reports/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        const target = mockAnalysisReports.find((r) => r.id === id);
        mockAnalysisReports = mockAnalysisReports.map((r) => (r.id === id ? { ...updated.report } : r));
        if (target && target.permissionKey !== updated.report.permissionKey) {
          mockUsers = mockUsers.map((u) => ({
            ...u,
            permissions: u.permissions.map((p) => (p === target.permissionKey ? updated.report.permissionKey : p)),
          }));
        }
        persistLocalDb();
        return updated.report;
      }
      await delay(250);
      const actor = getActorUser();
      if (actor?.role !== 'supadmin') {
        throw new Error('Only supadmin can update analysis reports.');
      }
      const target = mockAnalysisReports.find((r) => r.id === id);
      if (!target) throw new Error('Report not found.');

      const normalizedName = payload.name.trim();
      if (!normalizedName) throw new Error('Report name is required.');
      const slug = toPermissionSlug(normalizedName);
      if (!slug) throw new Error('Report name must include alphanumeric characters.');
      const nextPermissionKey = `view:analysis-report:${slug}` as Permission;
      const exists = mockAnalysisReports.some(
        (r) =>
          r.id !== id &&
          (r.permissionKey === nextPermissionKey || r.name.toLowerCase() === normalizedName.toLowerCase())
      );
      if (exists) throw new Error('A report with the same name/permission already exists.');

      const updated: AnalysisReport = {
        ...target,
        name: normalizedName,
        description: payload.description?.trim() || '',
        embedUrl: payload.embedUrl?.trim() || '',
        workspaceId: payload.workspaceId?.trim() || '',
        reportId: payload.reportId?.trim() || '',
        datasetId: payload.datasetId?.trim() || '',
        defaultRoles: Array.isArray(payload.defaultRoles) ? payload.defaultRoles : [],
        permissionKey: nextPermissionKey,
      };
      mockAnalysisReports = mockAnalysisReports.map((r) => (r.id === id ? updated : r));
      if (target.permissionKey !== updated.permissionKey) {
        mockUsers = mockUsers.map((u) => ({
          ...u,
          permissions: u.permissions.map((p) => (p === target.permissionKey ? updated.permissionKey : p)),
        }));
      }
      persistLocalDb();
      return updated;
    },
    deleteAnalysisReport: async (id: string): Promise<void> => {
      if (shouldUseFunctionApi()) {
        await callFunctionApi<{ success: boolean }>(`api/identity/reports/${id}`, {
          method: 'DELETE',
        });
        const target = mockAnalysisReports.find((r) => r.id === id);
        mockAnalysisReports = mockAnalysisReports.filter((r) => r.id !== id);
        if (target) {
          mockUsers = mockUsers.map((u) => ({
            ...u,
            permissions: u.permissions.filter((p) => p !== target.permissionKey),
          }));
        }
        persistLocalDb();
        return;
      }
      await delay(250);
      const actor = getActorUser();
      if (actor?.role !== 'supadmin') {
        throw new Error('Only supadmin can delete analysis reports.');
      }
      const target = mockAnalysisReports.find((r) => r.id === id);
      if (!target) throw new Error('Report not found.');

      mockAnalysisReports = mockAnalysisReports.filter((r) => r.id !== id);
      mockUsers = mockUsers.map((u) => ({
        ...u,
        permissions: u.permissions.filter((p) => p !== target.permissionKey),
      }));
      persistLocalDb();
    },
    getSystemHealth: async (): Promise<SystemHealthPayload> => {
      if (shouldUseFunctionApi()) {
        return callFunctionApi<SystemHealthPayload>('api/system-health');
      }
      ensureMockAllowed('System health');
      await delay(250);
      return {
        generatedAt: new Date().toISOString(),
        services: [
          { key: 'auth-service', label: 'Auth Service', status: 'ok', details: 'Mock auth is active.', latencyMs: null },
          { key: 'core-db', label: 'Core DB', status: 'warn', details: 'Using local mock store.', latencyMs: null },
          { key: 'function-runtime', label: 'Function Runtime', status: 'ok', details: 'Frontend runtime active.', latencyMs: null },
          { key: 'identity-module', label: 'Identity Module', status: 'ok', details: 'Mock identity is loaded.', latencyMs: null },
        ],
        logs: mockLogs,
      };
    },
    getSystemLogs: async (): Promise<LogEntry[]> => {
      if (shouldUseFunctionApi()) {
        try {
          const payload = await api.admin.getSystemHealth();
          return payload.logs;
        } catch {
          ensureMockAllowed('System logs');
          return mockLogs;
        }
      }
      ensureMockAllowed('System logs');
      await delay(300);
      return mockLogs;
    },
  },
  customer: {
    getAnalysisReports: async (): Promise<AnalysisReport[]> => {
      if (shouldUseFunctionApi()) {
        const payload = await callFunctionApi<{ reports: AnalysisReport[] }>('api/reports/analysis');
        mockAnalysisReports = payload.reports.map((report) => ({ ...report }));
        persistLocalDb();
        return payload.reports;
      }
      ensureMockAllowed('Analysis reports');
      await delay(200);
      return [...mockAnalysisReports].filter((r) => r.isActive);
    },
    getKPIs: async (companyId?: string): Promise<KPI[]> => {
      ensureMockAllowed('Customer KPIs');
      await delay(500);
      const scopedOrders = byCompanyScope(mockOrders, companyId);
      const scopedShipments = byCompanyScope(mockShipments, companyId);
      return [
        { label: 'Total Spend (YTD)', value: '$1.2M', trend: 12, status: 'up' },
        { label: 'Open Orders', value: scopedOrders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length.toString(), trend: -5, status: 'neutral' },
        { label: 'Active Shipments', value: scopedShipments.filter(s => s.status !== 'Arrived').length.toString(), trend: 2, status: 'up' },
        { label: 'Avg. Delay', value: '1.2 Days', trend: -10, status: 'down' },
      ];
    },
    getOrders: async (companyId?: string): Promise<Order[]> => {
      ensureMockAllowed('Customer orders');
      await delay(600);
      return byCompanyScope(mockOrders, companyId);
    },
    getHistoricalOrders: async (companyId?: string): Promise<Order[]> => {
      ensureMockAllowed('Historical orders');
      await delay(450);
      return byCompanyScope(mockOrders, companyId)
        .filter((o) => o.status === 'Delivered' || o.status === 'Cancelled')
        .sort((a, b) => b.date.localeCompare(a.date));
    },
    createOrder: async (order: Omit<Order, 'id'>): Promise<Order> => {
        ensureMockAllowed('Create order');
        await delay(500);
        const newOrder = { ...order, id: `ORD-${Date.now().toString().slice(-4)}` };
        mockOrders.unshift(newOrder); // Add to top
        persistLocalDb();
        return newOrder;
    },
    getFleet: async (companyId?: string): Promise<Vessel[]> => {
      ensureMockAllowed('Fleet');
      await delay(400);
      return byCompanyScope(mockVessels, companyId);
    },
    getShipments: async (companyId?: string): Promise<Shipment[]> => {
      ensureMockAllowed('Shipments');
      await delay(500);
      return byCompanyScope(mockShipments, companyId);
    },
    getInvoices: async (companyId?: string): Promise<Invoice[]> => {
      ensureMockAllowed('Invoices');
      await delay(500);
      return byCompanyScope(mockInvoices, companyId);
    },
    getPortFees: async (companyId?: string): Promise<Array<{ port: string; vesselCount: number; totalFee: number; currency: string }>> => {
      ensureMockAllowed('Port fees');
      await delay(350);
      const scopedOrders = byCompanyScope(mockOrders, companyId);
      const byPort = scopedOrders.reduce<Record<string, { vesselNames: Set<string>; totalAmount: number }>>((acc, order) => {
        const existing = acc[order.port] || { vesselNames: new Set<string>(), totalAmount: 0 };
        existing.vesselNames.add(order.vesselName);
        existing.totalAmount += order.amount;
        acc[order.port] = existing;
        return acc;
      }, {});

      return Object.entries(byPort)
        .map(([port, info]) => ({
          port,
          vesselCount: info.vesselNames.size,
          totalFee: Math.round(info.totalAmount * 0.035),
          currency: 'USD',
        }))
        .sort((a, b) => b.totalFee - a.totalFee);
    },
    getContractedConsumptionReport: async (companyId?: string): Promise<Array<{ month: string; consumed: number; contracted: number }>> => {
      ensureMockAllowed('Consumption report');
      await delay(400);
      const scopedOrders = byCompanyScope(mockOrders, companyId);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      return months.map((month, idx) => {
        const consumed = scopedOrders.reduce((sum, o) => sum + Math.floor(o.amount / (idx + 8)), 0);
        const contracted = consumed + 1200 - idx * 100;
        return { month, consumed, contracted };
      });
    },
    getContractedAnalysisReport: async (companyId?: string): Promise<Array<{ category: string; value: number }>> => {
      ensureMockAllowed('Contracted analysis report');
      await delay(350);
      const scopedOrders = byCompanyScope(mockOrders, companyId);
      const total = scopedOrders.reduce((sum, o) => sum + o.amount, 0) || 1;
      const fuel = Math.round(total * 0.38);
      const spare = Math.round(total * 0.22);
      const provisions = Math.round(total * 0.20);
      const portFees = Math.round(total * 0.20);
      return [
        { category: 'Fuel', value: fuel },
        { category: 'Spare Parts', value: spare },
        { category: 'Provisions', value: provisions },
        { category: 'Port Fees', value: portFees },
      ];
    }
  },
  supplier: {
    getKPIs: async (): Promise<KPI[]> => {
      ensureMockAllowed('Supplier KPIs');
      await delay(500);
      return [
        { label: 'Total Revenue', value: '$450k', trend: 8, status: 'up' },
        { label: 'Pending Orders', value: '12', trend: 15, status: 'down' },
        { label: 'OTIF Rate', value: '94%', trend: 1, status: 'up' },
      ];
    },
    getOrders: async (): Promise<Order[]> => {
      ensureMockAllowed('Supplier orders');
      await delay(500);
      return mockOrders.filter(o => o.amount < 10000); 
    }
  },
  support: {
    getTicketsByUser: async (userId: string): Promise<SupportTicket[]> => {
      ensureMockAllowed('Support tickets');
      await delay(300);
      return mockSupportTickets
        .filter(ticket => ticket.createdByUserId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    createTicket: async (payload: Omit<SupportTicket, 'id' | 'createdAt' | 'status'>): Promise<SupportTicket> => {
      ensureMockAllowed('Create support ticket');
      await delay(400);
      const ticket: SupportTicket = {
        ...payload,
        id: `TCK-${Date.now().toString().slice(-6)}`,
        status: 'Open',
        createdAt: new Date().toISOString(),
      };
      mockSupportTickets.unshift(ticket);
      persistLocalDb();
      return ticket;
    },
  },
  guest: {
    generateSuggestedProducts: async (input: { vesselName: string; port: string; details: string }): Promise<SuggestedItem[]> => {
      ensureMockAllowed('Suggested products');
      await delay(350);
      const text = `${input.vesselName} ${input.port} ${input.details}`.toLowerCase();
      const suggestions: SuggestedItem[] = [
        { id: `SUG-${Date.now()}-1`, name: 'Marine Lubricant Pack', quantity: 20, reason: 'Common replenishment item' },
        { id: `SUG-${Date.now()}-2`, name: 'Engine Filter Set', quantity: 12, reason: 'Typical maintenance cycle' },
        { id: `SUG-${Date.now()}-3`, name: 'Deck Safety Kit', quantity: 8, reason: 'Frequently requested with RFQs' },
      ];
      if (text.includes('singapore')) {
        suggestions.push({ id: `SUG-${Date.now()}-4`, name: 'Port Compliance Document Bundle', quantity: 1, reason: 'Port-specific documentation need' });
      }
      if (text.includes('fuel')) {
        suggestions.push({ id: `SUG-${Date.now()}-5`, name: 'Fuel Additive Kit', quantity: 6, reason: 'Matched from request context' });
      }
      return suggestions;
    },
    submitRFQ: async (payload: Omit<GuestRFQ, 'id' | 'createdAt'>): Promise<GuestRFQ> => {
      ensureMockAllowed('Submit RFQ');
      await delay(450);
      const rfq: GuestRFQ = {
        ...payload,
        id: `RFQ-${Date.now().toString().slice(-6)}`,
        createdAt: new Date().toISOString(),
      };
      mockGuestRFQs.unshift(rfq);
      persistLocalDb();
      return rfq;
    },
    getMyRFQs: async (userId: string): Promise<GuestRFQ[]> => {
      ensureMockAllowed('My RFQs');
      await delay(250);
      return mockGuestRFQs
        .filter(rfq => rfq.createdByUserId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  },
  powerbi: {
    getEmbedConfig: async (reportConfigId: string): Promise<{
      report: { id: string; name: string; permissionKey: string };
      embedConfig: { type: 'report'; reportId: string; embedUrl: string; tokenType: 'Embed'; accessToken: string; expiration: string };
      rls: { username: string; roles: string[] };
    }> => {
      return callFunctionApi('api/powerbi/embed-config', {
        method: 'POST',
        body: JSON.stringify({ reportConfigId }),
      });
    },
  },
};
