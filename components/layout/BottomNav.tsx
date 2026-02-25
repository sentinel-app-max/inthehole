"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", icon: "🏌️" },
  { href: "/bag", label: "My Bag", icon: "\uD83C\uDFAF" },
  { href: "/swing", label: "Swing", icon: "swing" },
  { href: "/leaderboard", label: "Board", icon: "🏆" },
  { href: "/history", label: "History", icon: "📋" },
  { href: "/coach", label: "Coach", icon: "coach" },
] as const;

function CoachIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#c9a84c" : "#888888"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SwingIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#c9a84c" : "#888888"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0a0a0a] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 text-xs font-semibold transition-colors ${
                active ? "text-[#c9a84c]" : "text-[#888888]"
              }`}
            >
              {tab.icon === "swing" ? (
                <SwingIcon active={active} />
              ) : tab.icon === "coach" ? (
                <CoachIcon active={active} />
              ) : (
                <span className="text-2xl">{tab.icon}</span>
              )}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
