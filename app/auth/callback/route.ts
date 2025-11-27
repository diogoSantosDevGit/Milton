import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type') // 'signup' or 'recovery'

  if (code) {
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Email confirmed successfully! Redirect to login with success message
      if (type === 'signup' || type === 'signup_confirmation') {
        return NextResponse.redirect(new URL('/auth/login?confirmed=true', requestUrl.origin))
      }
      // For other types (like password recovery), redirect to login
      return NextResponse.redirect(new URL('/auth/login?confirmed=true', requestUrl.origin))
    }
  }

  // If there's an error or no code, redirect to login with error
  return NextResponse.redirect(new URL('/auth/login?error=confirmation_failed', requestUrl.origin))
}
