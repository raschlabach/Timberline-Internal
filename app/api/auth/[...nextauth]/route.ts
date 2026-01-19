import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { query } from "@/lib/db"

/**
 * NextAuth configuration and API route handler
 */
const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          console.log("Missing credentials")
          throw new Error("Missing username or password")
        }
        
        try {
          console.log(`Authorizing user: ${credentials.username}`)
          
          // Query the database for the user
          const result = await query(
            'SELECT id, username, password_hash, full_name, email, role FROM users WHERE username = $1 AND is_active = TRUE',
            [credentials.username]
          )
          
          if (!result || !result.rows || result.rows.length === 0) {
            console.log(`User not found: ${credentials.username}`)
            throw new Error("User not found")
          }
          
          const user = result.rows[0]
          console.log(`User found: ${user.username}, role: ${user.role}`)
          
          // Verify the password
          const isValid = await compare(credentials.password, user.password_hash)
          
          if (!isValid) {
            console.log("Invalid password")
            throw new Error("Invalid password")
          }
          
          console.log("Authentication successful")
          
          // Return the user without the password hash
          return {
            id: user.id.toString(),
            name: user.full_name,
            email: user.email,
            username: user.username,
            role: user.role
          }
        } catch (error) {
          console.error("Auth error:", error)
          throw error
        }
      }
    })
  ],
  debug: process.env.NODE_ENV !== "production",
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        console.log("JWT callback - user found:", user.username)
        token.id = user.id
        token.username = user.username
        token.role = ((user as any).role as string) as 'admin' | 'user' | 'driver' | 'rip_operator'
      }
      return token
    },
    async session({ session, token }) {
      const allowed = ['admin', 'user', 'driver', 'rip_operator'] as const
      type Role = typeof allowed[number]

      const incoming = String((token as any).role ?? '')
      const role: Role = (allowed as readonly string[]).includes(incoming) ? (incoming as Role) : 'user'

      ;(session.user as any).id = token.id as string
      ;(session.user as any).username = token.username as string
      ;(session.user as any).role = role

      return session
    },
    async redirect({ url, baseUrl }) {
      // Only allow internal URLs or absolute URLs that start with the base URL
      const isInternalUrl = url.startsWith(baseUrl) || url.startsWith("/")
      if (isInternalUrl) {
        console.log("Redirecting to internal URL:", url)
        return url
      }
      console.log("Invalid redirect URL, using default:", baseUrl)
      return baseUrl
    }
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET || "your-next-auth-secret"
})

export { handler as GET, handler as POST } 