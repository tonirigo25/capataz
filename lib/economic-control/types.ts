export type EconomicArea = "resumen" | "cobros" | "pagos" | "prevision" | "rentabilidad";
export type EconomicPeriod = "7d" | "30d" | "90d";
export type EconomicDirection = "entrada" | "salida";
export type EconomicDueGroup = "vencido" | "hoy" | "proximos_7_dias" | "proximos_30_dias" | "posterior" | "sin_vencimiento";

export type EconomicDocument = {
  id: string;
  kind: "factura_emitida" | "factura_recibida" | "gasto";
  direction: EconomicDirection;
  number: string;
  description: string;
  partyId: string | null;
  partyName: string;
  workId: string | null;
  workTitle: string | null;
  issueDate: Date;
  dueDate: Date | null;
  total: number;
  paid: number;
  pending: number;
  status: string;
  href: string;
};

export type EconomicDocumentSummary = {
  documented: number;
  settled: number;
  pending: number;
  overdue: number;
  dueSoon: number;
  openCount: number;
  overdueCount: number;
  partialCount: number;
};

export type EconomicForecastPoint = {
  date: Date;
  inflows: number;
  outflows: number;
  net: number;
  balance: number | null;
  documents: EconomicDocument[];
};

export type EconomicForecast = {
  period: EconomicPeriod;
  start: Date;
  end: Date;
  openingBalance: number | null;
  inflows: number;
  outflows: number;
  net: number;
  closingBalance: number | null;
  overdue: EconomicDocument[];
  future: EconomicDocument[];
  unscheduled: EconomicDocument[];
  points: EconomicForecastPoint[];
  groups: Record<EconomicDueGroup, EconomicDocument[]>;
};

export type EconomicConcentration = {
  id: string;
  label: string;
  pending: number;
  overdue: number;
  documentCount: number;
  href: string;
};

export type EconomicProfitabilityRow = {
  workId: string;
  workTitle: string;
  clientName: string;
  status: string;
  budgeted: number;
  invoiced: number;
  collected: number;
  pending: number;
  materialCost: number;
  subcontractorCost: number;
  generalCost: number;
  realCost: number;
  profit: number | null;
  margin: number | null;
  forecastCost: number;
  deviation: number | null;
  hasEnoughData: boolean;
  href: string;
};

export type EconomicControlData = {
  area: EconomicArea;
  period: EconomicPeriod;
  updatedAt: Date;
  accounts: Array<{ id: string; name: string; type: string; balance: number; updatedAt: Date | null; isActive: boolean }>;
  registeredBalance: number | null;
  recentMovements: Array<{ id: string; date: Date; description: string; amount: number; direction: "inflow" | "outflow"; accountName: string; href: string | null }>;
  receivables: EconomicDocument[];
  payables: EconomicDocument[];
  receivableSummary: EconomicDocumentSummary;
  payableSummary: EconomicDocumentSummary;
  forecast: EconomicForecast;
  profitability: EconomicProfitabilityRow[];
  clientConcentration: EconomicConcentration[];
  supplierConcentration: EconomicConcentration[];
  attentionSignals: Array<{ id: string; level: "informacion" | "atencion" | "urgente"; title: string; explanation: string; nextStep: string; amount: number | null; href: string }>;
  filters: {
    clientId: string | null;
    workId: string | null;
    status: string | null;
    clients: Array<{ id: string; label: string }>;
    works: Array<{ id: string; label: string }>;
  };
};
