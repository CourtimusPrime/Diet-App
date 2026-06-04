import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Credentials from 'next-auth/providers/credentials'
import bcryptjs from 'bcryptjs'
import { prisma } from '@/app/lib/prisma'
import authConfig from './auth.config'

// In production (DEV=false), set AUTH_URL from RAILWAY_PUBLIC_DOMAIN if not already set.
// NextAuth v5 reads AUTH_URL at module init time to build OAuth callback URLs.
// DEV=true  → skip (NextAuth auto-detects localhost)
// DEV=false → require AUTH_URL or derive from Railway's injected RAILWAY_PUBLIC_DOMAIN
if (process.env.DEV === 'false' && !process.env.AUTH_URL) {
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN
  if (railwayDomain) {
    process.env.AUTH_URL = `https://${railwayDomain}`
  } else {
    console.warn('[auth] DEV=false but AUTH_URL and RAILWAY_PUBLIC_DOMAIN are both unset. Auth callbacks may use wrong base URL.')
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  trustHost: true,
  providers: [
    ...authConfig.providers.filter((p) => p.id !== 'credentials'),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.password) return null

        const valid = await bcryptjs.compare(credentials.password as string, user.password)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name ?? null }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      return session
    },
  },
})
