import { NextResponse, type NextRequest } from 'next/server'
import { mettreAJourSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  try {
    return await mettreAJourSession(request)
  } catch (e) {
    console.error('[proxy]', e instanceof Error ? e.message : e)
    return NextResponse.next()
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)'],
}
