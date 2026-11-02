import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Rafraîchit la session Supabase et redirige selon l'état de connexion.
// L'autorisation réelle reste assurée par la RLS et par chaque Server Action.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const onLogin = request.nextUrl.pathname === "/login"

  if (!user && !onLogin) return redirectWithCookies(request, response, "/login")
  if (user && onLogin) return redirectWithCookies(request, response, "/")
  return response
}

function redirectWithCookies(request: NextRequest, from: NextResponse, path: string) {
  const redirect = NextResponse.redirect(new URL(path, request.url))
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  return redirect
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
}
