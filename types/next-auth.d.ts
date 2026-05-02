import "next-auth";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string };
    /** Bearer from menu-server; server uses MENU_SERVER binding or AUTH_API_BASE_URL */
    accessToken?: string;
    /** Absolute epoch milliseconds when accessToken expires */
    accessTokenExpiresAt?: number;
    /** Present when token/session is no longer valid */
    authError?: "AccessTokenExpired";
  }

  interface User {
    accessToken?: string;
    accessTokenExpiresAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    email?: string;
    accessToken?: string;
    accessTokenExpiresAt?: number;
    authError?: "AccessTokenExpired";
  }
}
