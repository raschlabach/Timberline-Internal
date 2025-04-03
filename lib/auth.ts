import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        try {
          // Find user by username
          const result = await query(
            'SELECT id, username, password_hash, full_name, role FROM users WHERE username = $1 AND is_active = true',
            [credentials.username]
          );

          const user = result.rows[0];

          if (!user) {
            return null;
          }

          // Verify password
          const isValid = await bcrypt.compare(credentials.password, user.password_hash);

          if (!isValid) {
            return null;
          }

          // Return user data (excluding password)
          return {
            id: user.id,
            username: user.username,
            name: user.full_name,
            role: user.role
          };
        } catch (error) {
          console.error('Error in auth:', error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  }
};

// Basic auth helper for development
export async function getSession() {
  // TODO: Implement proper authentication
  return {
    user: {
      id: 1,
      name: 'Development User',
      email: 'dev@example.com'
    }
  };
} 