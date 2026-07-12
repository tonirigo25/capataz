import { NextResponse, type NextRequest } from "next/server";

const temporarilyBlocked = [
  "/capataz", "/buscar", "/alertas", "/recomendaciones", "/inteligencia", "/automatizaciones", "/tareas", "/seguimientos", "/demo-guiada"
];

export function middleware(request: NextRequest) {
  if (temporarilyBlocked.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`))) {
    return NextResponse.rewrite(new URL("/modulo-no-disponible", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/).*)"] };
