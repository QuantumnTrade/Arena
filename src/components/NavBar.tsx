"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function NavBar() {
  const pathname = usePathname();

  const baseClass =
    "text-white/70 hover:text-slate-300 text-sm font-medium relative after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-slate-300 after:transition-all hover:after:w-full";
  const activeClass = "text-white after:w-full";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="sticky top-0 z-50 bg-black/40 backdrop-blur-xl border-b border-slate-700/30 shadow-[0_4px_30px_rgba(0,0,0,0.3)]">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-slate-400 to-slate-600 rounded-full opacity-20 blur-sm group-hover:opacity-40 transition duration-300"></div>
              <Image
                src="/images/Logo/QuantumnTrade_Logo.png"
                alt="QuantumnTrade Logo"
                className="h-9 w-auto relative rounded-full bg-black p-1"
                width={48}
                height={48}
                quality={80}
                priority
              />
            </div>
            <span className="text-xl md:text-2xl font-bold text-white">
              QuantumnTrade
            </span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className={`${baseClass} ${isActive("/") ? activeClass : ""}`}
              aria-current={isActive("/") ? "page" : undefined}
            >
              Dashboard
            </Link>
            <Link
              href="/markets"
              className={`${baseClass} ${
                isActive("/markets") ? activeClass : ""
              }`}
              aria-current={isActive("/markets") ? "page" : undefined}
            >
              Markets
            </Link>
            <Link
              href="/agents"
              className={`${baseClass} ${
                isActive("/agents") ? activeClass : ""
              }`}
              aria-current={isActive("/agents") ? "page" : undefined}
            >
              Agents
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
