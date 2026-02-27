"use client"

import * as React from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { User } from "lucide-react"
import { MobileNav } from "@/components/mobile-nav"
import { usePathname } from "next/navigation"
import axios from "axios"

export function Navbar() {
  const { setTheme, theme } = useTheme()
  const [isScrolled, setIsScrolled] = React.useState(false)
  const [user, setUser] = React.useState(null)
  const pathname = usePathname()

  const isAuthPage =
    pathname === "/signin" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"

  // Detect scroll
  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // ✨ Refetch /api/me every time path changes (like after login redirect)
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      axios
        .get(`${BACKEND_URL}/api/me`, { withCredentials: true })
        .then((res) => {
          setUser(res.data.user)
          console.log("✅ User loaded from /me:", res.data.user)
        })
        .catch((err) => {
          setUser(null)
          console.log("❌ /me error:", err.response?.data || err.message)
        })
    }, 300) // slight delay to let session cookie settle

    return () => clearTimeout(timeout)
  }, [pathname]) // ⬅️ re-run every time the path changes

  const handleLogout = async () => {
    try {
      await axios.post(`${BACKEND_URL}/api/logout`, {}, { withCredentials: true })
    } finally {
      // Even if the request fails (network hiccup), clear local state and bounce to sign-in.
      setUser(null)
      window.location.href = "/signin"
    }
  }

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled ? "bg-[#0c1117]/85 backdrop-blur-md border-b border-white/10 shadow-[0_18px_45px_rgba(7,12,21,0.45)]" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center">
          <MobileNav />
          <Link href="/" className="ml-2 flex items-center gap-3 md:ml-0">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#0f1520] text-sm font-semibold text-white">
              <span className="absolute inset-0 rounded-xl bg-[linear-gradient(140deg,rgba(56,189,248,0.24),rgba(251,146,60,0.24))]" />
              <span className="relative">VW</span>
            </div>
            <div className="leading-tight">
              <span className="text-lg font-semibold text-white transition-all duration-200 hover:text-cyan-300">
                Variant<span className="text-amber-300">Wise</span>
              </span>
              <span className="block text-[10px] uppercase tracking-[0.32em] text-slate-500">
                Variant-first guidance
              </span>
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-2 rounded-full border border-white/10 bg-[#0f1520]/70 px-2 py-1 md:flex">
          {[
            { href: "/", label: "Home" },
            { href: "/dashboard", label: "Dashboard" },
            { href: "/consultant", label: "Consultation" },
          ].map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  active
                    ? "bg-[linear-gradient(90deg,rgba(56,189,248,0.92),rgba(251,146,60,0.92))] text-slate-950 shadow-[0_10px_24px_rgba(56,189,248,0.25)]"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {!isAuthPage && (
            <>
              <Button variant="ghost" size="icon" className="rounded-full border border-white/10" asChild>
                <Link href="/dashboard">
                  <User className="h-5 w-5 text-white" />
                  <span className="sr-only">Profile</span>
                </Link>
              </Button>

              {user ? (
                <>
                  <span className="text-slate-300 text-sm hidden md:inline">Hi, {user.first_name}</span>
                  <Button
                    className="hidden md:flex bg-red-600/90 hover:bg-red-600 text-white border-0"
                    onClick={handleLogout}
                  >
                    Logout
                  </Button>
                </>
              ) : (
                <Button
                  className="hidden md:flex bg-[linear-gradient(90deg,rgba(56,189,248,0.95),rgba(251,146,60,0.95))] hover:brightness-110 text-slate-950 border-0"
                  asChild
                >
                  <Link href="/signin">Sign In</Link>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  )
}
