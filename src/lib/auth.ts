import { compare } from "bcryptjs";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readAdminConfig() {
  return {
    email: normalizeEmail(process.env.ADMIN_EMAIL),
    passwordHash: process.env.ADMIN_PASSWORD_HASH?.trim() ?? ""
  };
}

export function isAdminAuthConfigured() {
  const { email, passwordHash } = readAdminConfig();
  return Boolean(email && passwordHash && process.env.NEXTAUTH_SECRET);
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        email: {
          label: "Email",
          type: "email"
        },
        password: {
          label: "Password",
          type: "password"
        }
      },
      async authorize(credentials) {
        const { email: adminEmail, passwordHash } = readAdminConfig();
        const email = normalizeEmail(credentials?.email);
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        if (!adminEmail || !passwordHash || !email || !password) {
          return null;
        }

        if (email !== adminEmail) {
          return null;
        }

        const passwordMatches = await compare(password, passwordHash);

        if (!passwordMatches) {
          return null;
        }

        return {
          id: "admin",
          name: "NeuralCast Admin",
          email: adminEmail,
          isAdmin: true
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.isAdmin = user.isAdmin === true;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.isAdmin = token.isAdmin === true;
      }

      return session;
    }
  }
};

export function getAuthSession() {
  if (!isAdminAuthConfigured()) {
    return Promise.resolve(null);
  }

  return getServerSession(authOptions);
}
