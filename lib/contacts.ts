export type ContactDisplay = {
  id: string;
  source: "real" | "legacy";
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  flags: string[];
  notes: string | null;
  archivedAt?: Date | null;
};

type RealContact = {
  id: string;
  nombre: string;
  apellidos?: string | null;
  cargo?: string | null;
  telefono?: string | null;
  email?: string | null;
  isPrimary?: boolean;
  isBillingContact?: boolean;
  isSiteContact?: boolean;
  notes?: string | null;
  archivedAt?: Date | null;
};

type LegacyClientContacts = {
  id: string;
  nombre: string;
  tipo: string;
  telefono: string;
  email?: string | null;
  contactoPrincipalNombre?: string | null;
  contactoPrincipalCargo?: string | null;
  contactoPrincipalTelefono?: string | null;
  contactoPrincipalEmail?: string | null;
  contactoFacturacionNombre?: string | null;
  telefonoFacturacion?: string | null;
  emailFacturacion?: string | null;
  contacts?: RealContact[];
};

export function buildClientContacts(client: LegacyClientContacts): ContactDisplay[] {
  const real = (client.contacts ?? []).map(realContactDisplay);
  const activeReal = real.filter((contact) => !contact.archivedAt);
  const derived = legacyContactDisplays(client).filter((legacy) => !activeReal.some((contact) => sameContact(contact, legacy)));
  return [...activeReal, ...derived, ...real.filter((contact) => contact.archivedAt)];
}

export function contactName(contact: { nombre: string; apellidos?: string | null }) {
  return [contact.nombre, contact.apellidos].filter(Boolean).join(" ").trim();
}

export function contactFlags(contact: { isPrimary?: boolean; isBillingContact?: boolean; isSiteContact?: boolean; archivedAt?: Date | null }) {
  const flags: string[] = [];
  if (contact.isPrimary) flags.push("Principal");
  if (contact.isBillingContact) flags.push("Facturación");
  if (contact.isSiteContact) flags.push("Obra");
  if (contact.archivedAt) flags.push("Archivado");
  return flags;
}

function realContactDisplay(contact: RealContact): ContactDisplay {
  return {
    id: contact.id,
    source: "real",
    name: contactName(contact),
    role: contact.cargo ?? roleFromFlags(contact),
    phone: contact.telefono ?? null,
    email: contact.email ?? null,
    flags: contactFlags(contact),
    notes: contact.notes ?? null,
    archivedAt: contact.archivedAt ?? null
  };
}

function legacyContactDisplays(client: LegacyClientContacts): ContactDisplay[] {
  const contacts: ContactDisplay[] = [];
  const primaryName = client.contactoPrincipalNombre || (client.tipo === "Particular" ? client.nombre : null);
  if (primaryName || client.contactoPrincipalTelefono || client.contactoPrincipalEmail) {
    contacts.push({
      id: "legacy-primary",
      source: "legacy",
      name: primaryName ?? "Contacto principal",
      role: client.contactoPrincipalCargo ?? "Contacto principal",
      phone: client.contactoPrincipalTelefono ?? client.telefono,
      email: client.contactoPrincipalEmail ?? client.email ?? null,
      flags: ["Principal", "Legacy"],
      notes: "Contacto defensivo derivado de los campos antiguos del cliente."
    });
  }

  if (client.contactoFacturacionNombre || client.emailFacturacion || client.telefonoFacturacion) {
    contacts.push({
      id: "legacy-billing",
      source: "legacy",
      name: client.contactoFacturacionNombre ?? "Facturación",
      role: "Facturación",
      phone: client.telefonoFacturacion ?? client.telefono,
      email: client.emailFacturacion ?? client.email ?? null,
      flags: ["Facturación", "Legacy"],
      notes: "Contacto defensivo derivado de los datos de facturación del cliente."
    });
  }
  return contacts;
}

function roleFromFlags(contact: { isPrimary?: boolean; isBillingContact?: boolean; isSiteContact?: boolean }) {
  if (contact.isBillingContact) return "Facturación";
  if (contact.isSiteContact) return "Contacto de obra";
  if (contact.isPrimary) return "Contacto principal";
  return "Contacto";
}

function sameContact(a: ContactDisplay, b: ContactDisplay) {
  const aKey = normalize(`${a.email ?? ""}|${a.phone ?? ""}|${a.name}`);
  const bKey = normalize(`${b.email ?? ""}|${b.phone ?? ""}|${b.name}`);
  return aKey === bKey || (!!a.email && !!b.email && normalize(a.email) === normalize(b.email)) || (!!a.phone && !!b.phone && normalizePhone(a.phone) === normalizePhone(b.phone));
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}
