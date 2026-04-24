
export type UserRole = 'supadmin' | 'admin' | 'user';
export type ProvisioningSource =
  | 'bootstrap_supadmin'
  | 'corporate_precreated' // legacy rows only
  | 'invited_personal'
  | 'external_local_account'
  | 'auto_domain';
export type AccessState = 'invited' | 'pending' | 'active';
export type IdentityProviderType = 'workforce_federated' | 'external_local'; // workforce_federated kept for legacy rows

export type Permission = 
  | 'view:dashboard'
  | 'view:operational-list'
  | 'view:invoices'
  | 'view:port-fees'
  | 'view:reports'
  | 'view:fleet'
  | 'view:shipments'
  | 'view:orders'
  | 'view:supplier'
  | 'create:support-ticket'
  | 'submit:rfq'
  | 'manage:users' 
  | 'manage:companies' 
  | 'view:finance' 
  | 'view:sustainability'
  | 'view:business'
  | 'edit:orders' 
  | 'view:analytics'
  | 'system:settings'
  | 'manage:reports'
  | 'manage:vessels'
  | 'view:maritime-map'
  | `view:analysis-report:${string}`;

export interface Company {
  id: string;
  name: string;
  dataAreaId?: string;
  projId?: string;
  type: 'Customer' | 'Supplier';
  status: 'Active' | 'Inactive';
}

export interface BootstrapCredentials {
  email: string;
  temporaryPassword: string;
}

export interface WelcomeEmailNotification {
  sent: boolean;
  error?: string;
}

export interface UserCreateResponse {
  user: User;
  bootstrapCredentials?: BootstrapCredentials | null;
  notifications?: {
    welcomeEmail?: WelcomeEmailNotification;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  entraObjectId?: string;
  identityProviderType?: IdentityProviderType;
  identityTenantId?: string;
  role: UserRole;
  isGuest?: boolean;
  showOnlyCoreAdminPermissions?: boolean;
  powerBiAccess?: 'none' | 'viewer' | 'editor';
  powerBiWorkspaceId?: string;
  powerBiReportId?: string;
  avatarUrl?: string;
  companyId?: string;
  companyIds?: string[];
  permissions: Permission[];
  status: 'Active' | 'Inactive' | 'Suspended';
  provisioningSource?: ProvisioningSource;
  accessState?: AccessState;
  lastLogin?: string;
  temporaryPassword?: string;
  passwordLastChangedAt?: string;
}

export interface KPI {
  label: string;
  value: string | number;
  trend: number; // percentage
  status: 'up' | 'down' | 'neutral';
}

export interface Order {
  id: string;
  companyId?: string;
  vesselName: string;
  port: string;
  date: string;
  status: 'Pending' | 'Approved' | 'In Transit' | 'Delivered' | 'Cancelled';
  amount: number;
  currency: string;
}

export interface Shipment {
  id: string;
  companyId?: string;
  orderId: string;
  origin: string;
  destination: string;
  eta: string;
  status: 'On Time' | 'Delayed' | 'Arrived';
}

export interface Invoice {
  id: string;
  companyId?: string;
  reference: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: 'Paid' | 'Overdue' | 'Pending';
}

export interface Vessel {
  id: string;
  companyId?: string;
  name: string;
  imo: string;
  type: string;
  flagCountry?: string;
  builtYear?: number;
  dwt?: number;
  vesselStatus?: 'Active' | 'Laid Up' | 'Under Repair' | 'Scrapped';
}

export interface ContractedVessel {
  imo: string;
  name: string | null;
  dataAreaId: string | null;
  projIdDataAreaIds: string[];
}

export interface FleetMandayReportVessel {
  imo: string;
  vesselName: string;
  budget: number;
  actual: number;
  rate: number;
  variancePct: number;
  exceeded: boolean;
}

export interface FleetMandayReportKpis {
  totalSpendMtd: number;
  totalBudget: number;
  avgCostPerManday: number | null;
  targetCostPerManday: number | null;
  vesselsExceeded: number;
  vesselsTotal: number;
}

export interface FleetMandayReportException {
  imo: string;
  vesselName: string;
  mandayRate: number;
  overPct: number | null;
  noBudget?: boolean;
  severity: 'high' | 'medium';
}

export interface FleetMandayReport {
  year: number;
  month: number;
  kpis: FleetMandayReportKpis;
  exceptions: FleetMandayReportException[];
  vessels: FleetMandayReportVessel[];
}

export interface VesselPosition {
  id: string;
  vesselId: string;
  lat: number;
  lng: number;
  speed: number;
  course: number;
  heading: number;
  navStatus: string;
  destination: string;
  eta: string;
  fetchedAt: string;
}

export interface VesselRoute {
  id: string;
  vesselId: string;
  departurePort: string;
  arrivalPort: string;
  departureDate: string;
  arrivalDate?: string;
  status: 'Planned' | 'In Progress' | 'Completed' | 'Cancelled';
}

export interface OperationItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface VesselOperation {
  id: string;
  vesselId: string;
  routeId?: string;
  port: string;
  operationType: 'Bunkering' | 'Provisioning' | 'Maintenance' | 'Port Fees' | 'Crew Change';
  operationDate: string;
  items: OperationItem[];
  totalAmount: number;
  currency: string;
  supplierId?: string;
  notes?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  service: string;
}

export interface SupportTicket {
  id: string;
  createdByUserId: string;
  createdByEmail?: string;
  subject: string;
  description: string;
  category: 'General' | 'Operational' | 'Invoice' | 'Technical';
  status: 'Open' | 'Resolved';
  createdAt: string;
  replies?: SupportTicketReply[];
}

export interface SupportTicketReply {
  id: string;
  ticketId: string;
  authorUserId: string;
  authorRole: UserRole;
  message: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  targetRoute: string;
  isRead: boolean;
  createdAt?: string;
}

export interface GuestRFQ {
  id: string;
  createdByUserId: string;
  createdByEmail?: string;
  vesselName: string;
  port: string;
  details: string;
  suggestedItems?: string[];
  attachments?: RFQAttachment[];
  createdAt: string;
}

export interface AnalysisReport {
  id: string;
  name: string;
  description?: string;
  permissionKey: Permission;
  embedUrl?: string;
  workspaceId?: string;
  reportId?: string;
  datasetId?: string;
  defaultRoles?: string[];
  isActive: boolean;
  createdAt: string;
}

export interface SuggestedItem {
  id: string;
  name: string;
  quantity: number;
  reason: string;
}

export interface RFQAttachment {
  name: string;
  mimeType: string;
  sizeKb: number;
}
