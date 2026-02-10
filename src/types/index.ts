
export type UserRole = 'Admin' | 'Customer' | 'Supplier';

export type Permission = 
  | 'manage:users' 
  | 'manage:companies' 
  | 'view:finance' 
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
  avatarUrl?: string;
  companyId?: string; // Links to Company
  permissions: Permission[];
  status: 'Active' | 'Inactive' | 'Suspended';
  lastLogin?: string;
}

export interface KPI {
  label: string;
  value: string | number;
  trend: number; // percentage
  status: 'up' | 'down' | 'neutral';
}

export interface Order {
  id: string;
  vesselName: string;
  port: string;
  date: string;
  status: 'Pending' | 'Approved' | 'In Transit' | 'Delivered' | 'Cancelled';
  amount: number;
  currency: string;
}

export interface Shipment {
  id: string;
  orderId: string;
  origin: string;
  destination: string;
  eta: string;
  status: 'On Time' | 'Delayed' | 'Arrived';
}

export interface Invoice {
  id: string;
  reference: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: 'Paid' | 'Overdue' | 'Pending';
}

export interface Vessel {
  id: string;
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
