"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut, User, ShieldCheck } from "lucide-react";

const NAV_LINKS = [
  { href: "/home", label: "الرئيسية" },
  { href: "/courses", label: "الكورسات" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isClosingMenu, setIsClosingMenu] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("alphateam-theme");
    if (saved === "light") {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    } else {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }

    try {
      const savedUser = localStorage.getItem("alphateam-user");
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed.role === "ADMIN" || parsed.role === "TEAM") {
          setIsStaff(true);
        }
      }
    } catch {}
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    const nextDark = !isDark;

    // Trigger smooth global theme transition
    html.classList.add("theme-transition");
    setIsDark(nextDark);

    if (nextDark) {
      html.classList.add("dark");
      localStorage.setItem("alphateam-theme", "dark");
    } else {
      html.classList.remove("dark");
      localStorage.setItem("alphateam-theme", "light");
    }

    setTimeout(() => {
      html.classList.remove("theme-transition");
    }, 500);
  };

  const closeProfileMenu = () => {
    if (!profileMenuOpen || isClosingMenu) return;
    setIsClosingMenu(true);
    setTimeout(() => {
      setProfileMenuOpen(false);
      setIsClosingMenu(false);
    }, 180);
  };

  const toggleProfileMenu = () => {
    if (profileMenuOpen) {
      closeProfileMenu();
    } else {
      setIsClosingMenu(false);
      setProfileMenuOpen(true);
    }
  };

  const handleLogout = async () => {
    closeProfileMenu();
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } catch {}
    localStorage.removeItem("alphateam-user");
    router.replace("/");
    router.refresh();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        closeProfileMenu();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileMenuOpen, isClosingMenu]);

  return (
    <div className="fixed top-5 inset-x-0 z-50 px-4 sm:px-6 pointer-events-none">
      <header className="pointer-events-auto max-w-5xl mx-auto rounded-full bg-white/15 dark:bg-slate-900/20 backdrop-blur-md border border-slate-900/10 dark:border-white/15 shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.35)] transition-all duration-300">
        <div className="px-6 sm:px-8 h-16 flex items-center justify-between">
          {/* Logo only */}
          <Link href="/home" className="flex items-center shrink-0 hover:opacity-85 transition">
            <img
              src="/alphateam.png"
              alt="ALPHA TEAM"
              className="w-14 h-14 object-contain"
            />
          </Link>

          {/* Center Plain Clean Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-semibold transition-colors ${
                    isActive
                      ? "text-slate-950 dark:text-white font-bold"
                      : "text-slate-500 dark:text-slate-300/80 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Left: Circular Avatar with Animated Dropdown Menu */}
          <div className="flex items-center gap-3">
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={toggleProfileMenu}
                aria-label="قائمة الحساب"
                className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all duration-200 bg-slate-200 dark:bg-slate-800 flex items-center justify-center shadow-sm focus:outline-none ${
                  profileMenuOpen && !isClosingMenu
                    ? "border-indigo-500 scale-105"
                    : "border-slate-300/80 dark:border-white/20 hover:border-indigo-500 dark:hover:border-indigo-400"
                }`}
              >
                {/* Default User Avatar SVG */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-6 h-6 text-slate-500 dark:text-slate-300 translate-y-0.5"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {/* Profile Dropdown Menu with Open/Close Animation */}
              {profileMenuOpen && (
                <div
                  className={`${
                    isClosingMenu ? "animate-dropdown-out" : "animate-dropdown-in"
                  } absolute left-0 mt-3 w-48 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-white/15 shadow-2xl p-1.5 space-y-1 z-50`}
                >
                  {/* My Account Button */}
                  <Link
                    href="/profile"
                    onClick={closeProfileMenu}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition"
                  >
                    <span>حسابي</span>
                    <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </Link>

                  {/* Admin Dashboard Button (Shown directly under My Account for Admin/Team) */}
                  {isStaff && (
                    <Link
                      href="/admin"
                      onClick={closeProfileMenu}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition"
                    >
                      <span>لوحة التحكم</span>
                      <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </Link>
                  )}

                  {/* Theme Toggle Button inside menu */}
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition"
                  >
                    <span>تغيير المظهر</span>
                    <span key={isDark ? "dark" : "light"} className="animate-theme-icon">
                      {isDark ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-4 h-4 text-amber-400"
                        >
                          <circle cx="12" cy="12" r="4" />
                          <path d="M12 2v2" />
                          <path d="M12 20v2" />
                          <path d="m4.93 4.93 1.41 1.41" />
                          <path d="m17.66 17.66 1.41 1.41" />
                          <path d="M2 12h2" />
                          <path d="M20 12h2" />
                          <path d="m6.34 17.66-1.41 1.41" />
                          <path d="m19.07 4.93-1.41 1.41" />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-4 h-4 text-slate-700"
                        >
                          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                        </svg>
                      )}
                    </span>
                  </button>

                  <div className="h-px bg-slate-200/70 dark:bg-white/10 my-1" />

                  {/* Logout Button inside menu */}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition"
                  >
                    <span>تسجيل خروج</span>
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="القائمة"
              className="md:hidden text-slate-700 dark:text-slate-200 p-1"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Dropdown Pill Card */}
      {mobileMenuOpen && (
        <div className="pointer-events-auto md:hidden max-w-5xl mx-auto mt-2 rounded-3xl bg-white/95 dark:bg-slate-950/90 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-2xl p-4 space-y-2">
          {NAV_LINKS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                  isActive
                    ? "text-slate-950 dark:text-white bg-slate-100 dark:bg-white/10 font-bold"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
