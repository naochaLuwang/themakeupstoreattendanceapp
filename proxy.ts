import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/supabase/database.types'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // This page exposes only the display UI. Its API requires a separately paired
  // station credential, so the store display never needs an admin login cookie.
  if (pathname === '/attendance-station') return NextResponse.next();

  // --- PWA ESCAPE HATCH ---
  // If it's a PWA system file, let it through immediately without checking Auth
  if (
    pathname.endsWith('.png') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.webmanifest') ||
    pathname.startsWith('/sw.js') ||
    pathname.startsWith('/MUS-SW.js') ||
    pathname.startsWith('/workbox-')
  ) {
    const response = NextResponse.next();
    // CRITICAL: Ensure Service Worker is NEVER cached by the browser
    if (pathname.includes('SW.js') || pathname.includes('sw.js')) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Service-Worker-Allowed', '/');
    }
    return response;
  }

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
     * 2. PWA generated files (sw, manifest, fallback)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|sw.js|MUS-SW.js|workbox-.*|fallback-.*|icons).*)',
  ],
}
