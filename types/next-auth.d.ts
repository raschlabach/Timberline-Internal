import { DefaultSession, DefaultUser } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  /**
   * Extends the built-in User type for Next-Auth
   */
  interface User extends DefaultUser {
    username: string
    role: 'admin' | 'user' | 'driver' | 'rip_operator' | 'shipping_station'
  }

  /**
   * Extends the built-in Session type for Next-Auth
   */
  interface Session {
    user: {
      id: string
      username: string
      role: 'admin' | 'user' | 'driver' | 'rip_operator' | 'shipping_station'
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
    role: 'admin' | 'user' | 'driver' | 'rip_operator' | 'shipping_station'
  }
} 