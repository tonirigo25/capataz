import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ContactRound,
  DatabaseZap,
  Download,
  Eye,
  Files,
  Handshake,
  Landmark,
  ListChecks,
  NotebookPen,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
  UsersRound,
} from "lucide-react";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";
import { requireCompanyRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  IMPORT_CATALOG,
  IMPORT_GROUPS,
  IMPORT_KINDS,
  PROTECTED_IMPORT_AREAS,
  getImportDefinition,
  isImportKind,
  type ImportKind,
} from "@/lib/product/import-catalog";
import { applyImport, previewImport, rollbackImport } from "./actions";
import { ImportKindSelect } from "./import-kind-select";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const kindIcons = {
  CLIENTS: UsersRound,
  CONTACTS: ContactRound,
  WORKS: BriefcaseBusiness,
  TASKS: ListChecks,
  FOLLOW_UPS: Handshake,
  SUPPLIERS: Building2,
  SUBCONTRACTORS: UsersRound,
  FINANCIAL_ACCOUNTS: Landmark,
  INTERNAL_NOTES: NotebookPen,
  DOCUMENTS: Files,
} satisfies Record<ImportKind, typeof UsersRound>;

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const actor = await requireCompanyRole(["OWNER", "ADMIN"]);
  const query = await searchParams;
  const selectedKind = isImportKind(String(query.kind ?? "")) ? String(query.kind) as ImportKind : "CLIENTS";
  const selected = IMPORT_CATALOG[selectedKind];
  const batches = await prisma.companyImportBatch.findMany({
    where: { companyId: actor.companyId },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: { rows: { orderBy: { rowNumber: "asc" }, take: 25 } },
  });

  return (
    <main className={`screen ${styles.page}`}>
      <InternalBreadcrumbs items={[{ label: "Configuración", href: "/configuracion" }, { label: "Importación segura" }]} />

      <header className={styles.hero}>
        <div>
          <h1>Importación segura</h1>
          <p>Migra información a Orqena con plantillas verificables. Cada archivo pasa por una vista previa, comprueba duplicados y relaciones dentro de tu empresa, exige confirmación humana y conserva evidencia del lote.</p>
        </div>
        <span className={styles.safeBadge}><ShieldCheck size={15} /> Sólo OWNER y ADMIN</span>
      </header>

      <section className={styles.metrics} aria-label="Controles de importación">
        <Metric icon={<DatabaseZap size={14} />} label="Tipos disponibles" value={`${IMPORT_KINDS.length}`} detail="Plantillas CSV separadas" />
        <Metric icon={<Eye size={14} />} label="Antes de crear" value="Vista previa" detail="Errores y duplicados visibles" />
        <Metric icon={<UploadCloud size={14} />} label="Límite por lote" value="500 filas" detail="Hasta 512 KB" />
        <Metric icon={<RotateCcw size={14} />} label="Control posterior" value="Reversible" detail="Archivado con evidencia" />
      </section>

      <section className={styles.workflow} aria-label="Flujo seguro">
        <article><b>1</b><strong>Descarga la plantilla</strong><p>Usa una estructura específica por módulo y conserva la cabecera.</p></article>
        <article><b>2</b><strong>Completa referencias</strong><p>Relaciona clientes, trabajos y colaboradores mediante claves estables.</p></article>
        <article><b>3</b><strong>Revisa el diagnóstico</strong><p>Ninguna fila inválida o duplicada se crea silenciosamente.</p></article>
        <article><b>4</b><strong>Confirma o revierte</strong><p>La aplicación requiere la clave exacta y deja trazabilidad.</p></article>
      </section>

      <SectionHeading title="Plantillas por módulo" description="Los campos verdes son obligatorios. Los ejemplos usan datos ficticios y pueden eliminarse antes de importar." link="#preparar" linkLabel="Ir a preparar archivo" />
      <div className={styles.groups}>
        {IMPORT_GROUPS.map((group) => {
          const definitions = IMPORT_KINDS.map((kind) => IMPORT_CATALOG[kind]).filter((item) => item.group === group);
          if (!definitions.length) return null;
          return (
            <section className={styles.group} key={group}>
              <h2 className={styles.groupTitle}><CheckCircle2 size={13} /> {group}</h2>
              <div className={styles.catalog}>
                {definitions.map((definition) => {
                  const Icon = kindIcons[definition.kind];
                  return (
                    <article className={styles.catalogCard} key={definition.kind}>
                      <span className={styles.catalogIcon}><Icon size={18} /></span>
                      <div>
                        <h3>{definition.label}</h3>
                        <p>{definition.description}</p>
                        <span className={styles.dependency}>{definition.dependency}</span>
                        <div className={styles.fieldChips} aria-label={`Columnas de ${definition.label}`}>
                          {definition.fields.slice(0, 7).map((field) => <span key={field.name} data-required={field.required ? "true" : "false"}>{field.name}</span>)}
                          {definition.fields.length > 7 ? <span>+{definition.fields.length - 7}</span> : null}
                        </div>
                      </div>
                      <div className={styles.catalogActions}>
                        <a className={styles.downloadButton} href={`/configuracion/importar/plantillas/${definition.kind.toLowerCase()}`}><Download size={12} /> Descargar CSV</a>
                        <Link className={styles.prepareButton} href={`/configuracion/importar?kind=${definition.kind}#preparar`}>Preparar <ArrowRight size={11} /></Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <SectionHeading title="Preparar y validar" description={`Importación seleccionada: ${selected.label}. La plantilla no contiene información real de tu empresa.`} link={`/configuracion/importar/plantillas/${selected.kind.toLowerCase()}`} linkLabel="Descargar plantilla seleccionada" />
      <section className={styles.workspace} id="preparar">
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>Paso controlado</span>
            <h3>Crear vista previa</h3>
            <p>Primero se valida el archivo completo. Aplicar datos será una acción posterior y separada.</p>
          </div>
          <form action={previewImport} className={styles.form}>
            <div className={styles.formGrid}>
              <label className={styles.label}>
                Tipo de datos
                <ImportKindSelect value={selectedKind} />
              </label>
              <label className={styles.label}>
                Archivo CSV
                <input type="file" name="csv" accept=".csv,text/csv,text/plain" required />
              </label>
            </div>
            <div className={styles.notice}><ShieldCheck size={16} /> <span>Los datos se aíslan por empresa. Las referencias externas no se aceptan, las fórmulas de hoja de cálculo se bloquean y las filas duplicadas quedan fuera de la aplicación.</span></div>
            <button className={styles.submit}><Eye size={14} /> Crear vista previa sin importar</button>
          </form>
        </div>

        <aside className={`${styles.panel} ${styles.schema}`} aria-label={`Estructura de ${selected.label}`}>
          <div className={styles.schemaIntro}>
            <h3>Estructura · {selected.label}</h3>
            <a href={`/configuracion/importar/plantillas/${selected.kind.toLowerCase()}`}>Descargar CSV</a>
          </div>
          <div className={styles.schemaList}>
            {selected.fields.map((field) => (
              <div className={styles.schemaRow} key={field.name}>
                <code>{field.name}{field.required ? <em>obligatorio</em> : null}</code>
                <div>{field.help}<small>Ejemplo: {field.example || "vacío"}</small></div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <SectionHeading title="Datos con flujo protegido" description="Estas áreas no se ocultan: se explican y enlazan al flujo correcto porque un CSV genérico podría alterar saldos, numeración, permisos o cumplimiento." />
      <section className={styles.protected}>
        {PROTECTED_IMPORT_AREAS.map((area) => <Link href={area.href} key={area.label}><strong>{area.label}</strong><p>{area.reason}</p><span>Abrir gestión segura →</span></Link>)}
      </section>

      <SectionHeading title="Lotes recientes" description="Se muestran hasta 25 filas por lote. La evidencia completa permanece registrada." />
      <section className={styles.batches}>
        {batches.map((batch) => {
          const definition = getImportDefinition(batch.kind);
          return (
            <article key={batch.id} className={styles.batch}>
              <header className={styles.batchHeader}>
                <div><h3>{definition?.label ?? batch.kind} · {formatDate(batch.createdAt)}</h3><p>{batch.totalRows} filas · {batch.validRows} válidas · {batch.invalidRows} con error · {batch.duplicateRows} duplicadas · {batch.appliedRows} aplicadas</p></div>
                <span className={styles.status}>{batchStatus(batch.status)}</span>
              </header>
              <div className={styles.batchBody}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead><tr><th>Fila</th><th>Estado</th><th>Diagnóstico</th></tr></thead>
                    <tbody>{batch.rows.map((row) => <tr key={row.id}><td>{row.rowNumber}</td><td>{rowStatus(row.status)}</td><td>{errorText(row.errorCodes)}</td></tr>)}</tbody>
                  </table>
                </div>
                {batch.status === "PREVIEWED" ? (
                  <form action={applyImport} className={styles.batchAction}>
                    <input type="hidden" name="batchId" value={batch.id} />
                    <p>Confirma sólo después de revisar errores y duplicados. Copia exactamente la clave mostrada.</p>
                    <code>{batch.confirmationKey}</code>
                    <input name="confirmation" aria-label="Clave de confirmación" placeholder={batch.confirmationKey} autoComplete="off" required />
                    <button>Aplicar {batch.validRows} filas válidas</button>
                  </form>
                ) : null}
                {batch.status === "APPLIED" ? (
                  <form action={rollbackImport} className={styles.batchAction}>
                    <input type="hidden" name="batchId" value={batch.id} />
                    <p>La reversión archiva únicamente los registros creados por este lote y conserva su evidencia.</p>
                    <code>{`ROLLBACK_BATCH:${batch.id}`}</code>
                    <input name="confirmation" aria-label="Clave de reversión" placeholder={`ROLLBACK_BATCH:${batch.id}`} autoComplete="off" required />
                    <button data-tone="secondary">Revertir este lote</button>
                  </form>
                ) : null}
              </div>
            </article>
          );
        })}
        {!batches.length ? <div className={styles.empty}>Todavía no hay lotes. Descarga una plantilla y crea una vista previa para comenzar.</div> : null}
      </section>
    </main>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <article className={styles.metric}><span>{icon}{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function SectionHeading({ title, description, link, linkLabel }: { title: string; description: string; link?: string; linkLabel?: string }) {
  return <div className={styles.sectionHeader}><div><h2>{title}</h2><p>{description}</p></div>{link && linkLabel ? <a href={link}>{linkLabel}</a> : null}</div>;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }).format(value);
}

function batchStatus(value: string) {
  return ({ PREVIEWED: "Vista previa", APPLIED: "Aplicado", ROLLED_BACK: "Revertido" } as Record<string, string>)[value] ?? value;
}

function rowStatus(value: string) {
  return ({ VALID: "Válida", INVALID: "Con error", DUPLICATE: "Duplicada", APPLIED: "Aplicada", ROLLED_BACK: "Revertida", DUPLICATE_AT_APPLY: "Duplicada al aplicar", INVALID_AT_APPLY: "Referencia cambió" } as Record<string, string>)[value] ?? value;
}

function errorText(value: unknown) {
  return Array.isArray(value) && value.length ? value.join(", ") : "Sin incidencias";
}
