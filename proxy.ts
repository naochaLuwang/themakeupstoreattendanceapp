import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 1. Rename this function to 'proxy'
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- PWA ESCAPE HATCH ---
  // If it's a PWA system file, let it through immediately without checking Auth
  if (
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/workbox-') ||
    pathname.startsWith('/fallback-')
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
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
// 2. Keep your config as is
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. Next.js internals and static files
     * 2. PWA generated files (sw, manifest, fallback)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|sw.js|workbox-.*|fallback-.*|icons).*)',
  ],
}