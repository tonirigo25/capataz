import { notFound } from "next/navigation";
import WorkDetailPage, { type WorkDetailQuery } from "../page";

export const dynamic = "force-dynamic";

const directRoutes: Record<string, WorkDetailQuery> = {
  planificacion: { vista: "planificacion", subvista: "resumen" },
  "planificacion/gantt": { vista: "planificacion", subvista: "gantt" },
  "planificacion/calendario": { vista: "planificacion", subvista: "calendario" },
  "planificacion/hitos": { vista: "planificacion", subvista: "hitos" },
  "planificacion/dependencias": { vista: "planificacion", subvista: "dependencias" },
  "planificacion/ruta-critica": { vista: "planificacion", subvista: "ruta-critica" },
  "planificacion/carga-trabajo": { vista: "planificacion", subvista: "carga-trabajo" },
  "planificacion/recursos": { vista: "planificacion", subvista: "recursos" },
  "planificacion/linea-base": { vista: "planificacion", subvista: "linea-base" },
  "planificacion/escenarios": { vista: "planificacion", subvista: "escenarios" },
  partes: { vista: "partes", subvista: "resumen" },
  "partes/listado": { vista: "partes", subvista: "listado" },
  "partes/diarios": { vista: "partes", subvista: "listado" },
  "partes/actividades": { vista: "partes", subvista: "actividades" },
  "partes/nuevo": { vista: "partes", subvista: "nuevo" },
  "partes/analisis": { vista: "partes", subvista: "analisis" },
  "partes/semanales": { vista: "partes", subvista: "semanales" },
  "partes/mensuales": { vista: "partes", subvista: "mensuales" },
  "partes/reportes": { vista: "partes", subvista: "reportes" },
  costes: { vista: "costes", subvista: "resumen" },
  "costes/estructura": { vista: "costes", subvista: "estructura" },
  "costes/analisis": { vista: "costes", subvista: "analisis" },
  "costes/incidencias": { vista: "costes", subvista: "incidencias" },
  "costes/ranking": { vista: "costes", subvista: "ranking" },
  "costes/proveedores": { vista: "costes", subvista: "proveedores" },
  "costes/mano-obra": { vista: "costes", subvista: "mano-obra" },
  "costes/materiales": { vista: "costes", subvista: "materiales" },
  "costes/subcontratas": { vista: "costes", subvista: "subcontratas" },
  "costes/comparativa": { vista: "costes", subvista: "comparativa" },
  "costes/informes": { vista: "costes", subvista: "informes" },
  "costes/ordenes": { vista: "costes", subvista: "ordenes" },
  documentos: { vista: "documentos", subvista: "documentos" },
  "documentos/subir": { vista: "documentos", subvista: "subir" },
  "documentos/galeria": { vista: "documentos", subvista: "galeria" },
  "documentos/planos": { vista: "documentos", subvista: "planos" },
  "documentos/certificados": { vista: "documentos", subvista: "certificados" },
  "documentos/informes": { vista: "documentos", subvista: "informes" },
  "documentos/otros": { vista: "documentos", subvista: "otros" },
  equipo: { vista: "equipo", subvista: "equipo" },
  "equipo/carga": { vista: "equipo", subvista: "carga" },
  "equipo/turnos": { vista: "equipo", subvista: "turnos" },
  "equipo/subcontratas": { vista: "equipo", subvista: "subcontratas" },
  "equipo/formacion": { vista: "equipo", subvista: "formacion" },
  "equipo/permisos": { vista: "equipo", subvista: "permisos" },
  facturacion: { vista: "facturacion", subvista: "resumen" },
  "facturacion/certificaciones": { vista: "facturacion", subvista: "certificaciones" },
  "facturacion/facturas": { vista: "facturacion", subvista: "facturas" },
  "facturacion/hitos": { vista: "facturacion", subvista: "hitos" },
  "facturacion/retenciones": { vista: "facturacion", subvista: "retenciones" },
  "facturacion/cobros": { vista: "facturacion", subvista: "cobros" },
  "facturacion/vencimientos": { vista: "facturacion", subvista: "vencimientos" },
  "facturacion/historico": { vista: "facturacion", subvista: "historico" },
  incidencias: { vista: "incidencias", subvista: "todas" },
  ordenes: { vista: "costes", subvista: "ordenes" },
};

export default async function WorkSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; section: string[] }>;
  searchParams: Promise<{ modo?: string; returnTo?: string }>;
}) {
  const [{ id, section }, existing] = await Promise.all([params, searchParams]);
  const route = section.join("/");
  const direct = directRoutes[route];
  const detail = section.length === 2 && ["partes", "incidencias", "ordenes"].includes(section[0]) && !direct
    ? { vista: section[0] === "partes" ? "partes" : section[0] === "incidencias" ? "incidencias" : "costes", subvista: section[0] === "ordenes" ? "ordenes" : section[0] === "partes" ? "listado" : "todas", detalle: section[1] }
    : null;
  const query = direct ?? detail;
  if (!query) notFound();
  return WorkDetailPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({ ...query, modo: existing.modo, returnTo: existing.returnTo }) });
}
