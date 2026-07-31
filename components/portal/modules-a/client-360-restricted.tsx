import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Client360RailShell } from "@/components/portal/modules-a/client-360-rail-shell";
import { StatusPill } from "@/components/status-pill";

type RestrictedContact = {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
};

type RestrictedWork = {
  id: string;
  title: string;
  status: string;
  address?: string;
  createBudgetHref?: string;
};

type RestrictedBudget = {
  id: string;
  number: string;
  title: string;
  status: string;
  total?: string;
};

type RestrictedInvoice = {
  id: string;
  number: string;
  concept: string;
  status: string;
  total: string;
  pending: string;
};

type RestrictedAction = {
  id: "budget" | "contact" | "followup";
  label: string;
  href: string;
};

export function Client360Restricted({
  client,
  contacts,
  works,
  budgets,
  invoices,
  visibility,
  actions,
  canUseAi,
}: {
  client: {
    id: string;
    displayName: string;
    legalName?: string;
    origin: string;
    status: string;
    archived: boolean;
    phone?: string;
    email?: string;
  };
  contacts: RestrictedContact[];
  works: RestrictedWork[];
  budgets: RestrictedBudget[];
  invoices: RestrictedInvoice[];
  visibility: {
    works: boolean;
    budgets: boolean;
    invoices: boolean;
  };
  actions: RestrictedAction[];
  canUseAi: boolean;
}) {
  const areas = [
    { id: "resumen", label: "Resumen", icon: Building2, visible: true },
    { id: "relacion", label: "Relación", icon: UsersRound, visible: true },
    {
      id: "operacion",
      label: "Operación",
      icon: BriefcaseBusiness,
      visible: visibility.works,
    },
    {
      id: "dinero",
      label: "Dinero",
      icon: CircleDollarSign,
      visible: visibility.budgets || visibility.invoices,
    },
  ].filter((area) => area.visible);
  const directContact = contacts[0];
  const identityContact =
    directContact?.email ??
    directContact?.phone ??
    client.email ??
    client.phone ??
    "Sin contacto directo";
  const initials = client.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <div
      className="client-360-canonical grid min-w-0 items-stretch gap-4"
      data-client-360-canonical
      data-has-client-rail={canUseAi ? "true" : "false"}
    >
      <div className="min-w-0 space-y-4">
        <header>
          <Link
            href="/clientes"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Clientes
          </Link>
          <h1 className="type-page-title text-content">Cliente 360</h1>
        </header>

        <section
          className="client-360-canonical__identity rounded-xl border border-border bg-surface p-5 shadow-soft"
          aria-labelledby="restricted-client-360-identity"
        >
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(15rem,0.75fr)_auto]">
            <div className="flex min-w-0 gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-lg font-bold text-brand-strong">
                {initials || "C"}
              </span>
              <div className="min-w-0">
                <p className="type-label">Cliente 360 · alcance autorizado</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h2
                    id="restricted-client-360-identity"
                    className="type-section-title break-words text-content"
                  >
                    {client.displayName}
                  </h2>
                  <StatusPill
                    status={client.archived ? "archivado" : client.status}
                  />
                </div>
                <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <Fact label="Origen" value={client.origin} />
                  {client.legalName && client.legalName !== client.displayName ? (
                    <Fact label="Razón social" value={client.legalName} />
                  ) : null}
                </dl>
              </div>
            </div>

            <div className="border-t border-border pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
              <p className="type-label">Contacto principal</p>
              <p className="mt-1 break-words font-semibold text-content">
                {directContact?.name ?? client.displayName}
              </p>
              <p className="mt-1 break-words text-sm text-content-secondary">
                {identityContact}
              </p>
              <p className="mt-4 text-xs leading-5 text-content-tertiary">
                Esta ficha muestra exclusivamente la información incluida en tu alcance.
              </p>
            </div>

            <nav className="grid min-w-48 content-start gap-2" aria-label={`Acciones de ${client.displayName}`}>
              {client.email ? (
                <Link href={`mailto:${client.email}`} className="secondary-button w-full">
                  <Mail size={16} aria-hidden="true" /> Enviar mensaje
                </Link>
              ) : null}
              {client.phone ? (
                <Link
                  href={`tel:${client.phone.replace(/\s+/g, "")}`}
                  className="secondary-button w-full"
                >
                  <Phone size={16} aria-hidden="true" /> Llamar
                </Link>
              ) : null}
              {actions.map((action) => (
                <Link
                  key={action.id}
                  href={action.href}
                  className={action.id === "budget" ? "primary-button w-full" : "secondary-button w-full"}
                >
                  <ActionIcon action={action.id} />
                  {action.label}
                </Link>
              ))}
            </nav>
          </div>
        </section>

        <nav
          className="flex min-w-0 gap-1 overflow-x-auto border-b border-border"
          aria-label="Áreas autorizadas de Cliente 360"
        >
          {areas.map((area, index) => {
            const Icon = area.icon;
            return (
              <a
                key={area.id}
                href={`#${area.id}`}
                aria-current={index === 0 ? "location" : undefined}
                className={`inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${
                  index === 0
                    ? "border-brand text-brand-strong"
                    : "border-transparent text-content-secondary hover:text-content"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {area.label}
              </a>
            );
          })}
        </nav>

        <section id="resumen" className="scroll-mt-24" aria-labelledby="restricted-summary-title">
          <h2 id="restricted-summary-title" className="sr-only">
            Resumen autorizado
          </h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <SummaryCard title="Contacto" icon={UserRound}>
              <p className="font-semibold text-content">
                {directContact?.name ?? client.displayName}
              </p>
              <p className="mt-1 break-words text-sm text-content-secondary">
                {identityContact}
              </p>
            </SummaryCard>
            <SummaryCard title="Áreas visibles" icon={Building2}>
              <p className="text-2xl font-bold tabular-nums text-content">{areas.length}</p>
              <p className="mt-1 text-sm text-content-secondary">
                {areas.map((area) => area.label).join(" · ")}
              </p>
            </SummaryCard>
            <SummaryCard title="Acciones disponibles" icon={Plus}>
              <p className="text-2xl font-bold tabular-nums text-content">{actions.length}</p>
              <p className="mt-1 text-sm text-content-secondary">
                {actions.length
                  ? actions.map((action) => action.label).join(" · ")
                  : "Sin acciones de edición autorizadas"}
              </p>
            </SummaryCard>
          </div>
        </section>

        <section id="relacion" className="scroll-mt-24" aria-labelledby="restricted-contacts-title">
          <CollectionCard
            title="Contactos"
            icon={UsersRound}
            empty="Sin contactos disponibles."
            count={contacts.length}
          >
            {contacts.map((contact) => (
              <article key={contact.id} className="py-3">
                <p className="font-semibold text-content">{contact.name}</p>
                <p className="mt-1 break-words text-sm text-content-secondary">
                  {[contact.role, contact.phone, contact.email].filter(Boolean).join(" · ")}
                </p>
              </article>
            ))}
          </CollectionCard>
        </section>

        {visibility.works ? (
          <section id="operacion" className="scroll-mt-24" aria-labelledby="restricted-works-title">
            <CollectionCard
              title="Trabajos autorizados"
              icon={BriefcaseBusiness}
              empty="Sin trabajos en tu alcance."
              count={works.length}
            >
              {works.map((work) => (
                <article key={work.id} className="py-3">
                  <Link href={`/obras/${work.id}`} className="block hover:underline">
                    <p className="font-semibold text-content">{work.title}</p>
                    <p className="mt-1 text-sm text-content-secondary">
                      {[work.status, work.address].filter(Boolean).join(" · ")}
                    </p>
                  </Link>
                  {work.createBudgetHref ? (
                    <Link href={work.createBudgetHref} className="secondary-button mt-3">
                      <FileText size={16} aria-hidden="true" /> Crear presupuesto
                    </Link>
                  ) : null}
                </article>
              ))}
            </CollectionCard>
          </section>
        ) : null}

        {visibility.budgets || visibility.invoices ? (
          <section id="dinero" className="scroll-mt-24" aria-labelledby="restricted-money-title">
            <h2 id="restricted-money-title" className="sr-only">
              Información económica autorizada
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {visibility.budgets ? (
                <CollectionCard
                  title="Presupuestos autorizados"
                  icon={FileText}
                  empty="Sin presupuestos en tu alcance."
                  count={budgets.length}
                >
                  {budgets.map((budget) => (
                    <Link
                      key={budget.id}
                      href={`/presupuestos/${budget.id}`}
                      className="block py-3 hover:underline"
                    >
                      <p className="font-semibold text-content">
                        {budget.number} · {budget.title}
                      </p>
                      <p className="mt-1 text-sm text-content-secondary">
                        {[budget.status, budget.total].filter(Boolean).join(" · ")}
                      </p>
                    </Link>
                  ))}
                </CollectionCard>
              ) : null}
              {visibility.invoices ? (
                <CollectionCard
                  title="Facturas autorizadas"
                  icon={CircleDollarSign}
                  empty="Sin facturas en tu alcance."
                  count={invoices.length}
                >
                  {invoices.map((invoice) => (
                    <Link
                      key={invoice.id}
                      href={`/dinero/${invoice.id}`}
                      className="block py-3 hover:underline"
                    >
                      <p className="font-semibold text-content">
                        {invoice.number} · {invoice.concept}
                      </p>
                      <p className="mt-1 text-sm text-content-secondary">
                        {invoice.status} · {invoice.total} · {invoice.pending} pendiente
                      </p>
                    </Link>
                  ))}
                </CollectionCard>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>

      {canUseAi ? (
        <Client360RailShell>
          <div
            id="client-360-ai-context"
            className="flex flex-col p-5"
            role="region"
            aria-label={`Contexto de Orqena IA para ${client.displayName}`}
          >
            <p className="type-label">Contexto autorizado</p>
            <section className="mt-5 rounded-xl border border-brand/30 bg-surface p-4 shadow-soft">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                <Sparkles size={20} aria-hidden="true" />
              </span>
              <h2 className="mt-5 font-semibold text-content">
                Datos disponibles para {client.displayName}
              </h2>
              <p className="mt-3 text-sm leading-6 text-content-secondary">
                Orqena IA trabajará sólo con la información incluida en tu alcance actual.
              </p>
              <dl className="mt-5 grid gap-3 rounded-xl bg-brand-soft p-4">
                <RailFact label="Contactos" value={contacts.length} />
                {visibility.works ? <RailFact label="Trabajos" value={works.length} /> : null}
                {visibility.budgets ? <RailFact label="Presupuestos" value={budgets.length} /> : null}
                {visibility.invoices ? <RailFact label="Facturas" value={invoices.length} /> : null}
              </dl>
              <Link
                href={`/capataz?clienteId=${client.id}`}
                className="primary-button mt-5 w-full"
              >
                Consultar en Orqena IA
              </Link>
            </section>
            <Link
              href={`/capataz?clienteId=${client.id}`}
              className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-strong hover:underline"
            >
              Ver contexto completo
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </Client360RailShell>
      ) : null}
    </div>
  );
}

function ActionIcon({ action }: { action: RestrictedAction["id"] }) {
  if (action === "budget") return <FileText size={16} aria-hidden="true" />;
  if (action === "contact") return <UserRound size={16} aria-hidden="true" />;
  return <MessageCircle size={16} aria-hidden="true" />;
}

function SummaryCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Building2;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-soft">
      <h2 className="inline-flex items-center gap-2 font-semibold text-content">
        <Icon size={17} aria-hidden="true" />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CollectionCard({
  title,
  icon: Icon,
  empty,
  count,
  children,
}: {
  title: string;
  icon: typeof Building2;
  empty: string;
  count: number;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-soft">
      <header className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 font-semibold text-content">
          <Icon size={17} aria-hidden="true" />
          {title}
        </h2>
        <span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-semibold text-content-secondary">
          {count}
        </span>
      </header>
      <div className="mt-3 divide-y divide-border">
        {hasChildren ? children : <p className="py-3 text-sm text-content-secondary">{empty}</p>}
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="type-label">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-content">{value}</dd>
    </div>
  );
}

function RailFact({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-content-secondary">{label}</dt>
      <dd className="font-semibold tabular-nums text-brand-strong">{value}</dd>
    </div>
  );
}
