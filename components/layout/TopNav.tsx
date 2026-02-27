"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/bag", label: "Bag" },
  { href: "/swing", label: "Swing" },
  { href: "/rangefinder", label: "Range" },
  { href: "/strategy", label: "Strategy" },
  { href: "/coach", label: "Coach" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function TopNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  if (pathname === "/login") return null;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a] border-b border-[#c9a84c]/30">
        <div className="flex items-center justify-between h-16 px-5">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 ml-4">
            <img
              src="/images/logo8.svg"
              alt="inthehole"
              className="h-12 w-12"
            />
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-bold uppercase tracking-wider transition-colors ${
                  isActive(pathname, link.href)
                    ? "text-[#c9a84c]"
                    : "text-white hover:text-[#c9a84c]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Hamburger - mobile only */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col justify-center items-center w-10 h-10 gap-1.5"
          >
            <span
              className={`block w-6 h-0.5 bg-[#c9a84c] transition-transform ${
                menuOpen ? "rotate-45 translate-y-2" : ""
              }`}
            />
            <span
              className={`block w-6 h-0.5 bg-[#c9a84c] transition-opacity ${
                menuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block w-6 h-0.5 bg-[#c9a84c] transition-transform ${
                menuOpen ? "-rotate-45 -translate-y-2" : ""
              }`}
            />
          </button>
        </div>
      </nav>

      {/* Mobile overlay menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="fixed inset-0 z-40 bg-[#0a0a0a] flex flex-col items-center justify-center gap-8 md:hidden"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-3xl font-black uppercase tracking-wider transition-colors ${
                isActive(pathname, link.href)
                  ? "text-[#c9a84c]"
                  : "text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
