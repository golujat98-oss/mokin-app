import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

let _serverSetAllCallCount = 0

export async function createClient() {
  console.log("SERVER CLIENT HIT")
  const cookieStore = await cookies()

  // ─── DEBUG: Log initial cookie state ─────────────────────────────────────
  const allCookies = cookieStore.getAll()
  const authCookies = allCookies.filter((c: { name: string }) => c.name.includes('sb-'))
  console.log('[AUTH-DEBUG] [SERVER] ─────────────────────────────────────')
  console.log('[AUTH-DEBUG] [SERVER] createClient() called')
  console.log('[AUTH-DEBUG] [SERVER] Cookies in store:', allCookies.length)
  console.log('[AUTH-DEBUG] [SERVER] Auth cookies    :', authCookies.length)
  authCookies.forEach((c: { name: string; value: string }) => {
    console.log('[AUTH-DEBUG] [SERVER]   └─', c.name, 'len=', c.value.length, 'bytes')
  })
  // ─── END DEBUG ───────────────────────────────────────────────────────────

  _serverSetAllCallCount = 0

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const got = cookieStore.getAll()
          const gotAuth = got.filter((c: { name: string }) => c.name.includes('sb-'))
          console.log('[AUTH-DEBUG] [SERVER] getAll() called:', got.length, 'cookies,', gotAuth.length, 'auth')
          return got
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          _serverSetAllCallCount++
          console.log('[AUTH-DEBUG] [SERVER] ─── setAll() call #' + _serverSetAllCallCount + ' ─────')
          console.log('[AUTH-DEBUG] [SERVER] setAll() called:', _serverSetAllCallCount, 'time(s)')
          console.log('[AUTH-DEBUG] [SERVER] Cookies to set:', cookiesToSet.length)

          cookiesToSet.forEach(({ name, value, options }) => {
            const op = value ? 'SET' : 'REMOVE'
            console.log(
              '[AUTH-DEBUG] [SERVER]   ' + op,
              'name=' + name,
              'valLen=' + value.length + 'bytes',
              'path=' + (options?.path ?? '(default)'),
              'maxAge=' + (options?.maxAge ?? '(default)'),
            )
          })

          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              console.log('[AUTH-DEBUG] [SERVER] cookieStore.set(', name, ')')
              cookieStore.set(name, value, options)
            })
            console.log('[AUTH-DEBUG] [SERVER] cookieStore.set() SUCCEEDED')
          } catch (err: any) {
            console.log('[AUTH-DEBUG] [SERVER] cookieStore.set() FAILED:', err?.message ?? err)
          }
        },
      },
    }
  )
}