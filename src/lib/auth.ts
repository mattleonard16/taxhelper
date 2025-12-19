import { PrismaAdapter } from "@auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Development-only credentials provider for easy testing
    // Login with any email and password "dev"
    ...(process.env.NODE_ENV === "development"
      ? [
        CredentialsProvider({
          name: "Development",
          credentials: {
            email: { label: "Email", type: "email", placeholder: "test@example.com" },
            password: { label: "Password", type: "password", placeholder: "dev" },
          },
          async authorize(credentials) {
            if (credentials?.password !== "dev") {
              return null;
            }
            // Find or create user for development
            const email = credentials.email || "dev@taxhelper.local";
            let user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
              user = await prisma.user.create({
                data: { email, name: email.split("@")[0] },
              });
            }
            return { id: user.id, email: user.email, name: user.name };
          },
        }),
      ]
      : []),
    EmailProvider({
      server: process.env.EMAIL_SERVER || {
        host: "localhost",
        port: 1025,
        auth: {
          user: "",
          pass: "",
        },
      },
      from: process.env.EMAIL_FROM || "noreply@taxhelper.app",
    }),
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

