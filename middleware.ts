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

function isValidApiKey(request: NextRequest): boolean {
  const apiKey = process.env.API_KEY
  if (!apiKey) return false

  // Check Bearer token
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === apiKey
  }

  // Check X-API-Key header
  const xApiKey = request.headers.get('x-api-key')
  if (xApiKey) {
    return xApiKey === apiKey
  }

  // Check query param (for simple curl usage)
  const { searchParams } = new URL(request.url)
  const keyParam = searchParams.get('key')
  if (keyParam) {
    return keyParam === apiKey
  }

  return false
}

function isValidAuthCookie(request: NextRequest): boolean {
  const authCookie = request.cookies.get(AUTH_COOKIE)
  return !!authCookie?.value
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             'unknown'
  
  // API routes
  if (pathname.startsWith('/api')) {
    // Auth endpoint: always open (it IS the login)
    if (pathname === '/api/auth') {
      if (!rateLimit(`auth:${ip}`, 5, 60000)) {
        return NextResponse.json(
          { error: 'Too many login attempts. Try again in 1 minute.' },
          { status: 429 }
        )
      }
      return NextResponse.next()
    }

    // All other API routes: require API key OR valid auth cookie
    const hasApiKey = isValidApiKey(request)
    const hasCookie = isValidAuthCookie(request)

    if (!hasApiKey && !hasCookie) {
      return NextResponse.json(
        { error: 'Unauthorized. Provide Bearer token, X-API-Key header, or ?key= param.' },
        { status: 401 }
      )
    }

    // Rate limiting
    if (request.method === 'POST' || request.method === 'DELETE') {
      if (!rateLimit(`write:${ip}`, 30, 60000)) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Max 30 writes/minute.' },
          { status: 429 }
        )
      }
    } else if (request.method === 'GET') {
      if (!rateLimit(`read:${ip}`, 100, 60000)) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Max 100 reads/minute.' },
          { status: 429 }
        )
      }
    }
    
    return NextResponse.next()
  }
  
  // Allow login page and static onboarding file
  if (pathname === '/login' || pathname === '/onboarding.txt') {
    return NextResponse.next()
  }
  
  // Allow static assets
  if (pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next()
  }
  
  // Check auth cookie for pages
  const authCookie = request.cookies.get(AUTH_COOKIE)
  
  if (!authCookie?.value) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
