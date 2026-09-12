import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touching getUser() refreshes an expired access token and persists the
  // rotated cookies via the response above. Server Components can't do this
  // themselves (Next.js disallows setting cookies there — see
  // lib/supabase/server.ts), so every route that reads the session in a
  // Server Component needs to be covered by the matcher below, or its
  // session silently breaks the first time the access token expires (the
  // rotated refresh token gets used but never written back to the browser,
  // so the next visit signs the user out).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // /dashboard/* additionally redirects to /login when logged out (admin
  // auth); /panel just needs its session kept fresh — it shows its own
  // inline Discord sign-in when logged out, never redirects.
  matcher: ["/dashboard/:path*", "/panel"],
};
