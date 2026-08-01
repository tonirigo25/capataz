import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { confirmMfaEnrollment, startMfaEnrollment, verifyMfaChallenge } from "./actions";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { readPendingTotpEnrollment, isSecondFactorFresh } from "@/lib/security/mfa";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";

export default async function SecuritySettingsPage() {
  const session = await requireAuthenticatedUser();
  const [account, factors, pending] = await Promise.all([
    prisma.platformAccount.findUnique({ where: { userId: session.userId }, select: { role: true } }),
    prisma.mfaFactor.findMany({ where: { userId: session.userId, status: { in: ["ACTIVE", "PENDING"] } }, orderBy: { createdAt: "desc" } }),
    readPendingTotpEnrollment({ prisma, userId: session.userId, email: session.email }),
  ]);
  const active = factors.find((factor) => factor.status === "ACTIVE");
  const qr = pending ? await QRCode.toDataURL(pending.uri, { errorCorrectionLevel: "M", margin: 1, width: 240 }) : null;
  const platformRequired = account && ["PLATFORM_OWNER", "PLATFORM_ADMIN"].includes(account.role);
  const verified = isSecondFactorFresh(session.secondFactorVerifiedAt);

  return <main className="screen max-w-3xl">
    <InternalBreadcrumbs items={[{ label: "Configuración", href: "/configuracion" }, { label: "Seguridad de acceso" }]} />
    <h1 className="type-page-title mt-2">Seguridad de acceso</h1>
    <p className="type-secondary mt-2">Añade un segundo factor para proteger acciones sensibles. En cuentas internas de plataforma es obligatorio.</p>

    <section className="card mt-6 p-5">
      <h2 className="type-section-title">Aplicación de autenticación</h2>
      <p className="type-secondary mt-2">Estado: {active ? "configurada" : "pendiente de configurar"}{platformRequired ? ` · obligatoria para ${account.role}` : " · opcional para tu cuenta"}.</p>
      {!pending && !active ? <form action={startMfaEnrollment} className="mt-4"><input type="hidden" name="label" value="Autenticador principal" /><button className="primary-button">Preparar autenticador</button></form> : null}
      {pending && qr ? <div className="mt-5 grid gap-5 sm:grid-cols-[240px_1fr] sm:items-center">
        <Image src={qr} alt="Código QR para configurar la aplicación de autenticación" width={240} height={240} unoptimized />
        <form action={confirmMfaEnrollment} className="grid gap-3">
          <input type="hidden" name="factorId" value={pending.factorId} />
          <label className="grid gap-1 text-sm font-semibold">Código de seis cifras<input className="field" name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /></label>
          <button className="primary-button">Confirmar segundo factor</button>
        </form>
      </div> : null}
    </section>

    {active ? <section className="card mt-4 p-5">
      <h2 className="type-section-title">Comprobación para esta sesión</h2>
      <p className="type-secondary mt-2">{verified ? "Segundo factor verificado durante las últimas 12 horas." : "Introduce un código antes de acceder a operaciones internas sensibles."}</p>
      {!verified ? <form action={verifyMfaChallenge} className="mt-4 flex max-w-sm gap-2"><input className="field" aria-label="Código de seis cifras" name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /><button className="primary-button">Verificar</button></form> : null}
      {verified && platformRequired ? <Link className="secondary-button mt-4 inline-flex" href="/plataforma">Ir a plataforma interna</Link> : null}
    </section> : null}
  </main>;
}
