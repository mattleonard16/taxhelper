import { encode } from "next-auth/jwt";
import type { BrowserContext } from "@playwright/test";

type AuthUser = {
  id: string;
  email: string;
  name: string;
};

const defaultUser: AuthUser = {
  id: "e2e-user",
  email: "e2e@taxhelper.local",
  name: "E2E User",
};

const resolveBaseURL = (baseURL?: string) => {
  if (baseURL) return baseURL;
  return process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
};

export const addAuthSession = async (
  context: BrowserContext,
  baseURL?: string,
  overrides: Partial<AuthUser> = {}
) => {
  const resolvedBaseURL = resolveBaseURL(baseURL);
  const user = { ...defaultUser, ...overrides };
  const secret = process.env.NEXTAUTH_SECRET ?? "test-secret";
  const token = await encode({
    token: {
      sub: user.id,
      email: user.email,
      name: user.name,
    },
    secret,
    maxAge: 60 * 60,
  });

  const url = new URL(resolvedBaseURL);
  const isSecure = url.protocol === "https:";
  const domain = url.hostname;
  const cookieName = isSecure
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  await context.addCookies([
    {
      name: cookieName,
      value: token,
      domain,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: isSecure,
    },
  ]);
};
