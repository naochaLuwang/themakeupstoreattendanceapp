import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/supabase/database.types'
import { isPublicInformationPath } from '@/lib/public-information-routes'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicInformationPath(pathname)) return NextResponse.next();

  // This page exposes only the display UI. Its API requires a separately paired
  // station credential, so the store display never needs an admin login cookie.
  if (pathname === '/attendance-station') return NextResponse.next();

  // Public static images and retirement URLs do not require a staff session.
  if (pathname.endsWith('.png') || pathname.endsWith('.ico') || pathname === '/MUS-SW.js' || pathname === '/sw.js') return NextResponse.next();

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect logic
  if (!user && !pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. Next.js internals and static files
     * 2. Legacy worker retirement URLs
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sw\\.js$|MUS-SW\\.js$|icons).*)',
  ],
}
