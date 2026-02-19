"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", icon: "\u{1F3CC}\uFE0F" },
  { href: "/leaderboard", label: "Leaderboard", icon: "\u{1F3C6}" },
  { href: "/history", label: "History", icon: "\u{1F4CB}" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-green-900/20 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 text-xs font-semibold transition-colors ${
                active ? "text-green-700" : "text-gray-400"
              }`}
            >
              <span className="text-2xl">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
