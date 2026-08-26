import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { findUserByEmail } from "@/lib/store-repository";
import { LOGIN_RATE_LIMIT, rateLimit } from "@/lib/rate-limit";
import { logError, logInfo } from "@/lib/logger";
import { loginSchema } from "@/lib/schemas";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/auth" },
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        // Auth.js includes its own callback/CSRF fields with a credentials
        // submission. Validate only the two provider fields, without coercing
        // arbitrary values into strings.
        const parsed = loginSchema.safeParse({
          email: credentials?.email,
          password: credentials?.password,
        });
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const limit = await rateLimit(request as Request, LOGIN_RATE_LIMIT, email);
        if (!limit.success) {
          // Keep the response identical to invalid credentials to prevent account enumeration.
          logInfo("auth.login_rate_limited", { retryAfter: limit.retryAfter });
          return null;
        }
        try {
          const user = await findUserByEmail(email);
          if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
          return { id: user.id, name: user.name, email: user.email };
        } catch (error) {
          logError("auth.login_failed", error);
          return null;
        }
      },
    }),
  ],
});
