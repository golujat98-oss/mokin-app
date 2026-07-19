import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

let _setAllCallCount = 0

export async function updateSession(request: NextRequest) {
  console.log("MIDDLEWARE HIT")
  // ─── DEBUG: Log request info ────────────────────────────────────────────
  const allCookies = request.cookies.getAll()
  const authCookies = allCookies.filter((c) => c.name.includes('sb-'))
  const cookieHeaderBytes =
    request.headers.get('cookie')?.length ?? 0

  console.log('[AUTH-DEBUG] ────────────────────────────────────────────')
  console.log('[AUTH-DEBUG] 1. Request URL        :', request.nextUrl.pathname + request.nextUrl.search)
  console.log('[AUTH-DEBUG] 2. Number of req cookies:', allCookies.length)
  console.log('[AUTH-DEBUG] 3. Cookie header size  :', cookieHeaderBytes, 'bytes')
  console.log('[AUTH-DEBUG] 4. Auth cookie names   :', authCookies.map((c) => c.name).join(', ') || '(none)')
  authCookies.forEach((c) => {
    console.log('[AUTH-DEBUG]    └─', c.name, ' len=', c.value.length, 'bytes')
  })
  // ─── END DEBUG ───────────────────────────────────────────────────────────

  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  _setAllCallCount = 0

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const got = request.cookies.getAll()
          const gotAuth = got.filter((c) => c.name.includes('sb-'))
          console.log('[AUTH-DEBUG] 5. getAll() called   :', got.length, 'cookies,',
            gotAuth.length, 'auth cookies')
          return got
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          _setAllCallCount++
          console.log('[AUTH-DEBUG] ─── setAll() call #' + _setAllCallCount + ' ─────────────────')
          console.log('[AUTH-DEBUG] 6a. setAll() called   :', _setAllCallCount, 'time(s)')
          console.log('[AUTH-DEBUG] 6b. Cookies to set    :', cookiesToSet.length)

          // Log each cookie operation
          cookiesToSet.forEach(({ name, value, options }) => {
            const op = value ? 'SET' : 'REMOVE'
            console.log(
              '[AUTH-DEBUG] 6c.   ' + op,
              'name=' + name,
              'valLen=' + value.length + 'bytes',
              'path=' + (options?.path ?? '(default)'),
              'maxAge=' + (options?.maxAge ?? '(default)'),
            )

            // ── STEP 1: request.cookies.set (line 21) ──
            console.log('[AUTH-DEBUG] 7. request.cookies.set(', name, ') options:', JSON.stringify(options))
            request.cookies.set(name, value)
          })

          // ── STEP 2: Re-create response (line 23) ──
          console.log('[AUTH-DEBUG] 8. Creating NEW NextResponse.next(), discarding previous')
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })

          // ── STEP 3: Set cookies on new response (line 28-30) ──
          cookiesToSet.forEach(({ name, value, options }) => {
            console.log(
              '[AUTH-DEBUG] 9. response.cookies.set(' + name + ')',
              'path=' + (options?.path ?? '(default)'),
              'maxAge=' + (options?.maxAge ?? '(default)'),
            )
            supabaseResponse.cookies.set({ name, value, ...options })
          })
        },
      },
    }
  )

  const url = request.nextUrl.clone()
  const isAuthPage = url.pathname.startsWith('/login') || url.pathname.startsWith('/signup')
  const isCallbackRoute = url.pathname.startsWith('/auth')

  // Get current authenticated user
  console.log('[AUTH-DEBUG] 10. Calling supabase.auth.getUser()...')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  console.log('[AUTH-DEBUG] 11a. getUser() result:', user ? 'user=' + user.id.slice(0, 8) + '...' : 'null')
  console.log('[AUTH-DEBUG] 11b. setAll call count :', _setAllCallCount)

  // If not logged in and trying to access app pages, redirect to login
  if (!user && !isAuthPage && !isCallbackRoute && url.pathname !== '/') {
    url.pathname = '/login'
    console.log('[AUTH-DEBUG] 12. REDIRECT to /login (no user)')
    return NextResponse.redirect(url)
  }

  // If logged in and trying to access auth pages, redirect to dashboard
  if (user && isAuthPage) {
    url.pathname = '/dashboard'
    console.log('[AUTH-DEBUG] 12. REDIRECT to /dashboard (already logged in)')
    return NextResponse.redirect(url)
  }

  // ─── DEBUG: Count Set-Cookie headers on final response ───────────────────
  const setCookieHeaders = supabaseResponse.headers.getSetCookie?.() ?? []
  // Fallback: iterate headers if getSetCookie not available
  let setCookieCount = 0
  let totalSetCookieBytes = 0
  if (typeof supabaseResponse.headers.getSetCookie === 'function') {
    const sc = supabaseResponse.headers.getSetCookie()
    setCookieCount = sc.length
    sc.forEach((val: string) => {
      totalSetCookieBytes += val.length
      const nameMatch = val.match(/^([^=]+)=/)
      const name = nameMatch ? nameMatch[1] : '???'
      const valLen = val.indexOf(';') > 0 ? val.indexOf(';') - (nameMatch?.[1]?.length ?? 0 + 1) : val.length - (nameMatch?.[1]?.length ?? 0 + 1)
      console.log('[AUTH-DEBUG] 13. Set-Cookie:', name, '~', valLen, 'bytes, preview:', val.slice(0, 60) + '...')
    })
  }
  console.log('[AUTH-DEBUG] 14. Total Set-Cookie count:', setCookieCount)
  console.log('[AUTH-DEBUG] 15. Total Set-Cookie bytes:', totalSetCookieBytes, 'bytes')
  console.log('[AUTH-DEBUG] ────────────────────────────────────────────')

  return supabaseResponse
}