"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Receipt,
    Lightbulb,
    BadgeDollarSign,
    Inbox,
} from "lucide-react";

const navItems = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/transactions", label: "Trans", icon: Receipt },
    { href: "/receipts", label: "Inbox", icon: Inbox },
    { href: "/insights", label: "Insights", icon: Lightbulb },
    { href: "/deductions", label: "Deduct", icon: BadgeDollarSign },
];

export function MobileNav() {
    const pathname = usePathname();

    return (
        <nav
            data-testid="mobile-nav"
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        >
            <div className="flex h-16 items-center justify-around">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "relative flex min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                isActive
                                    ? "text-primary"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Icon
                                className={cn(
                                    "h-6 w-6 transition-all",
                                    isActive && "fill-primary stroke-primary"
                                )}
                                strokeWidth={isActive ? 2.5 : 2}
                            />
                            <span
                                className={cn(
                                    "text-[10px] font-medium",
                                    isActive && "font-semibold"
                                )}
                            >
                                {item.label}
                            </span>
                            {/* Active indicator dot */}
                            {isActive && (
                                <span className="absolute -top-0.5 h-1 w-6 rounded-full bg-primary" />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
