import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { Navigation } from "@/components/navigation";
import { MobileNav } from "@/components/mobile-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 md:pb-8 lg:px-8">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}

