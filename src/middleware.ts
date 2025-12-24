import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth/signin",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/transactions/:path*",
    "/insights/:path*",
    "/deductions/:path*",
    "/templates/:path*",
    "/recurring/:path*",
    "/settings/:path*",
    "/api/transactions/:path*",
    "/api/insights/:path*",
    "/api/receipts/:path*",
    "/api/summary/:path*",
    "/api/onboarding/:path*",
    "/api/settings/:path*",
  ],
};

