import { PrismaAdapter } from "@auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcrypt";
import { checkRateLimit, RateLimitConfig } from "@/lib/rate-limit";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Email/password credentials provider
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email.trim();
        const normalizedEmail = email.toLowerCase();

        // Skip rate limiting in test environments
        if (process.env.NODE_ENV !== "test" && process.env.SKIP_AUTH_RATE_LIMIT !== "true") {
          const rateLimit = await checkRateLimit(
            `auth:${normalizedEmail}`,
            RateLimitConfig.auth
          );
          if (!rateLimit.success) {
            return null;
          }
        }

        // Dev login - read env vars at runtime for proper E2E testing
        const devLoginEnabled = process.env.ENABLE_DEV_LOGIN === "true";
        const devLoginAllowed = devLoginEnabled && process.env.NODE_ENV !== "production";
        const devLoginEmail = devLoginAllowed
          ? process.env.DEV_LOGIN_EMAIL || process.env.NEXT_PUBLIC_DEV_LOGIN_EMAIL
          : undefined;
        const devLoginPassword = devLoginAllowed
          ? process.env.DEV_LOGIN_PASSWORD || process.env.NEXT_PUBLIC_DEV_LOGIN_PASSWORD
          : undefined;
        const devLoginConfigured = Boolean(devLoginEmail && devLoginPassword);
        const isDevEmail =
          devLoginConfigured &&
          normalizedEmail === devLoginEmail?.toLowerCase();
        const lookupEmail = isDevEmail && devLoginEmail ? devLoginEmail : email;

        // Find user by email
        let user = await prisma.user.findUnique({
          where: { email: lookupEmail },
        });

        if (
          isDevEmail &&
          devLoginEmail &&
          devLoginPassword &&
          credentials.password === devLoginPassword
        ) {
          const devPasswordHash = await bcrypt.hash(devLoginPassword, 10);
          const devUser = await prisma.user.upsert({
            where: { email: devLoginEmail },
            update: {
              name: "Dev User",
              password: devPasswordHash,
            },
            create: {
              email: devLoginEmail,
              name: "Dev User",
              password: devPasswordHash,
            },
          });

          return {
            id: devUser.id,
            email: devUser.email,
            name: devUser.name,
          };
        }

        if (!user || !user.password) {
          // User doesn't exist or has no password set
          return null;
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isValidPassword) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
    // Optional: Email magic links
    ...(process.env.EMAIL_SERVER
      ? [
        EmailProvider({
          server: process.env.EMAIL_SERVER,
          from: process.env.EMAIL_FROM || "noreply@taxhelper.app",
        }),
      ]
      : []),
    // Optional: Google OAuth
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
      ]
      : []),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
};
