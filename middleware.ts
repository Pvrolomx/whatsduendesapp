import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_COOKIE = 'whatsduendes_auth'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Permitir todas las APIs sin autenticación
  if (pathname.startsWith('/api')) {
    return NextResponse.next()
  }
  
  // Permitir login
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
