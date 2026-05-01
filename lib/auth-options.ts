import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { loginWithAuthServer } from "@/lib/auth-api";

/** Must match menu-server access token TTL (`signAccessToken` / JWT `exp`). */
const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }
        const data = await loginWithAuthServer(email, password);
        if (!data) return null;
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          accessToken: data.access_token,
          accessTokenExpiresAt: Date.now() + data.expires_in * 1000,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  pages: { signIn: "/login" },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        if (user.email) token.email = user.email;
        if (user.name) token.name = user.name;
        if ("accessToken" in user && typeof user.accessToken === "string") {
          token.accessToken = user.accessToken;
        }
        if (
          "accessTokenExpiresAt" in user &&
          typeof user.accessTokenExpiresAt === "number"
        ) {
          token.accessTokenExpiresAt = user.accessTokenExpiresAt;
        }
        delete token.authError;
      }
      if (
        trigger === "update" &&
        session &&
        "name" in session &&
        typeof session.name === "string" &&
        session.name.trim().length > 0
      ) {
        token.name = session.name.trim();
      }

      if (
        typeof token.accessTokenExpiresAt === "number" &&
        Date.now() >= token.accessTokenExpiresAt
      ) {
        delete token.accessToken;
        delete token.id;
        delete token.email;
        delete token.name;
        token.authError = "AccessTokenExpired";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.id) session.user.id = token.id as string;
        if (token.email) session.user.email = token.email as string;
        if (token.name) session.user.name = token.name as string;
      }
      if (token.accessToken) {
        session.accessToken = token.accessToken as string;
      }
      if (typeof token.accessTokenExpiresAt === "number") {
        session.accessTokenExpiresAt = token.accessTokenExpiresAt;
      }
      if (token.authError === "AccessTokenExpired") {
        session.authError = token.authError;
      }
      return session;
    },
  },
};
