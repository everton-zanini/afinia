import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Verificação otimista (apenas presença do cookie). A autorização real ocorre no servidor
// em requireUser()/requireHousehold() em cada página e operação.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/inicio/:path*",
    "/lancamentos/:path*",
    "/planejamento/:path*",
    "/relatorios/:path*",
    "/mais/:path*",
    "/admin/:path*",
    "/definir-senha",
    "/sem-casal",
  ],
};
