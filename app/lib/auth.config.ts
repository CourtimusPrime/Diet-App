import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import type { NextAuthConfig } from 'next-auth'

// Edge-safe config — NO Prisma, NO bcryptjs imports.
// middleware.ts imports only from this file.
// Full authorize logic lives in auth.ts (Node.js only).

export default {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      // Authorize runs in Node.js context (auth.ts overrides this).
      // This stub returns null so Edge runtime never calls Prisma/bcrypt.
      authorize: () => null,
    }),
  ],
  pages: {
    signIn: '/sign-in',
  },
} satisfies NextAuthConfig
