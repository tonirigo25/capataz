export type OperationalSignalLevel = "informacion" | "atencion" | "urgente";

export type OperationalSignalCategory =
  | "planificacion"
  | "actividad"
  | "ventas"
  | "cobros"
  | "compras_documentacion"
  | "economia_obra";

export type OperationalEntityType = "cliente" | "obra" | "factura" | "presupuesto" | "tarea" | "seguimiento" | "agenda" | "proveedor" | "factura_recibida";

export type OperationalEntity = {
  type: OperationalEntityType;
  id: string;
  label: string;
  href: string;
  clientId?: string | null;
  workId?: string | null;
};

export type OperationalSignal = {
  id: string;
  rule: string;
  category: OperationalSignalCategory;
  level: OperationalSignalLevel;
  title: string;
  explanation: string;
  nextStep: string;
  referenceDate: Date | null;
  entity: OperationalEntity;
  amount?: number;
  days?: number;
};

export type OperationalContext = {
  signals: OperationalSignal[];
  principal: OperationalSignal | null;
  phrase: string;
  nextStep: string;
  counts: Record<OperationalSignalLevel, number>;
};
