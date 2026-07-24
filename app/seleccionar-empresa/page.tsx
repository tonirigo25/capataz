import { redirect } from "next/navigation";
import { getAvailableCompanies, requireAuthenticatedUser } from "@/lib/auth/session";
import { switchActiveCompany } from "./actions";

export default async function SelectCompanyPage() {
  const session = await requireAuthenticatedUser();
  const memberships = await getAvailableCompanies(session.userId);
  if (!memberships.length) redirect("/crear-empresa");
  return <main className="screen mx-auto max-w-2xl py-10"><p className="type-label">Empresa activa</p><h1 className="type-page-title mt-2">¿En qué empresa vas a trabajar?</h1><p className="type-secondary mt-2">El cambio se valida en servidor y descarta el contexto pendiente de la empresa anterior.</p><div className="mt-6 grid gap-3">{memberships.map(({ company, role }) => <form action={switchActiveCompany} key={company.id}><input type="hidden" name="companyId" value={company.id}/><button className="card flex min-h-20 w-full items-center gap-4 p-4 text-left hover:border-brand"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft font-bold">{company.nombreComercial.slice(0,1)}</span><span className="min-w-0 flex-1"><strong className="block truncate">{company.nombreComercial}</strong><span className="type-secondary">{company.sectorKey ?? "Perfil pendiente"} · {role}</span></span><span className="text-sm font-semibold text-brand-strong">Entrar</span></button></form>)}</div><a href="/crear-empresa" className="secondary-button mt-5 inline-flex">Crear otra empresa</a></main>;
}
