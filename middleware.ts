import NextAuth from 'next-auth'
import authConfig from '@/app/lib/auth.config'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session?.user

  const isAuthRoute = nextUrl.pathname.startsWith('/api/auth')
  const isMcpRoute = nextUrl.pathname.startsWith('/api/mcp')
  const isPublicRoute = nextUrl.pathname === '/'
  const isSignInPage = nextUrl.pathname === '/sign-in'
  const isSignUpPage = nextUrl.pathname === '/sign-up'

  // Always allow NextAuth internals and MCP (called by Claude Desktop without auth)
  if (isAuthRoute || isMcpRoute) return

  // Redirect authenticated users away from auth pages (not from landing)
  if (isLoggedIn && (isSignInPage || isSignUpPage)) {
    return Response.redirect(new URL('/', nextUrl))
  }

  // Allow unauthenticated on public routes and auth pages
  if (!isLoggedIn && (isPublicRoute || isSignInPage || isSignUpPage)) return

  // Redirect unauthenticated users on all other routes to sign-in
  if (!isLoggedIn) {
    return Response.redirect(new URL('/sign-in', nextUrl))
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
