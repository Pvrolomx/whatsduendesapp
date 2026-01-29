import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_COOKIE = 'whatsduendes_auth'

// In-memory rate limiter (edge-compatible)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function rateLimit(ip: string, limit: number, intervalMs: number): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  
  if (!record || record.resetTime < now) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + intervalMs })
    return true
  }
  
  if (record.count >= limit) {
    return false
  }
  
  record.count++
  return true
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             'unknown'
  
  // Rate limiting para APIs
  if (pathname.startsWith('/api')) {
    // Auth endpoint: muy estricto (5/min)
    if (pathname === '/api/auth') {
      if (!rateLimit(`auth:${ip}`, 5, 60000)) {
        return NextResponse.json(
          { error: 'Too many login attempts. Try again in 1 minute.' },
          { status: 429 }
        )
      }
    }
    // Write endpoints: moderado (30/min)
    else if (request.method === 'POST' || request.method === 'DELETE') {
      if (!rateLimit(`write:${ip}`, 30, 60000)) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Max 30 writes/minute.' },
          { status: 429 }
        )
      }
    }
    // Read endpoints: permisivo (100/min)
    else if (request.method === 'GET') {
      if (!rateLimit(`read:${ip}`, 100, 60000)) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Max 100 reads/minute.' },
          { status: 429 }
        )
      }
    }
    
    return NextResponse.next()
  }
  
  // Permitir login page
  if (pathname === '/login') {
    return NextResponse.next()
  }
  
  // Permitir assets estáticos
  if (pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next()
  }
  
  // Verificar cookie de autenticación para páginas
  const authCookie = request.cookies.get(AUTH_COOKIE)
  
  if (!authCookie?.value) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
