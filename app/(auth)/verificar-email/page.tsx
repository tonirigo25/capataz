import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { verifyEmailToken } from "@/app/(auth)/actions";
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const { token = "" } = await searchParams; const verified = await verifyEmailToken(token); return <AuthShell title={verified ? "Correo verificado" : "Enlace no válido"} description={verified ? "Tu cuenta está activa. Ya puedes entrar en Orqena." : "El enlace ha caducado o ya se utilizó. Solicita un nuevo mensaje de verificación."}><Link href="/login" className="primary-button w-full">Ir al inicio de sesión</Link></AuthShell>; }
