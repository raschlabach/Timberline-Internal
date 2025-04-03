import { DefaultSession, DefaultUser } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  /**
   * Extends the built-in User type for Next-Auth
   */
  interface User extends DefaultUser {
    username: string
    role: string
  }

  /**
   * Extends the built-in Session type for Next-Auth
   */
  interface Session {
    user: {
      id: string
      username: string
      role: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  /**
   * Extends the built-in JWT type for Next-Auth
   */
  interface JWT {
    id: string
    username: string
    role: string
  }
} 