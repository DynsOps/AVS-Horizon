export const qk = {
  // Admin
  users: {
    list: () => ['users'] as const,
    byId: (id: string) => ['users', id] as const,
    companies: (userId: string) => ['users', userId, 'companies'] as const,
    reports: (userId: string) => ['users', userId, 'reports'] as const,
    templateId: (userId: string) => ['users', userId, 'templateId'] as const,
  },
  companies: {
    list: () => ['companies'] as const,
    templateId: (companyId: string) => ['companies', companyId, 'templateId'] as const,
    groupProjtables: (scope: string) => ['companies', 'groupProjtables', scope] as const,
  },
  analysisReports: {
    adminList: () => ['analysisReports', 'admin'] as const,
    customerList: (companyId?: string | null) => ['analysisReports', 'customer', companyId ?? null] as const,
  },
  templates: {
    list: (scope: string) => ['templates', scope] as const,
    permissionsCatalog: () => ['templates', 'permissionsCatalog'] as const,
  },
  systemHealth: { all: () => ['systemHealth'] as const },
  systemLogs: { all: () => ['systemLogs'] as const },
  // Customer
  orders: {
    list: (companyId?: string | null) => ['orders', companyId ?? null] as const,
    history: (companyId?: string | null) => ['orders', 'history', companyId ?? null] as const,
  },
  shipments: { list: (companyId?: string | null) => ['shipments', companyId ?? null] as const },
  invoices: { list: (companyId?: string | null) => ['invoices', companyId ?? null] as const },
  portFees: { list: (companyId?: string | null) => ['portFees', companyId ?? null] as const },
  fleet: {
    list: (companyId?: string | null) => ['fleet', companyId ?? null] as const,
    contractedVessels: (companyId?: string | null) => ['fleet', 'contracted', companyId ?? null] as const,
    mandayReport: (year: number, month: number, companyId?: string | null) =>
      ['fleet', 'mandayReport', year, month, companyId ?? null] as const,
  },
  contractedReports: {
    analysis: (companyId?: string | null, reportId?: string | null) =>
      ['contractedReports', 'analysis', companyId ?? null, reportId ?? null] as const,
    consumption: (companyId?: string | null) => ['contractedReports', 'consumption', companyId ?? null] as const,
  },
  // Support
  support: {
    myTickets: () => ['support', 'myTickets'] as const,
    adminTickets: () => ['support', 'adminTickets'] as const,
    openCount: () => ['support', 'openCount'] as const,
  },
  // Notifications
  notifications: { list: () => ['notifications'] as const },
  // Maritime
  maritime: {
    mapPayload: (companyId?: string | null) => ['maritime', 'mapPayload', companyId ?? null] as const,
    operations: (companyId?: string | null) => ['maritime', 'operations', companyId ?? null] as const,
    vessels: () => ['maritime', 'vessels'] as const,
    vessel: (id: string) => ['maritime', 'vessel', id] as const,
    vesselPosition: (id: string) => ['maritime', 'vesselPosition', id] as const,
    vesselRoutes: (id: string) => ['maritime', 'vesselRoutes', id] as const,
    vesselOperations: (id: string) => ['maritime', 'vesselOperations', id] as const,
  },
  // Guest
  rfq: { list: (userId?: string | null) => ['rfq', userId ?? null] as const },
  // Supplier
  supplier: { kpis: () => ['supplier', 'kpis'] as const },
  // PowerBI
  powerbi: { embed: (reportId?: string | null) => ['powerbi', 'embed', reportId ?? null] as const },
} as const;
