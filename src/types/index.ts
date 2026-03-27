
export type UserRole = 'supadmin' | 'admin' | 'user';

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
  | 'system:settings';

export interface Company {
  id: string;
  name: string;
  type: 'Customer' | 'Supplier';
  country: string;
  contactEmail: string;
  status: 'Active' | 'Inactive';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isGuest?: boolean;
  powerBiAccess?: 'none' | 'viewer' | 'editor';
  powerBiWorkspaceId?: string;
  powerBiReportId?: string;
  avatarUrl?: string;
  companyId?: string; // Links to Company
  temporaryPassword?: string;
  permissions: Permission[];
  status: 'Active' | 'Inactive' | 'Suspended';
  lastLogin?: string;
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
  status: 'Open' | 'In Progress' | 'Resolved';
  createdAt: string;
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
