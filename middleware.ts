import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  callbacks: {
    authorized: ({ token }) => {
      if (!token?.accessToken) return false;
      if (
        typeof token.accessTokenExpiresAt === "number" &&
        Date.now() >= token.accessTokenExpiresAt
      ) {
        return false;
      }
      return true;
    },
  },
});

export const config = {
  matcher: [
    "/",
    "/((?!api/|_next/|_static|_vercel/|favicon|login$|forgot-pass$|.*\\..*).*)",
  ],
};
