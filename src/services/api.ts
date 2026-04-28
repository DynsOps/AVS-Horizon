
import { KPI, Order, Shipment, Invoice, Vessel, VesselPosition, VesselRoute, VesselOperation, LogEntry, User, Company, Permission, SupportTicket, GuestRFQ, SuggestedItem, UserRole, AnalysisReport, BootstrapCredentials, UserCreateResponse, AppNotification, ContractedVessel, FleetMandayReport } from '../types';
import { getDefaultPermissionsForRole } from '../utils/rbac';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { externalLocalIdentityTokenRequest } from '../auth/authConfig';
import { externalMsalInstance } from '../auth/msalInstance';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const LOCAL_DB_KEY = 'avs_horizon_local_db_v3';
const AUTH_BEARER_TOKEN_KEY = 'avs_auth_bearer_token';
const FUNCTION_API_BASE_URL = (import.meta.env.VITE_FUNCTION_API_BASE_URL || '').replace(/\/+$/, '');
const FORCE_FUNCTION_API = String(import.meta.env.VITE_FORCE_FUNCTION_API || '').toLowerCase() === 'true';
const DEV_BYPASS_AUTH = String(import.meta.env.VITE_DEV_BYPASS_AUTH || '').toLowerCase() === 'true';
const DISABLE_MOCK_DATA = String(import.meta.env.VITE_DISABLE_MOCK_DATA ?? 'true').toLowerCase() !== 'false';
let refreshHostedTokenPromise: Promise<string | null> | null = null;

const getStoredAuthBearerToken = (): string => {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(AUTH_BEARER_TOKEN_KEY) || '';
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

const shouldRetryWithSilentRefresh = (status: number, message: string): boolean => {
  return status === 401 || /jwt expired|token expired|invalid token|signature has expired/i.test(message);
};

const resetSessionAfterTokenRefreshFailure = (): void => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_BEARER_TOKEN_KEY);
  }
  const { setAuthError } = useAuthStore.getState();
  setAuthError('Oturum suresi doldu. Lutfen tekrar giris yapin.');
};

const refreshHostedTokenSilently = async (): Promise<string | null> => {
  if (refreshHostedTokenPromise) {
    return refreshHostedTokenPromise;
  }

  refreshHostedTokenPromise = (async () => {
    const activeAccount = externalMsalInstance.getActiveAccount() || externalMsalInstance.getAllAccounts()[0] || null;
    if (!activeAccount) return null;

    const tokenResult = await externalMsalInstance.acquireTokenSilent({
      ...externalLocalIdentityTokenRequest,
      account: activeAccount,
      forceRefresh: true,
    });

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_BEARER_TOKEN_KEY, tokenResult.idToken);
    }
    return tokenResult.idToken;
  })().catch(() => {
    resetSessionAfterTokenRefreshFailure();
    return null;
  }).finally(() => {
    refreshHostedTokenPromise = null;
  });

  return refreshHostedTokenPromise;
};

const callFunctionApi = async <T = any>(path: string, init?: RequestInit, allowAuthRetry = true): Promise<T> => {
  if (!FUNCTION_API_BASE_URL) {
    throw new Error('Function API base URL is not configured.');
  }

  const token = getStoredAuthBearerToken();
  const devUserEmail = useAuthStore.getState().user?.email || '';
  const canUseDevBypass = DEV_BYPASS_AUTH && Boolean(devUserEmail);
  if (!token && !canUseDevBypass) {
    throw new Error('Hosted sign-in token is missing. Please sign in again.');
  }

  const activeCompanyId = useUIStore.getState().dashboardCompanyId || '';
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const response = await fetch(`${FUNCTION_API_BASE_URL}/${normalizedPath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(canUseDevBypass ? { 'x-dev-user-email': devUserEmail } : {}),
      ...(activeCompanyId ? { 'x-active-company-id': activeCompanyId } : {}),
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
    if (allowAuthRetry && shouldRetryWithSilentRefresh(response.status, message)) {
      const refreshedToken = await refreshHostedTokenSilently();
      if (refreshedToken) {
        return callFunctionApi<T>(path, init, false);
      }
    }
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
  hostedIdentityTokens: HostedIdentityTokenRecord[];
  supportTickets: SupportTicket[];
  guestRFQs: GuestRFQ[];
  analysisReports: AnalysisReport[];
  orders: Order[];
  shipments: Shipment[];
  invoices: Invoice[];
  vessels: Vessel[];
  vesselPositions: VesselPosition[];
  vesselRoutes: VesselRoute[];
  vesselOperations: VesselOperation[];
  logs: LogEntry[];
};

type HostedIdentityTokenRecord = {
  userEmail: string;
  bearerToken: string;
  scope: string;
  expiresAt?: string;
  updatedAt: string;
  provider?: 'external_local';
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

const normalizeCompany = (company: Company): Company => ({
  ...company,
});

// --- Initial Mock Data (Stateful) ---

let mockCompanies: Company[] = [
  { id: 'C-001', name: 'Global Shipping Co.', dataAreaId: 'DAT', projId: 'PRJ-0001', type: 'Customer', status: 'Active' },
  { id: 'S-001', name: 'Marine Supplies Ltd.', dataAreaId: 'DAT', projId: 'PRJ-0002', type: 'Supplier', status: 'Active' },
  { id: 'C-002', name: 'Pacific Liners', dataAreaId: 'DAT', projId: 'PRJ-0003', type: 'Customer', status: 'Inactive' },
  { id: 'C-003', name: 'NORDIC HAMBURG', dataAreaId: 'DAT', projId: 'PRJ-0004', type: 'Customer', status: 'Active' },
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
let mockHostedIdentityTokens: HostedIdentityTokenRecord[] = [];

let mockSupportTickets: SupportTicket[] = [
  {
    id: 'TCK-900001',
    createdByUserId: 'u6',
    createdByEmail: 'ops@nordic-hamburg.com',
    subject: 'Nordic Aurora spare parts request follow-up',
    description: 'Need ETA confirmation for critical spare parts before docking.',
    category: 'Operational',
    status: 'Open',
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
  { id: 'V-001', companyId: 'C-001', name: 'Avs Titan', imo: '9876543', type: 'Container', flagCountry: 'Singapore', builtYear: 2018, dwt: 65000, vesselStatus: 'Active' },
  { id: 'V-002', companyId: 'C-001', name: 'Avs Neptune', imo: '1234567', type: 'Bulker', flagCountry: 'Panama', builtYear: 2015, dwt: 82000, vesselStatus: 'Active' },
  { id: 'V-003', companyId: 'C-002', name: 'Avs Apollo', imo: '5544332', type: 'Tanker', flagCountry: 'Liberia', builtYear: 2020, dwt: 110000, vesselStatus: 'Active' },
  { id: 'V-004', companyId: 'C-003', name: 'Nordic Aurora', imo: '4499112', type: 'Container', flagCountry: 'Germany', builtYear: 2019, dwt: 58000, vesselStatus: 'Active' },
  { id: 'V-005', companyId: 'C-003', name: 'Nordic Breeze', imo: '4499113', type: 'Bulker', flagCountry: 'Norway', builtYear: 2017, dwt: 75000, vesselStatus: 'Under Repair' },
];

let mockVesselPositions: VesselPosition[] = [
  { id: 'VP-001', vesselId: 'V-001', lat: 1.290270, lng: 103.851959, speed: 12.5, course: 245, heading: 243, navStatus: 'Under Way', destination: 'ROTTERDAM', eta: '2023-11-05T14:00:00Z', fetchedAt: '2023-10-24T10:00:00Z' },
  { id: 'VP-002', vesselId: 'V-002', lat: 25.204849, lng: 55.270782, speed: 0, course: 0, heading: 180, navStatus: 'At Anchor', destination: 'JEBEL ALI', eta: '2023-10-25T08:00:00Z', fetchedAt: '2023-10-24T10:00:00Z' },
  { id: 'VP-003', vesselId: 'V-003', lat: 29.760427, lng: -95.369804, speed: 0, course: 0, heading: 90, navStatus: 'Moored', destination: 'HOUSTON', eta: '', fetchedAt: '2023-10-24T10:00:00Z' },
  { id: 'VP-004', vesselId: 'V-004', lat: 51.9225, lng: 4.47917, speed: 8.2, course: 15, heading: 12, navStatus: 'Under Way', destination: 'HAMBURG', eta: '2023-10-26T06:00:00Z', fetchedAt: '2023-10-24T10:00:00Z' },
  { id: 'VP-005', vesselId: 'V-005', lat: 53.5511, lng: 9.9937, speed: 0, course: 0, heading: 270, navStatus: 'Moored', destination: 'HAMBURG', eta: '', fetchedAt: '2023-10-24T10:00:00Z' },
];

let mockVesselRoutes: VesselRoute[] = [
  { id: 'VR-001', vesselId: 'V-001', departurePort: 'Singapore', arrivalPort: 'Rotterdam', departureDate: '2023-10-01T06:00:00Z', status: 'In Progress' },
  { id: 'VR-002', vesselId: 'V-002', departurePort: 'Mumbai', arrivalPort: 'Jebel Ali', departureDate: '2023-10-18T12:00:00Z', arrivalDate: '2023-10-25T08:00:00Z', status: 'In Progress' },
  { id: 'VR-003', vesselId: 'V-003', departurePort: 'Corpus Christi', arrivalPort: 'Houston', departureDate: '2023-10-20T10:00:00Z', arrivalDate: '2023-10-22T14:00:00Z', status: 'Completed' },
  { id: 'VR-004', vesselId: 'V-004', departurePort: 'Rotterdam', arrivalPort: 'Hamburg', departureDate: '2023-10-23T08:00:00Z', status: 'In Progress' },
  { id: 'VR-005', vesselId: 'V-005', departurePort: 'Oslo', arrivalPort: 'Hamburg', departureDate: '2023-10-15T14:00:00Z', arrivalDate: '2023-10-18T10:00:00Z', status: 'Completed' },
  { id: 'VR-006', vesselId: 'V-001', departurePort: 'Busan', arrivalPort: 'Singapore', departureDate: '2023-09-20T06:00:00Z', arrivalDate: '2023-09-28T18:00:00Z', status: 'Completed' },
  { id: 'VR-007', vesselId: 'V-004', departurePort: 'Antwerp', arrivalPort: 'Rotterdam', departureDate: '2023-10-10T06:00:00Z', arrivalDate: '2023-10-12T10:00:00Z', status: 'Completed' },
];

let mockVesselOperations: VesselOperation[] = [
  { id: 'VO-001', vesselId: 'V-001', routeId: 'VR-006', port: 'Busan', operationType: 'Bunkering', operationDate: '2023-09-20T08:00:00Z', items: [{ name: 'VLSFO', quantity: 500, unit: 'MT', unitPrice: 620 }, { name: 'MGO', quantity: 50, unit: 'MT', unitPrice: 850 }], totalAmount: 352500, currency: 'USD', supplierId: 'S-001' },
  { id: 'VO-002', vesselId: 'V-001', routeId: 'VR-006', port: 'Singapore', operationType: 'Provisioning', operationDate: '2023-09-29T10:00:00Z', items: [{ name: 'Fresh Provisions', quantity: 200, unit: 'kg', unitPrice: 8 }, { name: 'Dry Provisions', quantity: 500, unit: 'kg', unitPrice: 5 }, { name: 'Bonded Stores', quantity: 100, unit: 'pcs', unitPrice: 12 }], totalAmount: 5300, currency: 'USD', supplierId: 'S-001' },
  { id: 'VO-003', vesselId: 'V-001', routeId: 'VR-001', port: 'Singapore', operationType: 'Maintenance', operationDate: '2023-10-01T04:00:00Z', items: [{ name: 'Engine Filter Set', quantity: 4, unit: 'set', unitPrice: 1200 }, { name: 'Hydraulic Pump Seal', quantity: 2, unit: 'pcs', unitPrice: 850 }], totalAmount: 6500, currency: 'USD', supplierId: 'S-001' },
  { id: 'VO-004', vesselId: 'V-002', routeId: 'VR-002', port: 'Mumbai', operationType: 'Bunkering', operationDate: '2023-10-18T14:00:00Z', items: [{ name: 'VLSFO', quantity: 800, unit: 'MT', unitPrice: 610 }], totalAmount: 488000, currency: 'USD' },
  { id: 'VO-005', vesselId: 'V-003', routeId: 'VR-003', port: 'Houston', operationType: 'Crew Change', operationDate: '2023-10-22T16:00:00Z', items: [{ name: 'Crew Transfer', quantity: 8, unit: 'persons', unitPrice: 500 }], totalAmount: 4000, currency: 'USD', notes: '4 on / 4 off rotation' },
  { id: 'VO-006', vesselId: 'V-004', routeId: 'VR-007', port: 'Antwerp', operationType: 'Provisioning', operationDate: '2023-10-10T08:00:00Z', items: [{ name: 'Fresh Provisions', quantity: 300, unit: 'kg', unitPrice: 9 }, { name: 'Cleaning Supplies', quantity: 50, unit: 'pcs', unitPrice: 15 }], totalAmount: 3450, currency: 'EUR', supplierId: 'S-001' },
  { id: 'VO-007', vesselId: 'V-004', routeId: 'VR-007', port: 'Rotterdam', operationType: 'Bunkering', operationDate: '2023-10-12T12:00:00Z', items: [{ name: 'VLSFO', quantity: 350, unit: 'MT', unitPrice: 630 }], totalAmount: 220500, currency: 'EUR' },
  { id: 'VO-008', vesselId: 'V-005', routeId: 'VR-005', port: 'Hamburg', operationType: 'Maintenance', operationDate: '2023-10-19T09:00:00Z', items: [{ name: 'Main Engine Overhaul', quantity: 1, unit: 'job', unitPrice: 45000 }, { name: 'Propeller Shaft Inspection', quantity: 1, unit: 'job', unitPrice: 12000 }], totalAmount: 57000, currency: 'EUR', notes: 'Scheduled dry dock maintenance' },
  { id: 'VO-009', vesselId: 'V-003', routeId: 'VR-003', port: 'Corpus Christi', operationType: 'Port Fees', operationDate: '2023-10-20T12:00:00Z', items: [{ name: 'Pilotage', quantity: 1, unit: 'service', unitPrice: 3500 }, { name: 'Towage', quantity: 2, unit: 'tugs', unitPrice: 2800 }, { name: 'Berth Fee', quantity: 3, unit: 'days', unitPrice: 1200 }], totalAmount: 12700, currency: 'USD' },
  { id: 'VO-010', vesselId: 'V-001', routeId: 'VR-001', port: 'Colombo', operationType: 'Bunkering', operationDate: '2023-10-12T06:00:00Z', items: [{ name: 'VLSFO', quantity: 400, unit: 'MT', unitPrice: 615 }], totalAmount: 246000, currency: 'USD', notes: 'Enroute bunker stop' },
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
  hostedIdentityTokens: [...mockHostedIdentityTokens],
  supportTickets: [...mockSupportTickets],
  guestRFQs: [...mockGuestRFQs],
  analysisReports: [...mockAnalysisReports],
  orders: [...mockOrders],
  shipments: [...mockShipments],
  invoices: [...mockInvoices],
  vessels: [...mockVessels],
  vesselPositions: [...mockVesselPositions],
  vesselRoutes: [...mockVesselRoutes],
  vesselOperations: [...mockVesselOperations],
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
    if (parsed.hostedIdentityTokens) mockHostedIdentityTokens = parsed.hostedIdentityTokens;
    else if ((parsed as Partial<{ microsoftTokens: HostedIdentityTokenRecord[] }>).microsoftTokens) {
      mockHostedIdentityTokens = (parsed as Partial<{ microsoftTokens: HostedIdentityTokenRecord[] }>).microsoftTokens || [];
    }
    if (parsed.supportTickets) mockSupportTickets = parsed.supportTickets;
    if (parsed.guestRFQs) mockGuestRFQs = parsed.guestRFQs;
    if (parsed.analysisReports) mockAnalysisReports = parsed.analysisReports;
    if (parsed.orders) mockOrders = parsed.orders;
    if (parsed.shipments) mockShipments = parsed.shipments;
    if (parsed.invoices) mockInvoices = parsed.invoices;
    if (parsed.vessels) mockVessels = parsed.vessels;
    if (parsed.vesselPositions) mockVesselPositions = parsed.vesselPositions;
    if (parsed.vesselRoutes) mockVesselRoutes = parsed.vesselRoutes;
    if (parsed.vesselOperations) mockVesselOperations = parsed.vesselOperations;
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
    if (targetUser.role !== 'user' || hasCompanyAdminHiddenPermissions(targetUser.permissions)) {
      throw new Error('Admin can only manage standard user accounts.');
    }
  }
};

const BOOTSTRAP_SUPADMIN_EMAILS = ['dynamicsops14@avsglobalsupply.com'];
const LOWEST_AUTO_PERMISSIONS: Permission[] = ['view:dashboard'];
const COMPANY_ADMIN_BASE_PERMISSIONS: Permission[] = ['view:dashboard', 'view:reports', 'create:support-ticket'];
const COMPANY_ADMIN_HIDDEN_PERMISSIONS: Permission[] = ['manage:users', 'manage:companies'];
const SUPADMIN_CONTROLLED_PERMISSIONS: Permission[] = [
  'system:settings',
  'view:finance',
  'view:sustainability',
  'view:business',
  'manage:reports',
];

const hasCompanyAdminHiddenPermissions = (permissions: Permission[] = []): boolean => {
  return COMPANY_ADMIN_HIDDEN_PERMISSIONS.some((permission) => permissions.includes(permission));
};

const isBiReportPermission = (permission: Permission): boolean => permission.startsWith('view:analysis-report:');

const getCompanyAdminManageablePermissions = (actorPermissions: Permission[] = []): Permission[] => {
  const actorReportPermissions = actorPermissions.filter((permission): permission is Permission => isBiReportPermission(permission));
  return [...COMPANY_ADMIN_BASE_PERMISSIONS, ...actorReportPermissions];
};

const getCompanyAdminAllowedPermissions = (actorPermissions: Permission[], permissions?: Permission[]): Permission[] => {
  const requested = permissions?.length ? permissions : COMPANY_ADMIN_BASE_PERMISSIONS;
  const allowedSet = new Set(getCompanyAdminManageablePermissions(actorPermissions));
  return requested.filter((permission): permission is Permission => allowedSet.has(permission));
};

const normalizeAdminManagedUserInput = <T extends Pick<User, 'role' | 'companyId' | 'isGuest' | 'permissions' | 'provisioningSource'>>(
  user: T,
  actorCompanyId: string,
  actorPermissions: Permission[],
): T => ({
  ...user,
  role: 'user',
  companyId: actorCompanyId,
  isGuest: false,
  permissions: getCompanyAdminAllowedPermissions(actorPermissions, user.permissions),
  provisioningSource: user.provisioningSource || 'external_local_account',
});

const getEmailDomain = (email: string): string => {
  const parts = email.split('@');
  return parts.length > 1 ? parts[1].toLowerCase() : '';
};

const isPersonalEmailDomain = (email: string): boolean => {
  const domain = getEmailDomain(email);
  return [
    'gmail.com',
    'googlemail.com',
    'hotmail.com',
    'outlook.com',
    'live.com',
    'msn.com',
    'icloud.com',
    'me.com',
    'yahoo.com',
    'yandex.com',
    'proton.me',
    'protonmail.com',
  ].includes(domain);
};

const deriveAccessState = (params: {
  provisioningSource: NonNullable<User['provisioningSource']>;
  permissions: Permission[];
  hasLinkedIdentity: boolean;
}): NonNullable<User['accessState']> => {
  if ((params.provisioningSource === 'invited_personal' || params.provisioningSource === 'external_local_account') && !params.hasLinkedIdentity) {
    return 'invited';
  }
  return params.permissions.length > 0 ? 'active' : 'pending';
};

const getDefaultProvisioningSource = (_email: string): NonNullable<User['provisioningSource']> => 'external_local_account';

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
    provisioningSource: 'auto_domain',
    accessState: 'pending',
    isGuest: false,
    powerBiAccess: 'none',
    powerBiWorkspaceId: '',
    powerBiReportId: '',
    lastLogin: new Date().toISOString(),
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
  if (actorRole === 'supadmin') return;

  const existingSet = new Set(existingPermissions);
  if (actorRole === 'admin') {
    const actorPermissions = useAuthStore.getState().user?.permissions || [];
    const allowedSet = new Set(getCompanyAdminManageablePermissions(actorPermissions));
    const disallowedByRole = targetPermissions.filter(
      (permission) => !allowedSet.has(permission) && !existingSet.has(permission)
    );
    if (disallowedByRole.length > 0) {
      throw new Error('Admin can only grant user-role permissions.');
    }
    return;
  }

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
    checkAccess: async (email: string, bearerToken?: string): Promise<User> => {
      return api.auth.loginWithHostedIdentity(email, bearerToken);
    },
    loginWithHostedIdentity: async (email: string, bearerToken?: string): Promise<User> => {
      const normalizedEmail = email.trim().toLowerCase();
      if (FUNCTION_API_BASE_URL) {
        const token = bearerToken || getStoredAuthBearerToken();
        const canUseDevBypass = DEV_BYPASS_AUTH && Boolean(normalizedEmail);
        if (!token && !canUseDevBypass) {
          throw new Error('Sign-in token is missing. Please sign in again.');
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

      ensureMockAllowed('Hosted sign-in');
      await delay(800);
      throw new Error('No Function API configured.');
    },
    storeHostedToken: async (payload: {
      userEmail: string;
      bearerToken: string;
      scope: string;
      expiresAt?: string;
      provider?: 'external_local';
    }): Promise<void> => {
      await delay(100);
      const normalizedEmail = payload.userEmail.trim().toLowerCase();
      const nextToken: HostedIdentityTokenRecord = {
        userEmail: normalizedEmail,
        bearerToken: payload.bearerToken,
        scope: payload.scope,
        expiresAt: payload.expiresAt,
        updatedAt: new Date().toISOString(),
        provider: payload.provider,
      };
      const idx = mockHostedIdentityTokens.findIndex((token) => token.userEmail === normalizedEmail);
      if (idx === -1) {
        mockHostedIdentityTokens.push(nextToken);
      } else {
        mockHostedIdentityTokens[idx] = nextToken;
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(AUTH_BEARER_TOKEN_KEY, payload.bearerToken);
      }
      persistLocalDb();
    },
    getHostedToken: async (userEmail: string): Promise<HostedIdentityTokenRecord | null> => {
      await delay(50);
      const normalizedEmail = userEmail.trim().toLowerCase();
      return mockHostedIdentityTokens.find((token) => token.userEmail === normalizedEmail) || null;
    },
    clearHostedToken: async (userEmail?: string): Promise<void> => {
      await delay(50);
      if (userEmail) {
        const normalizedEmail = userEmail.trim().toLowerCase();
        mockHostedIdentityTokens = mockHostedIdentityTokens.filter((token) => token.userEmail !== normalizedEmail);
      } else {
        mockHostedIdentityTokens = [];
      }
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(AUTH_BEARER_TOKEN_KEY);
      }
      persistLocalDb();
    },
    loginWithPassword: async (): Promise<User> => {
      throw new Error('Password login is managed by Entra ID. Use the hosted Entra sign-in flow.');
    },
    // Backward compatible alias (used by earlier screens)
    login: async (email: string): Promise<User> => {
      return api.auth.loginWithHostedIdentity(email);
    },
    updateProfile: async (userId: string, data: Partial<User>): Promise<User> => {
        if (FUNCTION_API_BASE_URL) {
          const payload = await callFunctionApi<{ user: User }>('api/auth/profile', {
            method: 'PATCH',
            body: JSON.stringify({
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
              throw new Error('Email is managed by hosted identity and cannot be changed here.');
            }
            const { email, ...safeUpdates } = data;
            mockUsers[index] = { ...mockUsers[index], ...safeUpdates };
            persistLocalDb();
            return mockUsers[index];
        }
        throw new Error('User not found');
    },
    changePassword: async (): Promise<void> => {
      throw new Error('Password change is managed by Entra ID. Use the hosted Entra account settings.');
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
    createUser: async (user: Omit<User, 'id'>): Promise<UserCreateResponse> => {
        const actor = getActorUser();
        const actorPermissions = actor?.permissions || [];
        const normalizedUser = actor?.role === 'admin'
          ? normalizeAdminManagedUserInput(user, actor.companyId || '', actorPermissions)
          : user;
        if (shouldUseFunctionApi()) {
            const { provisioningSource, ...rest } = normalizedUser;
            const payload = await callFunctionApi<UserCreateResponse>('api/identity/users', {
                method: 'POST',
                body: JSON.stringify({
                  ...rest,
                  ...(provisioningSource ? { provisioningMode: provisioningSource } : {}),
                }),
            });
            const createdUser = payload.user;
            const existingIdx = mockUsers.findIndex((u) => u.id === createdUser.id);
            if (existingIdx === -1) mockUsers.push({ ...createdUser });
            else mockUsers[existingIdx] = { ...createdUser };
            persistLocalDb();
            return payload;
        }
        await delay(500);
        assertCanAssignRole(normalizedUser.role);
        const sanitizedIsGuest = normalizedUser.role === 'user' ? Boolean(normalizedUser.isGuest) : false;
        if (actor?.role === 'admin') {
            if (!actor.companyId) throw new Error('Admin user is not linked to a company.');
            if (normalizedUser.role !== 'user') throw new Error('Admin can only manage standard user accounts.');
            if (sanitizedIsGuest) throw new Error('Admin cannot create guest users.');
            if (normalizedUser.companyId && normalizedUser.companyId !== actor.companyId) throw new Error('Admin can only create users for their own company.');
        }
        const requestedPermissions = normalizedUser.permissions?.length ? normalizedUser.permissions : getDefaultPermissionsForRole(normalizedUser.role);
        assertPermissionGrantPolicy(requestedPermissions);
        const emailExists = mockUsers.some(u => u.email.toLowerCase() === normalizedUser.email.toLowerCase());
        if (emailExists) {
            throw new Error('A user with this email already exists.');
        }
        const hasCompanyAdminPermissions = Boolean(normalizedUser.permissions?.includes('manage:users') || normalizedUser.permissions?.includes('manage:companies'));
        const scopedCompanyId = actor?.role === 'admin' ? (actor.companyId || '') : (normalizedUser.companyId || '');
        const companyRequired = (normalizedUser.role === 'user' && !sanitizedIsGuest) || normalizedUser.role === 'admin';
        if (companyRequired && !scopedCompanyId) {
            throw new Error('Company is required for role "admin" and non-guest "user".');
        }
        if (normalizedUser.role === 'user' && hasCompanyAdminPermissions && (!scopedCompanyId || sanitizedIsGuest)) {
            throw new Error('Company Admin users must be non-guest and linked to a company.');
        }
        const provisioningSource = normalizedUser.provisioningSource || getDefaultProvisioningSource(normalizedUser.email);
        const accessState = deriveAccessState({
          provisioningSource,
          permissions: requestedPermissions,
          hasLinkedIdentity: false,
        });
        const bootstrapCredentials = provisioningSource === 'external_local_account'
          ? {
              email: normalizedUser.email,
              temporaryPassword: `AVS-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`,
            }
          : null;
        const newUser: User = { 
            ...normalizedUser, 
            id: `u-${Date.now()}`, 
            permissions: requestedPermissions,
            isGuest: sanitizedIsGuest,
            companyId: normalizedUser.role === 'supadmin' ? '' : scopedCompanyId,
            provisioningSource,
            accessState,
            identityProviderType: 'external_local',
        };
        mockUsers.push(newUser);
        persistLocalDb();
        return { user: newUser, bootstrapCredentials };
    },
    updateUser: async (id: string, updates: Partial<User>): Promise<User> => {
        const actor = getActorUser();
        const actorPermissions = actor?.permissions || [];
        if (shouldUseFunctionApi()) {
            const currentUser = mockUsers.find((u) => u.id === id);
            const normalizedUpdates = actor?.role === 'admin'
              ? normalizeAdminManagedUserInput({
                  role: updates.role || currentUser?.role || 'user',
                  companyId: updates.companyId ?? currentUser?.companyId ?? actor.companyId ?? '',
                  isGuest: typeof updates.isGuest === 'boolean' ? updates.isGuest : (currentUser?.isGuest || false),
                  permissions: (updates.permissions as Permission[] | undefined) || currentUser?.permissions || getDefaultPermissionsForRole('user'),
                  provisioningSource: updates.provisioningSource || currentUser?.provisioningSource || 'external_local_account',
                }, actor.companyId || '', actorPermissions)
              : updates;
            const { provisioningSource, ...rest } = normalizedUpdates;
            await callFunctionApi<{ success: boolean }>(`api/identity/users/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                  ...updates,
                  ...rest,
                  ...(provisioningSource ? { provisioningMode: provisioningSource } : {}),
                }),
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

        const normalizedUpdates = actor?.role === 'admin'
            ? normalizeAdminManagedUserInput({
                role: updates.role || currentUser.role,
                companyId: updates.companyId ?? currentUser.companyId ?? actor.companyId ?? '',
                isGuest: typeof updates.isGuest === 'boolean' ? updates.isGuest : (currentUser.isGuest || false),
                permissions: (updates.permissions as Permission[] | undefined) || currentUser.permissions,
                provisioningSource: updates.provisioningSource || currentUser.provisioningSource || 'external_local_account',
              }, actor.companyId || '', actorPermissions)
            : updates;

        const targetRole = normalizedUpdates.role || currentUser.role;
        assertCanAssignRole(targetRole);
        const targetIsGuest = targetRole === 'user'
            ? (typeof normalizedUpdates.isGuest === 'boolean' ? normalizedUpdates.isGuest : currentUser.isGuest)
            : false;
        const targetCompanyId = normalizedUpdates.companyId ?? currentUser.companyId;
        if (actor?.role === 'admin') {
            if (!actor.companyId) throw new Error('Admin user is not linked to a company.');
            if (targetRole !== 'user' || hasCompanyAdminHiddenPermissions(currentUser.permissions)) {
                throw new Error('Admin can only manage standard user accounts.');
            }
            if (targetIsGuest) throw new Error('Admin cannot assign guest scope.');
            if (targetCompanyId && targetCompanyId !== actor.companyId) throw new Error('Admin can only assign users to their own company.');
        }
        const scopedTargetCompanyId = actor?.role === 'admin' ? (actor.companyId || '') : (targetCompanyId || '');
        if ((targetRole === 'user' && !targetIsGuest && !scopedTargetCompanyId) || (targetRole === 'admin' && !scopedTargetCompanyId)) {
            throw new Error('Company is required for role "admin" and non-guest "user".');
        }

        const roleSafeCompanyId = targetRole === 'supadmin' ? '' : (targetRole === 'user' && targetIsGuest ? '' : scopedTargetCompanyId);
        const nextPermissions = normalizedUpdates.permissions?.length
            ? normalizedUpdates.permissions
            : (normalizedUpdates.role && normalizedUpdates.role !== currentUser.role ? getDefaultPermissionsForRole(normalizedUpdates.role) : currentUser.permissions);
        assertPermissionGrantPolicy(nextPermissions, currentUser.permissions);
        const hasCompanyAdminPermissions = Boolean(nextPermissions?.includes('manage:users') || nextPermissions?.includes('manage:companies'));
        if (targetRole === 'user' && hasCompanyAdminPermissions && (!targetCompanyId || targetIsGuest)) {
            throw new Error('Company Admin users must be non-guest and linked to a company.');
        }
        mockUsers[index] = {
            ...currentUser,
            ...normalizedUpdates,
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
      mockHostedIdentityTokens = mockHostedIdentityTokens.filter((token) => token.userEmail !== targetUser.email.toLowerCase());
      persistLocalDb();
    },
    resetUserPassword: async (): Promise<never> => {
      throw new Error('Password reset is managed by Entra ID. Use the hosted Entra reset flow.');
    },
    getAdminUserCompanies: async (userId: string): Promise<string[]> => {
      if (shouldUseFunctionApi()) {
        const payload = await callFunctionApi<{ companyIds: string[] }>(`api/identity/users/${userId}/companies`);
        return payload.companyIds;
      }
      return [];
    },
    setAdminUserCompanies: async (userId: string, companyIds: string[]): Promise<void> => {
      if (shouldUseFunctionApi()) {
        await callFunctionApi<{ success: boolean }>(`api/identity/users/${userId}/companies`, {
          method: 'PUT',
          body: JSON.stringify({ companyIds }),
        });
        return;
      }
    },
    getGroupProjtables: async (params?: {
      query?: string;
      limit?: number;
    }): Promise<Array<{ name: string; dataAreaId: string; projId: string }>> => {
        const query = (params?.query || '').trim();
        const limit = Number.isFinite(params?.limit) ? Math.max(1, Math.min(200, Number(params?.limit))) : 25;
        if (shouldUseFunctionApi()) {
            const searchParams = new URLSearchParams();
            if (query) searchParams.set('q', query);
            searchParams.set('limit', String(limit));
            const payload = await callFunctionApi<{ items: Array<{ name: string; dataareaid: string | null; projid: string | null }> }>(
              `api/fabric/group-projtables?${searchParams.toString()}`
            );
            return payload.items
              .map((item) => ({
                name: (item.name || '').trim(),
                dataAreaId: (item.dataareaid || '').trim(),
                projId: (item.projid || '').trim(),
              }))
              .filter((item) => item.name && item.dataAreaId && item.projId)
              .slice(0, limit);
        }
        await delay(150);
        return mockCompanies
          .filter((company) => company.name && company.dataAreaId && company.projId)
          .filter((company) => !query || company.name.toLowerCase().includes(query.toLowerCase()))
          .map((company) => ({
            name: company.name,
            dataAreaId: company.dataAreaId as string,
            projId: company.projId as string,
          }))
          .slice(0, limit);
    },
    getCompanies: async (): Promise<Company[]> => {
        if (shouldUseFunctionApi()) {
            const payload = await callFunctionApi<{ companies: Company[] }>('api/identity/companies');
            mockCompanies = payload.companies.map(normalizeCompany);
            persistLocalDb();
            return payload.companies.map(normalizeCompany);
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
            const normalizedCompany = normalizeCompany(payload.company);
            mockCompanies.push(normalizedCompany);
            persistLocalDb();
            return normalizedCompany;
        }
        await delay(500);
        const newCompany = normalizeCompany({
          ...company,
          id: `${company.type === 'Customer' ? 'C' : 'S'}-${Date.now().toString().slice(-3)}`,
        });
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
        mockCompanies[index] = normalizeCompany({ ...mockCompanies[index], ...updates });
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
    getPermissionsCatalog: async (): Promise<Record<string, { key: string; label: string; kind: string }[]>> => {
      const payload = await callFunctionApi<{ groups: Record<string, { key: string; label: string; kind: string }[]> }>('api/identity/permissions/catalog');
      return payload.groups;
    },
    getTemplates: async (scope?: 'global' | 'company', companyId?: string): Promise<{ id: string; name: string; description: string | null; scope: string; companyId: string | null; permissions: string[]; isActive: boolean }[]> => {
      const params = new URLSearchParams();
      if (scope) params.set('scope', scope);
      if (companyId) params.set('company_id', companyId);
      const qs = params.toString();
      const payload = await callFunctionApi<{ templates: { id: string; name: string; description: string | null; scope: string; companyId: string | null; permissions: string[]; isActive: boolean }[] }>(`api/identity/templates${qs ? `?${qs}` : ''}`);
      return payload.templates;
    },
    createTemplate: async (body: { name: string; description?: string; scope: 'global' | 'company'; companyId?: string; permissions: string[] }): Promise<{ id: string; name: string; description: string | null; scope: string; companyId: string | null; permissions: string[]; isActive: boolean }> => {
      const payload = await callFunctionApi<{ template: { id: string; name: string; description: string | null; scope: string; companyId: string | null; permissions: string[]; isActive: boolean } }>('api/identity/templates', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return payload.template;
    },
    updateTemplate: async (id: string, body: { name?: string; description?: string; permissions?: string[] }): Promise<{ id: string; name: string; description: string | null; scope: string; companyId: string | null; permissions: string[]; isActive: boolean }> => {
      const payload = await callFunctionApi<{ template: { id: string; name: string; description: string | null; scope: string; companyId: string | null; permissions: string[]; isActive: boolean } }>(`api/identity/templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      return payload.template;
    },
    deleteTemplate: async (id: string): Promise<void> => {
      await callFunctionApi<{ success: boolean }>(`api/identity/templates/${id}`, { method: 'DELETE' });
    },
    getUserTemplateId: async (userId: string): Promise<string | null> => {
      const payload = await callFunctionApi<{ templateId: string | null }>(`api/identity/users/${userId}/template`);
      return payload.templateId;
    },
    assignUserTemplate: async (userId: string, templateId: string): Promise<void> => {
      await callFunctionApi<{ success: boolean }>(`api/identity/users/${userId}/template`, {
        method: 'PUT',
        body: JSON.stringify({ templateId }),
      });
    },
    getCompanyTemplateId: async (companyId: string): Promise<string | null> => {
      const payload = await callFunctionApi<{ templateId: string | null }>(`api/identity/companies/${companyId}/template`);
      return payload.templateId;
    },
    assignCompanyTemplate: async (companyId: string, templateId: string): Promise<void> => {
      await callFunctionApi<{ success: boolean }>(`api/identity/companies/${companyId}/template`, {
        method: 'PUT',
        body: JSON.stringify({ templateId }),
      });
    },
    getUserReports: async (userId: string): Promise<string[]> => {
      const payload = await callFunctionApi<{ reportIds: string[] }>(`api/identity/users/${userId}/reports`);
      return payload.reportIds;
    },
    setUserReports: async (userId: string, reportIds: string[]): Promise<void> => {
      await callFunctionApi<{ success: boolean }>(`api/identity/users/${userId}/reports`, {
        method: 'PUT',
        body: JSON.stringify({ reportIds }),
      });
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
    getContractedVessels: async (): Promise<ContractedVessel[]> => {
      if (shouldUseFunctionApi()) {
        const payload = await callFunctionApi<{ vessels: ContractedVessel[] }>('api/customer/contracted-vessels');
        return payload.vessels;
      }
      ensureMockAllowed('Contracted vessels');
      await delay(120);
      return [];
    },
    getFleetMandayReport: async (params: { year: number; month: number }): Promise<FleetMandayReport> => {
      if (shouldUseFunctionApi()) {
        const qs = new URLSearchParams({ year: String(params.year), month: String(params.month) });
        return callFunctionApi<FleetMandayReport>(`api/customer/fleet-manday-report?${qs.toString()}`);
      }
      ensureMockAllowed('Fleet manday report');
      await delay(120);
      return {
        year: params.year,
        month: params.month,
        kpis: { totalSpendMtd: 0, totalBudget: 0, avgCostPerManday: 0, targetCostPerManday: null, vesselsExceeded: 0, vesselsTotal: 0 },
        exceptions: [],
        vessels: [],
      };
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
    getMyTickets: async (): Promise<SupportTicket[]> => {
      if (shouldUseFunctionApi()) {
        const payload = await callFunctionApi<{ tickets: SupportTicket[] }>('api/support/tickets/me');
        return payload.tickets;
      }
      ensureMockAllowed('Support tickets');
      await delay(300);
      const actor = getActorUser();
      if (!actor) throw new Error('User not found.');
      return mockSupportTickets
        .filter((ticket) => ticket.createdByUserId === actor.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    createTicket: async (payload: Pick<SupportTicket, 'subject' | 'description' | 'category'>): Promise<SupportTicket> => {
      if (shouldUseFunctionApi()) {
        const createdPayload = await callFunctionApi<{ ticket: SupportTicket }>('api/support/tickets', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        return createdPayload.ticket;
      }
      ensureMockAllowed('Create support ticket');
      await delay(400);
      const actor = getActorUser();
      if (!actor) throw new Error('User not found.');
      if (actor.role === 'supadmin') throw new Error('Supadmin cannot create support tickets.');
      if (!actor.permissions.includes('create:support-ticket')) {
        throw new Error('Missing permission: create:support-ticket');
      }
      const ticket: SupportTicket = {
        id: `TCK-${Date.now().toString().slice(-6)}`,
        createdByUserId: actor.id,
        createdByEmail: actor.email,
        subject: payload.subject.trim(),
        description: payload.description.trim(),
        category: payload.category,
        status: 'Open',
        createdAt: new Date().toISOString(),
        replies: [],
      };
      mockSupportTickets.unshift(ticket);
      persistLocalDb();
      return ticket;
    },
    replyToMyTicket: async (ticketId: string, message: string): Promise<void> => {
      if (shouldUseFunctionApi()) {
        await callFunctionApi<{ reply: unknown }>(`api/support/tickets/${ticketId}/replies`, {
          method: 'POST',
          body: JSON.stringify({ message }),
        });
        return;
      }
      ensureMockAllowed('Reply my support ticket');
      await delay(220);
      const actor = getActorUser();
      if (!actor) throw new Error('User not found.');
      if (actor.role === 'supadmin') throw new Error('Supadmin cannot post replies from user ticket flow.');
      const ticket = mockSupportTickets.find((entry) => entry.id === ticketId && entry.createdByUserId === actor.id);
      if (!ticket) throw new Error('Support ticket not found.');
      throw new Error('This ticket is closed for follow-up. Please create a new support ticket.');
    },
    getAdminTickets: async (): Promise<SupportTicket[]> => {
      if (shouldUseFunctionApi()) {
        const payload = await callFunctionApi<{ tickets: SupportTicket[] }>('api/support/admin/tickets');
        return payload.tickets;
      }
      ensureMockAllowed('Admin support tickets');
      await delay(250);
      const actor = getActorUser();
      if (actor?.role !== 'supadmin') throw new Error('Only supadmin can list all support tickets.');
      return [...mockSupportTickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    getOpenTicketsCount: async (): Promise<number> => {
      if (shouldUseFunctionApi()) {
        const payload = await callFunctionApi<{ count: number }>('api/support/admin/tickets/open-count');
        return payload.count;
      }
      ensureMockAllowed('Open tickets count');
      await delay(80);
      return 0;
    },
    replyToTicket: async (ticketId: string, message: string): Promise<void> => {
      if (shouldUseFunctionApi()) {
        await callFunctionApi<{ reply: unknown }>(`api/support/admin/tickets/${ticketId}/replies`, {
          method: 'POST',
          body: JSON.stringify({ message }),
        });
        return;
      }
      ensureMockAllowed('Reply support ticket');
      await delay(250);
      const actor = getActorUser();
      if (actor?.role !== 'supadmin') throw new Error('Only supadmin can reply to support tickets.');
      const ticket = mockSupportTickets.find((entry) => entry.id === ticketId);
      if (!ticket) throw new Error('Support ticket not found.');
      if (ticket.status === 'Resolved') throw new Error('Support ticket is already resolved.');
      ticket.replies = ticket.replies || [];
      ticket.replies.push({
        id: `REP-${Date.now().toString().slice(-6)}`,
        ticketId,
        authorUserId: actor.id,
        authorRole: actor.role,
        message: message.trim(),
        createdAt: new Date().toISOString(),
      });
      ticket.status = 'Resolved';
      persistLocalDb();
    },
    updateTicketStatus: async (ticketId: string, status: SupportTicket['status']): Promise<void> => {
      if (shouldUseFunctionApi()) {
        await callFunctionApi<{ ticket: { id: string; status: SupportTicket['status'] } }>(`api/support/admin/tickets/${ticketId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        return;
      }
      ensureMockAllowed('Update support ticket status');
      await delay(250);
      const actor = getActorUser();
      if (actor?.role !== 'supadmin') throw new Error('Only supadmin can update support ticket status.');
      const ticket = mockSupportTickets.find((entry) => entry.id === ticketId);
      if (!ticket) throw new Error('Support ticket not found.');
      ticket.status = status;
      persistLocalDb();
    },
  },
  notifications: {
    getNotifications: async (): Promise<AppNotification[]> => {
      if (shouldUseFunctionApi()) {
        const payload = await callFunctionApi<{ notifications: AppNotification[] }>('api/notifications');
        return payload.notifications;
      }
      ensureMockAllowed('Notifications');
      await delay(120);
      return [];
    },
    markNotificationRead: async (id: string): Promise<void> => {
      if (shouldUseFunctionApi()) {
        await callFunctionApi<{ notification: { id: string; isRead: boolean } }>(`api/notifications/${id}/read`, {
          method: 'PATCH',
        });
        return;
      }
      ensureMockAllowed('Mark notification read');
      await delay(80);
    },
    deleteNotification: async (id: string): Promise<void> => {
      if (shouldUseFunctionApi()) {
        await callFunctionApi<{ deleted: boolean }>(`api/notifications/${id}`, { method: 'DELETE' });
        return;
      }
      ensureMockAllowed('Delete notification');
      await delay(80);
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
  maritime: {
    getVessels: async (companyId?: string): Promise<Vessel[]> => {
      ensureMockAllowed('Maritime vessels');
      await delay(300);
      if (companyId) return byCompanyScope(mockVessels, companyId);
      return [...mockVessels];
    },
    getVessel: async (id: string): Promise<Vessel> => {
      ensureMockAllowed('Maritime vessel');
      await delay(200);
      const vessel = mockVessels.find((v) => v.id === id);
      if (!vessel) throw new Error('Vessel not found');
      return { ...vessel };
    },
    createVessel: async (vessel: Omit<Vessel, 'id'>): Promise<Vessel> => {
      ensureMockAllowed('Create vessel');
      await delay(400);
      const newVessel: Vessel = { ...vessel, id: `V-${Date.now().toString().slice(-4)}` };
      mockVessels.push(newVessel);
      persistLocalDb();
      return newVessel;
    },
    updateVessel: async (id: string, updates: Partial<Vessel>): Promise<Vessel> => {
      ensureMockAllowed('Update vessel');
      await delay(300);
      const index = mockVessels.findIndex((v) => v.id === id);
      if (index === -1) throw new Error('Vessel not found');
      mockVessels[index] = { ...mockVessels[index], ...updates };
      persistLocalDb();
      return mockVessels[index];
    },
    deleteVessel: async (id: string): Promise<void> => {
      ensureMockAllowed('Delete vessel');
      await delay(300);
      mockVessels = mockVessels.filter((v) => v.id !== id);
      mockVesselPositions = mockVesselPositions.filter((p) => p.vesselId !== id);
      mockVesselRoutes = mockVesselRoutes.filter((r) => r.vesselId !== id);
      mockVesselOperations = mockVesselOperations.filter((o) => o.vesselId !== id);
      persistLocalDb();
    },
    getVesselPositions: async (companyId?: string): Promise<VesselPosition[]> => {
      ensureMockAllowed('Vessel positions');
      await delay(250);
      if (companyId) {
        const companyVesselIds = new Set(mockVessels.filter((v) => v.companyId === companyId).map((v) => v.id));
        return mockVesselPositions.filter((p) => companyVesselIds.has(p.vesselId));
      }
      return [...mockVesselPositions];
    },
    getVesselPosition: async (vesselId: string): Promise<VesselPosition | null> => {
      ensureMockAllowed('Vessel position');
      await delay(150);
      return mockVesselPositions.find((p) => p.vesselId === vesselId) || null;
    },
    getVesselRoutes: async (vesselId: string): Promise<VesselRoute[]> => {
      ensureMockAllowed('Vessel routes');
      await delay(250);
      return mockVesselRoutes.filter((r) => r.vesselId === vesselId).sort((a, b) => b.departureDate.localeCompare(a.departureDate));
    },
    getVesselOperations: async (vesselId: string): Promise<VesselOperation[]> => {
      ensureMockAllowed('Vessel operations');
      await delay(300);
      return mockVesselOperations.filter((o) => o.vesselId === vesselId).sort((a, b) => b.operationDate.localeCompare(a.operationDate));
    },
  },
  powerbi: {
    getEmbedConfig: async (reportConfigId: string): Promise<{
      report: { id: string; name: string; permissionKey: string };
      embedConfig: { type: 'report'; reportId: string; embedUrl: string; tokenType: 'Embed'; accessToken: string; expiration: string };
      rls: { username: string | null; roles: string[] };
    }> => {
      const selectedCompanyId = useUIStore.getState().dashboardCompanyId;
      return callFunctionApi('api/powerbi/embed-config', {
        method: 'POST',
        body: JSON.stringify({
          reportConfigId,
          ...(selectedCompanyId ? { companyId: selectedCompanyId } : {}),
        }),
      });
    },
  },
};
