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
  partes: { vista: "partes", subvista: "resumen" },
  "partes/actividades": { vista: "partes", subvista: "actividades" },
  "partes/nuevo": { vista: "partes", subvista: "nuevo" },
  "partes/analisis": { vista: "partes", subvista: "analisis" },
  costes: { vista: "costes", subvista: "resumen" },
  "costes/estructura": { vista: "costes", subvista: "estructura" },
  "costes/analisis": { vista: "costes", subvista: "analisis" },
  "costes/incidencias": { vista: "costes", subvista: "incidencias" },
  "costes/ranking": { vista: "costes", subvista: "ranking" },
  documentos: { vista: "documentos", subvista: "documentos" },
  "documentos/subir": { vista: "documentos", subvista: "subir" },
  "documentos/galeria": { vista: "documentos", subvista: "galeria" },
  equipo: { vista: "equipo", subvista: "equipo" },
  facturacion: { vista: "facturacion", subvista: "resumen" },
  incidencias: { vista: "incidencias", subvista: "todas" },
  ordenes: { vista: "costes", subvista: "ordenes" },
};

export default async function WorkSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; section: string[] }>;
  searchParams: Promise<{ modo?: string }>;
}) {
  const [{ id, section }, existing] = await Promise.all([params, searchParams]);
  const route = section.join("/");
  const direct = directRoutes[route];
  const detail = section.length === 2 && ["partes", "incidencias", "ordenes"].includes(section[0])
    ? { vista: section[0] === "partes" ? "partes" : section[0] === "incidencias" ? "incidencias" : "costes", subvista: section[0] === "ordenes" ? "ordenes" : section[0] === "partes" ? "diarios" : "todas", detalle: section[1] }
    : null;
  const query = direct ?? detail;
  if (!query) notFound();
  return WorkDetailPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({ ...query, modo: existing.modo }) });
}
