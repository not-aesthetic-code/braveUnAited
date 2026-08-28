// Next.js 16 renamed middleware.ts to proxy.ts — same runtime, same job:
// refresh the session cookie and gate the logged-in areas behind it. Two
// separate account spaces share this Supabase auth (doctors under /panel,
// optional patient accounts under /konto) — same guard shape, different base.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const GUARDED_BASES = ["/konto"];

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = !!data?.claims;

  const { pathname } = request.nextUrl;
  const base = GUARDED_BASES.find((b) => pathname.startsWith(b));
  if (base) {
    const loginPage = `${base}/login`;
    const isLoginPage = pathname === loginPage;

    if (!isLoggedIn && !isLoginPage) {
      return NextResponse.redirect(new URL(loginPage, request.url));
    }
    if (isLoggedIn && isLoginPage) {
      return NextResponse.redirect(new URL(base, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/konto/:path*"],
};
