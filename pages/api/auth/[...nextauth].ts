// pages/api/auth/[...nextauth].ts

import NextAuth, { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import type { JWT } from 'next-auth/jwt'
import type { Session } from 'next-auth'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { withRateLimit } from '../../../lib/withRateLimit'

const prisma = new PrismaClient()

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user) return null

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) return null

                return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
        }
      },
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    
    async jwt({ token, user }: { token: JWT; user?: { id?: string; role?: string } }) {
      if (user?.role) token.role = user.role
      if (user?.id) token.id = user.id
      return token
    },

    
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.role) {
        session.user.role = token.role as string
      }

      if (session.user && token.id) {
        session.user.id = token.id as string
      }

      return session
    },
  },

  pages: { signIn: '/login' },
}

export default withRateLimit(NextAuth(authOptions), 10)