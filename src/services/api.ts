
import { KPI, Order, Shipment, Invoice, Vessel, LogEntry, User, Company, Permission } from '../types';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Initial Mock Data (Stateful) ---

let mockCompanies: Company[] = [
  { id: 'C-001', name: 'Global Shipping Co.', type: 'Customer', country: 'Singapore', contactEmail: 'ops@globalshipping.com', status: 'Active' },
  { id: 'S-001', name: 'Marine Supplies Ltd.', type: 'Supplier', country: 'Netherlands', contactEmail: 'sales@marinesupplies.com', status: 'Active' },
  { id: 'C-002', name: 'Pacific Liners', type: 'Customer', country: 'USA', contactEmail: 'admin@pacificliners.com', status: 'Inactive' },
];

let mockUsers: User[] = [
  { 
    id: 'u1', 
    name: 'System Admin', 
    email: 'admin@avs.com', 
    role: 'Admin', 
    status: 'Active', 
    permissions: ['manage:users', 'manage:companies', 'system:settings', 'view:analytics'],
    lastLogin: '2023-10-24T08:30:00Z'
  },
  { 
    id: 'u2', 
    name: 'John Doe', 
    email: 'cust@shipping.com', 
    role: 'Customer', 
    companyId: 'C-001', 
    status: 'Active', 
    permissions: ['view:finance', 'edit:orders'],
    lastLogin: '2023-10-23T14:15:00Z'
  },
  { 
    id: 'u3', 
    name: 'Jane Smith', 
    email: 'supp@vendor.com', 
    role: 'Supplier', 
    companyId: 'S-001', 
    status: 'Active', 
    permissions: ['edit:orders'],
    lastLogin: '2023-10-24T09:00:00Z'
  },
];

let mockOrders: Order[] = [
  { id: 'ORD-001', vesselName: 'Avs Titan', port: 'Singapore', date: '2023-10-01', status: 'In Transit', amount: 15000, currency: 'USD' },
  { id: 'ORD-002', vesselName: 'Avs Neptune', port: 'Rotterdam', date: '2023-10-05', status: 'Pending', amount: 4500, currency: 'USD' },
  { id: 'ORD-003', vesselName: 'Avs Apollo', port: 'Houston', date: '2023-09-28', status: 'Delivered', amount: 8200, currency: 'USD' },
  { id: 'ORD-004', vesselName: 'Avs Titan', port: 'Jebel Ali', date: '2023-10-10', status: 'Approved', amount: 12300, currency: 'USD' },
  { id: 'ORD-005', vesselName: 'Avs Mercury', port: 'Shanghai', date: '2023-10-12', status: 'Cancelled', amount: 2000, currency: 'USD' },
];

const mockShipments: Shipment[] = [
  { id: 'SHP-101', orderId: 'ORD-001', origin: 'Busan', destination: 'Singapore', eta: '2023-10-15', status: 'On Time' },
  { id: 'SHP-102', orderId: 'ORD-003', origin: 'Hamburg', destination: 'Houston', eta: '2023-09-30', status: 'Arrived' },
  { id: 'SHP-103', orderId: 'ORD-004', origin: 'Dubai', destination: 'Jebel Ali', eta: '2023-10-11', status: 'Delayed' },
];

const mockInvoices: Invoice[] = [
  { id: 'INV-2023-001', reference: 'PO-9921', issueDate: '2023-09-01', dueDate: '2023-10-01', amount: 15000, status: 'Paid' },
  { id: 'INV-2023-005', reference: 'PO-9925', issueDate: '2023-09-15', dueDate: '2023-10-15', amount: 8200, status: 'Overdue' },
  { id: 'INV-2023-008', reference: 'PO-9928', issueDate: '2023-10-01', dueDate: '2023-10-31', amount: 4500, status: 'Pending' },
];

const mockVessels: Vessel[] = [
  { id: 'V-001', name: 'Avs Titan', imo: '9876543', type: 'Container' },
  { id: 'V-002', name: 'Avs Neptune', imo: '1234567', type: 'Bulker' },
  { id: 'V-003', name: 'Avs Apollo', imo: '5544332', type: 'Tanker' },
];

const mockLogs: LogEntry[] = [
  { id: 'L-1', timestamp: new Date().toISOString(), level: 'INFO', message: 'User login successful', service: 'AuthService' },
  { id: 'L-2', timestamp: new Date(Date.now() - 60000).toISOString(), level: 'WARN', message: 'High latency detected', service: 'OrderAPI' },
  { id: 'L-3', timestamp: new Date(Date.now() - 120000).toISOString(), level: 'INFO', message: 'Batch job completed', service: 'FinanceWorker' },
  { id: 'L-4', timestamp: new Date(Date.now() - 180000).toISOString(), level: 'ERROR', message: 'Database connection timeout', service: 'CoreDB' },
];

// --- API Implementation ---

export const api = {
  auth: {
    login: async (email: string): Promise<User> => {
      await delay(800);
      const user = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (user) {
          // Update last login
          user.lastLogin = new Date().toISOString();
          return { ...user };
      }
      
      // Fallbacks for dev convenience if mock users are deleted/modified
      if (email.includes('admin')) return { id: 'u1-dev', name: 'System Admin', email, role: 'Admin', status: 'Active', permissions: ['manage:users', 'manage:companies'] };
      if (email.includes('cust')) return { id: 'u2-dev', name: 'John Doe', email, role: 'Customer', companyId: 'C-001', status: 'Active', permissions: [] };
      if (email.includes('supp')) return { id: 'u3-dev', name: 'Jane Smith', email, role: 'Supplier', companyId: 'S-001', status: 'Active', permissions: [] };
      
      throw new Error('Invalid credentials');
    },
    updateProfile: async (userId: string, data: Partial<User>): Promise<User> => {
        await delay(500);
        const index = mockUsers.findIndex(u => u.id === userId);
        if (index !== -1) {
            mockUsers[index] = { ...mockUsers[index], ...data };
            return mockUsers[index];
        }
        throw new Error('User not found');
    }
  },
  admin: {
    getUsers: async (): Promise<User[]> => {
      await delay(400);
      return [...mockUsers];
    },
    createUser: async (user: Omit<User, 'id'>): Promise<User> => {
        await delay(500);
        const newUser: User = { ...user, id: `u-${Date.now()}` };
        mockUsers.push(newUser);
        return newUser;
    },
    updateUser: async (id: string, updates: Partial<User>): Promise<User> => {
        await delay(400);
        const index = mockUsers.findIndex(u => u.id === id);
        if (index === -1) throw new Error("User not found");
        mockUsers[index] = { ...mockUsers[index], ...updates };
        return mockUsers[index];
    },
    deleteUser: async (id: string): Promise<void> => {
        await delay(400);
        mockUsers = mockUsers.filter(u => u.id !== id);
    },
    getCompanies: async (): Promise<Company[]> => {
        await delay(400);
        return [...mockCompanies];
    },
    createCompany: async (company: Omit<Company, 'id'>): Promise<Company> => {
        await delay(500);
        const newCompany = { ...company, id: `${company.type === 'Customer' ? 'C' : 'S'}-${Date.now().toString().slice(-3)}` };
        mockCompanies.push(newCompany);
        return newCompany;
    },
    updateCompany: async (id: string, updates: Partial<Company>): Promise<Company> => {
        await delay(400);
        const index = mockCompanies.findIndex(c => c.id === id);
        if (index === -1) throw new Error("Company not found");
        mockCompanies[index] = { ...mockCompanies[index], ...updates };
        return mockCompanies[index];
    },
    deleteCompany: async (id: string): Promise<void> => {
        await delay(400);
        mockCompanies = mockCompanies.filter(c => c.id !== id);
    },
    getSystemLogs: async (): Promise<LogEntry[]> => {
      await delay(300);
      return mockLogs;
    },
  },
  customer: {
    getKPIs: async (): Promise<KPI[]> => {
      await delay(500);
      return [
        { label: 'Total Spend (YTD)', value: '$1.2M', trend: 12, status: 'up' },
        { label: 'Open Orders', value: mockOrders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length.toString(), trend: -5, status: 'neutral' },
        { label: 'Active Shipments', value: mockShipments.filter(s => s.status !== 'Arrived').length.toString(), trend: 2, status: 'up' },
        { label: 'Avg. Delay', value: '1.2 Days', trend: -10, status: 'down' },
      ];
    },
    getOrders: async (): Promise<Order[]> => {
      await delay(600);
      return [...mockOrders];
    },
    createOrder: async (order: Omit<Order, 'id'>): Promise<Order> => {
        await delay(500);
        const newOrder = { ...order, id: `ORD-${Date.now().toString().slice(-4)}` };
        mockOrders.unshift(newOrder); // Add to top
        return newOrder;
    },
    getFleet: async (): Promise<Vessel[]> => {
      await delay(400);
      return [...mockVessels];
    },
    getShipments: async (): Promise<Shipment[]> => {
      await delay(500);
      return [...mockShipments];
    },
    getInvoices: async (): Promise<Invoice[]> => {
      await delay(500);
      return [...mockInvoices];
    }
  },
  supplier: {
    getKPIs: async (): Promise<KPI[]> => {
      await delay(500);
      return [
        { label: 'Total Revenue', value: '$450k', trend: 8, status: 'up' },
        { label: 'Pending Orders', value: '12', trend: 15, status: 'down' },
        { label: 'OTIF Rate', value: '94%', trend: 1, status: 'up' },
      ];
    },
    getOrders: async (): Promise<Order[]> => {
      await delay(500);
      return mockOrders.filter(o => o.amount < 10000); 
    }
  },
};
