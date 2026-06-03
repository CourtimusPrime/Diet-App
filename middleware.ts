import NextAuth from 'next-auth'
import authConfig from '@/app/lib/auth.config'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session?.user

  const isAuthRoute = nextUrl.pathname.startsWith('/api/auth')
  const isMcpRoute = nextUrl.pathname.startsWith('/api/mcp')
  const isSignInPage = nextUrl.pathname === '/sign-in'
  const isSignUpPage = nextUrl.pathname === '/sign-up'

  // Always allow NextAuth internals and MCP (called by Claude Desktop without auth)
  if (isAuthRoute || isMcpRoute) return

  // Redirect authenticated users away from auth pages
  if (isLoggedIn && (isSignInPage || isSignUpPage)) {
    return Response.redirect(new URL('/', nextUrl))
  }

  // Redirect unauthenticated users to sign-in
  if (!isLoggedIn && !isSignInPage && !isSignUpPage) {
    return Response.redirect(new URL('/sign-in', nextUrl))
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
