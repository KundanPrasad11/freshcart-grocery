import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { findUserByEmail } from "@/lib/store-repository";
import { rateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";

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
        const limited = rateLimit(request as Request, "auth.login", 10, 15 * 60_000);
        if (limited) return null;
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        try {
          const user = await findUserByEmail(email);
          if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
          return { id: user.id, name: user.name, email: user.email };
        } catch (error) {
          logError("auth.login_failed", error, { email });
          return null;
        }
      },
    }),
  ],
});
